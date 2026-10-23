import { FitTier, JobCategoryAssignmentSource, MarketCategoryLane, PrismaClient, StrategicLane } from '@prisma/client';
import { MarketSnapshotService } from '../src/modules/scraping/services/market-snapshot.service';

const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001';
const FIXTURE_PREFIX = 'sandbox-market-radar-trend-';
const FIXTURE_PROPOSAL_ID = '00000000-0000-0000-0000-000000000123';
const FIXTURE_POLICY_VERSION = 999;
const FIXTURE_POLICY_MARKER = 'sandbox-market-radar-fixture';
const SNAPSHOT_DATES = [new Date('2026-10-21T12:00:00.000Z'), new Date('2026-10-22T12:00:00.000Z')];
const FIXTURE_PROFILE_NAME = process.env.MARKET_RADAR_FIXTURE_PROFILE_NAME;
const prisma = new PrismaClient();

async function taxonomyNodeId(slug: string): Promise<string> {
  return (await prisma.marketTaxonomyNode.findUniqueOrThrow({ where: { slug }, select: { id: true } })).id;
}

async function applyFixture(): Promise<void> {
  const [snapshotCount, existingFixtureJobs, activeProfile] = await Promise.all([
    prisma.marketCategorySnapshot.count({ where: { tenantId: DEFAULT_TENANT_ID } }),
    prisma.jobPost.count({ where: { tenantId: DEFAULT_TENANT_ID, externalUpworkId: { startsWith: FIXTURE_PREFIX } } }),
    prisma.positioningProfile.findFirst({
      where: {
        tenantId: DEFAULT_TENANT_ID,
        isActive: true,
        ...(FIXTURE_PROFILE_NAME ? { personaName: FIXTURE_PROFILE_NAME } : {}),
      },
      select: { id: true },
    }),
  ]);
  if (snapshotCount !== 0 || existingFixtureJobs !== 0) {
    throw new Error('Local market-radar fixture requires an empty snapshot set and no prior fixture jobs. Run cleanup or use a clean local database.');
  }
  if (!activeProfile) {
    throw new Error(FIXTURE_PROFILE_NAME
      ? `Local market-radar fixture could not find active profile: ${FIXTURE_PROFILE_NAME}.`
      : 'Local market-radar fixture requires one active default-tenant profile.');
  }

  const [designSystemsId, aiPrototypingId] = await Promise.all([
    taxonomyNodeId('design-systems'),
    taxonomyNodeId('ai-prototyping'),
  ]);
  await Promise.all([
    prisma.profileCategoryPolicy.upsert({
      where: { uq_profile_taxonomy_policy: { profileId: activeProfile.id, taxonomyNodeId: designSystemsId } },
      update: { tenantId: DEFAULT_TENANT_ID, lane: MarketCategoryLane.CORE, aiLeverageEnabled: true, isActive: true, policyVersion: FIXTURE_POLICY_VERSION, includeTerms: [FIXTURE_POLICY_MARKER] },
      create: { tenantId: DEFAULT_TENANT_ID, profileId: activeProfile.id, taxonomyNodeId: designSystemsId, lane: MarketCategoryLane.CORE, aiLeverageEnabled: true, isActive: true, policyVersion: FIXTURE_POLICY_VERSION, includeTerms: [FIXTURE_POLICY_MARKER] },
    }),
    prisma.profileCategoryPolicy.upsert({
      where: { uq_profile_taxonomy_policy: { profileId: activeProfile.id, taxonomyNodeId: aiPrototypingId } },
      update: { tenantId: DEFAULT_TENANT_ID, lane: MarketCategoryLane.ADJACENT, aiLeverageEnabled: true, isActive: true, policyVersion: FIXTURE_POLICY_VERSION, includeTerms: [FIXTURE_POLICY_MARKER] },
      create: { tenantId: DEFAULT_TENANT_ID, profileId: activeProfile.id, taxonomyNodeId: aiPrototypingId, lane: MarketCategoryLane.ADJACENT, aiLeverageEnabled: true, isActive: true, policyVersion: FIXTURE_POLICY_VERSION, includeTerms: [FIXTURE_POLICY_MARKER] },
    }),
  ]);
  const jobs = await Promise.all([
    prisma.jobPost.create({ data: {
      tenantId: DEFAULT_TENANT_ID, externalUpworkId: `${FIXTURE_PREFIX}design-baseline`,
      title: 'Design system audit', description: 'Audit a Figma component library and design tokens for a B2B SaaS team.',
      jobUrl: 'https://example.invalid/sandbox-market-radar-design-baseline', postedAt: new Date('2026-10-20T12:00:00.000Z'), postedAtKnown: true,
      proposalsCount: 12, proposalsCountKnown: true, budgetFixed: 3000, isPaymentVerified: true, paymentVerificationKnown: true,
    } }),
    prisma.jobPost.create({ data: {
      tenantId: DEFAULT_TENANT_ID, externalUpworkId: `${FIXTURE_PREFIX}design-new`,
      title: 'Figma design tokens sprint', description: 'Implement Figma variables and a component library for product UX.',
      jobUrl: 'https://example.invalid/sandbox-market-radar-design-new', postedAt: new Date('2026-10-22T08:00:00.000Z'), postedAtKnown: true,
      proposalsCount: 2, proposalsCountKnown: true, budgetFixed: 4500, isPaymentVerified: true, paymentVerificationKnown: true,
    } }),
    prisma.jobPost.create({ data: {
      tenantId: DEFAULT_TENANT_ID, externalUpworkId: `${FIXTURE_PREFIX}ai-new`,
      title: 'AI prototyping workflow', description: 'Prototype an agentic workflow using an LLM for a SaaS product.',
      jobUrl: 'https://example.invalid/sandbox-market-radar-ai-new', postedAt: new Date('2026-10-22T09:00:00.000Z'), postedAtKnown: true,
      proposalsCount: 28, proposalsCountKnown: true, budgetFixed: 2500, isPaymentVerified: false, paymentVerificationKnown: true,
    } }),
  ]);
  await prisma.proposal.create({ data: {
    id: FIXTURE_PROPOSAL_ID,
    jobPostId: jobs[0].id,
    positioningProfileId: activeProfile.id,
    coverLetter35Words: 'Deterministic fixture proposal for the local Market Radar result flow.',
    technicalProposalBody: 'This proposal exists only to verify Radar decision-to-result associations locally.',
  } });

  await prisma.jobCategoryAssignment.createMany({ data: [
    { tenantId: DEFAULT_TENANT_ID, jobPostId: jobs[0].id, taxonomyNodeId: designSystemsId, source: JobCategoryAssignmentSource.RULES, isPrimary: true },
    { tenantId: DEFAULT_TENANT_ID, jobPostId: jobs[1].id, taxonomyNodeId: designSystemsId, source: JobCategoryAssignmentSource.RULES, isPrimary: true },
    { tenantId: DEFAULT_TENANT_ID, jobPostId: jobs[2].id, taxonomyNodeId: aiPrototypingId, source: JobCategoryAssignmentSource.RULES, isPrimary: true },
  ] });
  await prisma.fitEvaluation.createMany({ data: jobs.map((job, index) => ({
    jobPostId: job.id, positioningProfileId: activeProfile.id, overallScore: index === 2 ? 61 : 84,
    fitTier: FitTier.HIGH, strategicLane: StrategicLane.CORE_AI_UX, normalizedRole: 'Sandbox market radar',
    skillScore: 35, aiFeasibilityScore: 20, clientQualityScore: 15, recencyScore: 10,
    summaryRationale: 'Deterministic local market-radar fixture.',
  })) });

  const snapshots = new MarketSnapshotService(prisma as any);
  for (const date of SNAPSHOT_DATES) await snapshots.rebuildForTenant(DEFAULT_TENANT_ID, date);
  console.log('Applied deterministic local market-radar fixture.');
}

async function cleanupFixture(): Promise<void> {
  const taxonomyCategoryCount = await prisma.marketTaxonomyNode.count({ where: { isActive: true, kind: { in: ['SUBCATEGORY', 'OCCUPATION'] } } });
  const snapshotCount = await prisma.marketCategorySnapshot.count({ where: { tenantId: DEFAULT_TENANT_ID } });
  const expectedSnapshots = taxonomyCategoryCount * SNAPSHOT_DATES.length;
  if (snapshotCount !== expectedSnapshots) {
    throw new Error(`Refusing cleanup: expected ${expectedSnapshots} fixture snapshots but found ${snapshotCount}.`);
  }
  await prisma.marketRadarDecision.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.marketCategorySnapshot.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID } });
  await prisma.profileCategoryPolicy.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID, policyVersion: FIXTURE_POLICY_VERSION, includeTerms: { has: FIXTURE_POLICY_MARKER } } });
  await prisma.jobPost.deleteMany({ where: { tenantId: DEFAULT_TENANT_ID, externalUpworkId: { startsWith: FIXTURE_PREFIX } } });
  console.log('Removed deterministic local market-radar fixture.');
}

async function main(): Promise<void> {
  const mode = process.env.MARKET_RADAR_FIXTURE_MODE;
  if (mode === 'apply') return applyFixture();
  if (mode === 'cleanup') return cleanupFixture();
  throw new Error('Set MARKET_RADAR_FIXTURE_MODE to apply or cleanup.');
}

main().finally(() => prisma.$disconnect());
