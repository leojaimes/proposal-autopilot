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
      profileEligibility: 'ELIGIBLE',
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

test('blocks every decision action until Radar health is ready', async () => {
  for (const status of Object.values(MarketRadarDecisionStatus)) {
    const prisma = { marketCategorySnapshot: { findFirst: async () => snapshot() } };
    const operations = { getHealth: async () => ({ state: 'PARTIAL' }) };
    const service = new MarketRadarDecisionService(prisma as any, operations as any);

    await assert.rejects(
      service.createDecision({
        tenantId: 'tenant-1', profile, snapshotId: 'snapshot-1', status,
        rationale: 'Radar data is incomplete.', operator: 'Armando',
      }),
      BadRequestException,
      `${status} must be blocked when Radar is not ready`,
    );
  }
});

test('rejects decisions for pending or excluded profile opportunities even when Radar is ready', async () => {
  for (const profileEligibility of ['PENDING', 'EXCLUDED'] as const) {
    const prisma = {
      marketCategorySnapshot: {
        findFirst: async () => snapshot({ profileOpportunities: [{ ...snapshot().profileOpportunities[0], profileEligibility }] }),
      },
    };
    const operations = { getHealth: async () => ({ state: 'READY' }) };
    const service = new MarketRadarDecisionService(prisma as any, operations as any);

    await assert.rejects(
      service.createDecision({
        tenantId: 'tenant-1', profile, snapshotId: 'snapshot-1', status: MarketRadarDecisionStatus.WATCHED,
        rationale: 'This profile cannot act on this category.', operator: 'Armando',
      }),
      BadRequestException,
      `${profileEligibility} opportunities must not accept a decision`,
    );
  }
});

test('persists the complete decision-to-result chain with a tenant-owned proposal and realized value', async () => {
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
    qualifiedRepliedAt: new Date('2026-10-23T12:00:00.000Z'),
    interviewedAt: new Date('2026-10-24T12:00:00.000Z'),
    wonAt: new Date('2026-10-25T12:00:00.000Z'),
    realizedValue: 4800,
  });

  assert.equal(outcomeUpdate.create.jobPostId, 'job-1');
  assert.equal(outcomeUpdate.create.proposalId, 'proposal-1');
  assert.equal(outcomeUpdate.create.submittedAt.toISOString(), '2026-10-22T12:00:00.000Z');
  assert.equal(outcomeUpdate.create.qualifiedRepliedAt.toISOString(), '2026-10-23T12:00:00.000Z');
  assert.equal(outcomeUpdate.create.interviewedAt.toISOString(), '2026-10-24T12:00:00.000Z');
  assert.equal(outcomeUpdate.create.wonAt.toISOString(), '2026-10-25T12:00:00.000Z');
  assert.equal(outcomeUpdate.create.realizedValue, 4800);
});
