import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  FitTier,
  JobCategoryAssignmentSource,
  MarketCategoryLane,
  PrismaClient,
  StrategicLane,
} from '@prisma/client';
import { MarketSnapshotService } from './market-snapshot.service';

const prisma = new PrismaClient();

test('persists reproducible market and profile-opportunity snapshots in local PostgreSQL', async () => {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({
    data: { name: 'Local radar test tenant', slug: `local-radar-${suffix}` },
  });

  try {
    const taxonomyNode = await prisma.marketTaxonomyNode.findUniqueOrThrow({
      where: { slug: 'design-systems' },
    });
    const profile = await prisma.positioningProfile.create({
      data: {
        tenantId: tenant.id,
        personaName: 'Local radar persona',
        roleTitle: 'Design systems specialist',
        offerHeadline: 'Design systems for SaaS teams',
        targetAudience: 'B2B SaaS product leads',
      },
    });
    await prisma.profileCategoryPolicy.create({
      data: {
        tenantId: tenant.id,
        profileId: profile.id,
        taxonomyNodeId: taxonomyNode.id,
        lane: MarketCategoryLane.CORE,
      },
    });

    const jobs = await Promise.all([
      prisma.jobPost.create({
        data: {
          tenantId: tenant.id,
          externalUpworkId: `local-radar-job-a-${suffix}`,
          title: 'Design system architecture',
          description: 'Build a component library.',
          jobUrl: 'https://example.invalid/local-radar-a',
          postedAt: new Date('2026-10-21T12:00:00.000Z'),
          postedAtKnown: true,
          proposalsCount: 3,
          proposalsCountKnown: true,
          budgetFixed: 2000,
          isPaymentVerified: true,
          paymentVerificationKnown: true,
        },
      }),
      prisma.jobPost.create({
        data: {
          tenantId: tenant.id,
          externalUpworkId: `local-radar-job-b-${suffix}`,
          title: 'Figma design tokens',
          description: 'Standardize design tokens.',
          jobUrl: 'https://example.invalid/local-radar-b',
          postedAt: new Date('2026-10-10T12:00:00.000Z'),
          postedAtKnown: true,
          proposalsCount: 9,
          proposalsCountKnown: true,
          budgetFixed: 4000,
          isPaymentVerified: false,
          paymentVerificationKnown: true,
        },
      }),
    ]);

    await prisma.jobCategoryAssignment.createMany({
      data: jobs.map((job) => ({
        tenantId: tenant.id,
        jobPostId: job.id,
        taxonomyNodeId: taxonomyNode.id,
        source: JobCategoryAssignmentSource.RULES,
        isPrimary: true,
      })),
    });
    await prisma.fitEvaluation.createMany({
      data: jobs.map((job, index) => ({
        jobPostId: job.id,
        positioningProfileId: profile.id,
        overallScore: index === 0 ? 80 : 90,
        fitTier: FitTier.HIGH,
        strategicLane: StrategicLane.CORE_AI_UX,
        normalizedRole: 'Design systems',
        skillScore: 35,
        aiFeasibilityScore: 20,
        clientQualityScore: 15,
        recencyScore: 10,
        summaryRationale: 'Local market snapshot test.',
      })),
    });

    const service = new MarketSnapshotService(prisma as any);
    await service.rebuildForTenant(tenant.id, new Date('2026-10-22T12:00:00.000Z'));

    const snapshot = await prisma.marketCategorySnapshot.findUniqueOrThrow({
      where: {
        uq_market_snapshot_version: {
          tenantId: tenant.id,
          taxonomyNodeId: taxonomyNode.id,
          asOf: new Date('2026-10-22T00:00:00.000Z'),
          calculationVersion: 'market-radar-v1',
        },
      },
      include: { evidenceJobs: true, profileOpportunities: true },
    });

    assert.equal(snapshot.demand7d, 1);
    assert.equal(snapshot.demand30d, 2);
    assert.equal(Number(snapshot.medianProposals), 6);
    assert.equal(Number(snapshot.medianBudget), 3000);
    assert.equal(Number(snapshot.verifiedClientsPct), 50);
    assert.equal(snapshot.evidenceJobs.length, 2);
    assert.equal(snapshot.profileOpportunities.length, 1);
    assert.equal(snapshot.profileOpportunities[0].lane, MarketCategoryLane.CORE);
    assert.equal(Number(snapshot.profileOpportunities[0].profileFit), 85);
    assert.notEqual(snapshot.profileOpportunities[0].overallOpportunity, null);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
