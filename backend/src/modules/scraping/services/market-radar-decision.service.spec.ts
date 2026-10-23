import { strict as assert } from 'node:assert';
import { BadRequestException } from '@nestjs/common';
import { MarketCategoryLane, MarketRadarDecisionStatus } from '@prisma/client';
import { test } from 'node:test';
import { MarketRadarDecisionService } from './market-radar-decision.service';

const profile = {
  id: 'profile-1',
  isActive: true,
  personaName: 'Automation consultant',
  roleTitle: 'Automation consultant',
  offerHeadline: 'Automation delivery',
};

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: 'snapshot-1',
    asOf: new Date('2026-10-22T00:00:00.000Z'),
    calculationVersion: 'market-radar-v1',
    periodStart: new Date('2026-09-22T00:00:00.000Z'),
    periodEnd: new Date('2026-10-22T00:00:00.000Z'),
    demand7d: 2,
    demand30d: 8,
    medianProposals: 10,
    medianBudget: 500,
    verifiedClientsPct: 75,
    sampleJobs: 8,
    sampleConfidence: 70,
    metricCoverage: { proposalsKnownJobs: 8 },
    sourceBatchCount: 1,
    taxonomyNode: { id: 'taxonomy-1', name: 'Workflow automation', slug: 'workflow-automation' },
    evidenceJobs: [{ jobPostId: 'job-1' }],
    profileOpportunities: [{
      lane: MarketCategoryLane.CORE,
      profileFit: 82,
      overallOpportunity: 65,
      fitSampleJobs: 1,
      calculationVersion: 'market-radar-v1',
    }],
    ...overrides,
  };
}

test('preserves the observed snapshot and profile context when recording a prioritized decision', async () => {
  let created: any;
  const prisma = {
    marketCategorySnapshot: { findFirst: async () => snapshot() },
    marketRadarDecision: { create: async ({ data }: any) => { created = data; return { id: 'decision-1', ...data, outcome: null }; } },
  };
  const operations = { getHealth: async () => ({ state: 'READY' }) };
  const service = new MarketRadarDecisionService(prisma as any, operations as any);

  await service.createDecision({
    tenantId: 'tenant-1', profile, snapshotId: 'snapshot-1', status: MarketRadarDecisionStatus.PRIORITIZED,
    rationale: 'Observed automation demand matches the active offer.', operator: 'Armando',
  });

  assert.equal(created.marketCategorySnapshotId, 'snapshot-1');
  assert.equal(created.positioningProfileId, 'profile-1');
  assert.deepEqual(created.evidenceJobIds, ['job-1']);
  assert.equal(created.snapshotContext.category.slug, 'workflow-automation');
  assert.equal(created.profileContext.profileFit, 82);
});

test('blocks prioritized decisions until Radar health is ready', async () => {
  const prisma = { marketCategorySnapshot: { findFirst: async () => snapshot() } };
  const operations = { getHealth: async () => ({ state: 'PARTIAL' }) };
  const service = new MarketRadarDecisionService(prisma as any, operations as any);

  await assert.rejects(
    service.createDecision({
      tenantId: 'tenant-1', profile, snapshotId: 'snapshot-1', status: MarketRadarDecisionStatus.PRIORITIZED,
      rationale: 'Need more evidence.', operator: 'Armando',
    }),
    BadRequestException,
  );
});

test('rejects a category without an observed eligible profile fit', async () => {
  const prisma = { marketCategorySnapshot: { findFirst: async () => snapshot({ profileOpportunities: [] }) } };
  const operations = { getHealth: async () => ({ state: 'READY' }) };
  const service = new MarketRadarDecisionService(prisma as any, operations as any);

  await assert.rejects(
    service.createDecision({
      tenantId: 'tenant-1', profile, snapshotId: 'snapshot-1', status: MarketRadarDecisionStatus.WATCHED,
      rationale: 'No observed fit yet.', operator: 'Armando',
    }),
    BadRequestException,
  );
});

test('links an outcome to a tenant-owned proposal and its job', async () => {
  let outcomeUpdate: any;
  const prisma = {
    marketRadarDecision: { findFirst: async () => ({ id: 'decision-1' }) },
    proposal: { findFirst: async () => ({ id: 'proposal-1', jobPostId: 'job-1' }) },
    marketRadarDecisionOutcome: {
      upsert: async ({ create, update }: any) => { outcomeUpdate = { create, update }; return create; },
    },
  };
  const service = new MarketRadarDecisionService(prisma as any, {} as any);

  await service.updateOutcome({
    tenantId: 'tenant-1', decisionId: 'decision-1', proposalId: 'proposal-1',
    submittedAt: new Date('2026-10-22T12:00:00.000Z'),
  });

  assert.equal(outcomeUpdate.create.jobPostId, 'job-1');
  assert.equal(outcomeUpdate.create.proposalId, 'proposal-1');
  assert.equal(outcomeUpdate.create.submittedAt.toISOString(), '2026-10-22T12:00:00.000Z');
});
