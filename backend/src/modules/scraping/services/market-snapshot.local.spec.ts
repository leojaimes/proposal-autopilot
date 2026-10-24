import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import {
  FitTier,
  JobCategoryAssignmentSource,
  MarketAiLeverageState,
  MarketCategoryLane,
  MarketRadarDecisionStatus,
  ProfileEligibility,
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
    const designSystems = await prisma.marketTaxonomyNode.findUniqueOrThrow({
      where: { slug: 'design-systems' },
    });
    const aiPrototyping = await prisma.marketTaxonomyNode.findUniqueOrThrow({
      where: { slug: 'ai-prototyping' },
    });
    const uxResearch = await prisma.marketTaxonomyNode.findUniqueOrThrow({
      where: { slug: 'ux-research' },
    });
    const productUx = await prisma.marketTaxonomyNode.findUniqueOrThrow({
      where: { slug: 'product-ux' },
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
        taxonomyNodeId: designSystems.id,
        lane: MarketCategoryLane.CORE,
        aiLeverageEnabled: true,
      },
    });
    await prisma.profileCategoryPolicy.createMany({
      data: [
        {
          tenantId: tenant.id,
          profileId: profile.id,
          taxonomyNodeId: aiPrototyping.id,
          lane: MarketCategoryLane.CORE,
          aiLeverageEnabled: true,
        },
        {
          tenantId: tenant.id,
          profileId: profile.id,
          taxonomyNodeId: uxResearch.id,
          lane: MarketCategoryLane.EXCLUDED,
        },
      ],
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
      prisma.jobPost.create({
        data: {
          tenantId: tenant.id,
          externalUpworkId: `local-radar-job-c-${suffix}`,
          title: 'AI product prototype',
          description: 'Prototype an LLM workflow for a SaaS product.',
          jobUrl: 'https://example.invalid/local-radar-c',
          postedAt: new Date('2026-10-20T12:00:00.000Z'),
          postedAtKnown: true,
          proposalsCount: 6,
          proposalsCountKnown: true,
          budgetFixed: 3000,
          isPaymentVerified: true,
          paymentVerificationKnown: true,
        },
      }),
    ]);

    await prisma.jobCategoryAssignment.createMany({
      data: [
        ...jobs.slice(0, 2).map((job) => ({
        tenantId: tenant.id,
        jobPostId: job.id,
        taxonomyNodeId: designSystems.id,
        source: JobCategoryAssignmentSource.RULES,
        isPrimary: true,
        })),
        {
          tenantId: tenant.id,
          jobPostId: jobs[2].id,
          taxonomyNodeId: aiPrototyping.id,
          source: JobCategoryAssignmentSource.RULES,
          isPrimary: true,
        },
      ],
    });
    await prisma.fitEvaluation.createMany({
      data: jobs.map((job, index) => ({
        jobPostId: job.id,
        positioningProfileId: profile.id,
        overallScore: index === 0 ? 80 : index === 1 ? 90 : 70,
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

    const snapshot = await prisma.marketCategorySnapshot.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        taxonomyNodeId: designSystems.id,
        asOf: new Date('2026-10-22T00:00:00.000Z'),
        calculationVersion: 'market-radar-v1',
        isCurrent: true,
      },
      include: { evidenceJobs: true, profileOpportunities: true },
    });

    assert.equal(snapshot.revision, 1);
    assert.equal(snapshot.isCurrent, true);
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
    assert.equal(snapshot.profileOpportunities[0].profileEligibility, ProfileEligibility.ELIGIBLE);
    assert.equal(snapshot.profileOpportunities[0].aiLeverageState, MarketAiLeverageState.APPLICABLE);
    assert.equal(snapshot.profileOpportunities[0].aiLeverageCapability, 'AI-assisted design-system acceleration');

    // 1. Same payload reuses current revision (idempotence without new revision)
    await service.rebuildForTenant(tenant.id, new Date('2026-10-22T12:00:00.000Z'));
    const recheckedSnapshot = await prisma.marketCategorySnapshot.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        taxonomyNodeId: designSystems.id,
        asOf: new Date('2026-10-22T00:00:00.000Z'),
        isCurrent: true,
      },
    });
    assert.equal(recheckedSnapshot.id, snapshot.id, 'Same payload must reuse current revision');
    assert.equal(recheckedSnapshot.revision, 1);

    // 2. Link decision to initial snapshot
    await prisma.marketRadarDecision.create({
      data: {
        tenantId: tenant.id,
        positioningProfileId: profile.id,
        marketCategorySnapshotId: snapshot.id,
        taxonomyNodeId: designSystems.id,
        status: MarketRadarDecisionStatus.PRIORITIZED,
        rationale: 'Preserved snapshot decision test.',
        operatorLabel: 'test-operator',
        snapshotContext: {},
        profileContext: {},
      },
    });

    // 3. Changed payload with existing decision creates new revision and deactivates prior
    const newJob = await prisma.jobPost.create({
      data: {
        tenantId: tenant.id,
        externalUpworkId: `local-radar-job-d-${suffix}`,
        title: 'Design systems lead',
        description: 'Lead token strategy.',
        jobUrl: 'https://example.invalid/local-radar-d',
        postedAt: new Date('2026-10-22T08:00:00.000Z'),
        postedAtKnown: true,
        proposalsCount: 2,
        proposalsCountKnown: true,
        budgetFixed: 5000,
        isPaymentVerified: true,
        paymentVerificationKnown: true,
      },
    });
    await prisma.jobCategoryAssignment.create({
      data: {
        tenantId: tenant.id,
        jobPostId: newJob.id,
        taxonomyNodeId: designSystems.id,
        source: JobCategoryAssignmentSource.RULES,
        isPrimary: true,
      },
    });

    await service.rebuildForTenant(tenant.id, new Date('2026-10-22T12:00:00.000Z'));

    const activeSnapshot = await prisma.marketCategorySnapshot.findFirstOrThrow({
      where: {
        tenantId: tenant.id,
        taxonomyNodeId: designSystems.id,
        asOf: new Date('2026-10-22T00:00:00.000Z'),
        isCurrent: true,
      },
    });
    assert.notEqual(activeSnapshot.id, snapshot.id, 'New revision must be created for changed content');
    assert.equal(activeSnapshot.revision, 2);

    const deactivatedSnapshot = await prisma.marketCategorySnapshot.findUniqueOrThrow({
      where: { id: snapshot.id },
    });
    assert.equal(deactivatedSnapshot.isCurrent, false, 'Prior snapshot revision must be deactivated');

    const opportunities = await prisma.profileOpportunitySnapshot.findMany({
      where: {
        profileId: profile.id,
        marketCategorySnapshot: { tenantId: tenant.id, asOf: new Date('2026-10-22T00:00:00.000Z'), isCurrent: true },
      },
      include: { marketCategorySnapshot: { include: { taxonomyNode: true } } },
    });
    const bySlug = new Map(opportunities.map((opportunity) => [opportunity.marketCategorySnapshot.taxonomyNode.slug, opportunity]));

    assert.equal(bySlug.get('ai-prototyping')?.profileEligibility, ProfileEligibility.ELIGIBLE);
    assert.equal(bySlug.get('ai-prototyping')?.aiLeverageState, MarketAiLeverageState.NOT_APPLICABLE);
    assert.equal(bySlug.get('ux-research')?.profileEligibility, ProfileEligibility.EXCLUDED);
    assert.equal(bySlug.get('product-ux')?.profileEligibility, ProfileEligibility.PENDING);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
