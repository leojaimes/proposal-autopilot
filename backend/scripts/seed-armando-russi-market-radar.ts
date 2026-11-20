import {
  BudgetType,
  FitTier,
  JobCategoryAssignmentSource,
  MarketCategoryLane,
  PrismaClient,
  StrategicLane,
} from '@prisma/client';
import { MarketSnapshotService } from '../src/modules/scraping/services/market-snapshot.service';

const prisma = new PrismaClient();

const ARMANDO_EMAIL = 'armandorussi@gmail.com';
const SEED_PREFIX = 'armando-seed-';

export async function seedArmandoMarketRadar() {
  console.log(`Starting seed for ${ARMANDO_EMAIL}...`);

  const user = await prisma.tenantUser.findUnique({
    where: { email: ARMANDO_EMAIL },
    include: { tenant: true },
  });

  if (!user || !user.tenant) {
    throw new Error(`Tenant for ${ARMANDO_EMAIL} not found. Register first.`);
  }

  const tenantId = user.tenantId;

  const profile = await prisma.positioningProfile.findFirst({
    where: { tenantId, isActive: true },
  });

  if (!profile) {
    throw new Error(`Active positioning profile for ${ARMANDO_EMAIL} not found.`);
  }

  console.log(`Target Tenant: ${tenantId} | Profile: ${profile.personaName} (${profile.id})`);

  // 1. Map taxonomy nodes and policies (Core vs Adjacent)
  const taxonomyNodes = await prisma.marketTaxonomyNode.findMany({
    where: { isActive: true },
  });

  const laneMapping: Record<string, MarketCategoryLane> = {
    'ux-research': MarketCategoryLane.CORE,
    'design-systems': MarketCategoryLane.CORE,
    'product-ux': MarketCategoryLane.CORE,
    'ai-prototyping': MarketCategoryLane.ADJACENT,
    'workflow-automation': MarketCategoryLane.ADJACENT,
    'social-media-content': MarketCategoryLane.ADJACENT,
    'full-stack-saas': MarketCategoryLane.ADJACENT,
    'cms-ecommerce': MarketCategoryLane.ADJACENT,
    'backend-api-engineering': MarketCategoryLane.ADJACENT,
    'other-services': MarketCategoryLane.ADJACENT,
  };

  for (const node of taxonomyNodes) {
    const lane = laneMapping[node.slug] || MarketCategoryLane.ADJACENT;
    await prisma.profileCategoryPolicy.upsert({
      where: {
        uq_profile_taxonomy_policy: {
          profileId: profile.id,
          taxonomyNodeId: node.id,
        },
      },
      update: {
        lane,
        aiLeverageEnabled: true,
        isActive: true,
      },
      create: {
        tenantId,
        profileId: profile.id,
        taxonomyNodeId: node.id,
        lane,
        aiLeverageEnabled: true,
        isActive: true,
      },
    });
  }

  console.log('Category policies upserted (Core vs Adjacent).');

  // 2. Map segment to taxonomy node
  const segmentToTaxonomySlug: Record<string, string> = {
    'ux-research': 'ux-research',
    'design-systems': 'design-systems',
    'ux-ui': 'product-ux',
    'ai-prototyping': 'ai-prototyping',
    'n8n-automation': 'workflow-automation',
    'social-media-content': 'social-media-content',
    'gohighlevel': 'workflow-automation',
    'aeo-geo': 'workflow-automation',
    'translation': 'other-services',
  };

  // 3. Clean up previous seed jobs for Armando
  await prisma.jobCategoryAssignment.deleteMany({
    where: {
      tenantId,
      jobPost: { externalUpworkId: { startsWith: SEED_PREFIX } },
    },
  });
  await prisma.fitEvaluation.deleteMany({
    where: {
      jobPost: { tenantId, externalUpworkId: { startsWith: SEED_PREFIX } },
    },
  });
  await prisma.jobPost.deleteMany({
    where: {
      tenantId,
      externalUpworkId: { startsWith: SEED_PREFIX },
    },
  });

  // Create a designated batch run
  const batchRun = await prisma.batchRun.create({
    data: {
      tenantId,
      status: 'COMPLETED',
      jobsFound: 0,
      highFitCount: 0,
      mediumFitCount: 0,
      finishedAt: new Date(),
    },
  });

  let totalImported = 0;

  // 4. Sample real jobs from shared_upwork_jobs (max 25 per segment)
  for (const [segment, taxSlug] of Object.entries(segmentToTaxonomySlug)) {
    const targetTaxNode = taxonomyNodes.find((n) => n.slug === taxSlug);
    if (!targetTaxNode) continue;

    const sharedJobs = await prisma.sharedUpworkJob.findMany({
      where: {
        segments: { some: { segment } },
      },
      take: 25,
      orderBy: { postedAt: 'desc' },
    });

    for (const sj of sharedJobs) {
      const payload: any = sj.rawApifyPayload || {};
      const isHourly = payload.price_type === 'hourly' || (payload.price_min != null && payload.price == null);
      const budgetFixed = payload.price != null ? Number(payload.price) : null;
      const hourlyMin = payload.price_min != null ? Number(payload.price_min) : null;
      const hourlyMax = payload.price_max != null ? Number(payload.price_max) : null;
      const proposalsCount = Number(payload.client_total_applicants) || 0;
      const clientTotalSpend = Number(payload.total_spent) || 0;
      const isPaymentVerified = Boolean(payload.buyer_payment_verified);

      const jobPost = await prisma.jobPost.create({
        data: {
          tenantId,
          batchRunId: batchRun.id,
          externalUpworkId: `${SEED_PREFIX}${segment}-${sj.externalUpworkId}`,
          title: sj.title,
          description: sj.description,
          jobUrl: sj.jobUrl,
          postedAt: sj.postedAt,
          postedAtKnown: true,
          budgetType: isHourly ? BudgetType.HOURLY : (budgetFixed != null ? BudgetType.FIXED : BudgetType.NOT_SHOWN),
          budgetFixed,
          hourlyMin,
          hourlyMax,
          clientCountry: payload.client_location || 'United States',
          clientTotalSpend,
          proposalsCount,
          proposalsCountKnown: true,
          isPaymentVerified,
          paymentVerificationKnown: true,
          rawApifyPayload: sj.rawApifyPayload as any,
        },
      });

      // Link category assignment
      await prisma.jobCategoryAssignment.create({
        data: {
          tenantId,
          jobPostId: jobPost.id,
          taxonomyNodeId: targetTaxNode.id,
          source: JobCategoryAssignmentSource.RULES,
          isPrimary: true,
          confidence: 0.95,
        },
      });

      // Compute scoring
      const isCore = laneMapping[targetTaxNode.slug] === MarketCategoryLane.CORE;
      const overallScore = isCore ? Math.floor(75 + Math.random() * 20) : Math.floor(55 + Math.random() * 25);

      await prisma.fitEvaluation.create({
        data: {
          jobPostId: jobPost.id,
          positioningProfileId: profile.id,
          overallScore,
          fitTier: overallScore >= 70 ? FitTier.HIGH : FitTier.MEDIUM,
          strategicLane: isCore ? StrategicLane.CORE_AI_UX : StrategicLane.INTERFACE_BUILD,
          normalizedRole: targetTaxNode.name,
          skillScore: isCore ? 85 : 65,
          aiFeasibilityScore: 80,
          clientQualityScore: clientTotalSpend > 1000 ? 80 : 50,
          recencyScore: 90,
          summaryRationale: `Evaluación de afinidad para el perfil de Armando Russi en ${targetTaxNode.name}.`,
        },
      });

      totalImported++;
    }
  }

  await prisma.batchRun.update({
    where: { id: batchRun.id },
    data: { jobsFound: totalImported },
  });

  console.log(`Seeded ${totalImported} real Upwork jobs into Armando's tenant.`);

  // 5. Rebuild Snapshots for Armando's tenant
  const snapshots = new MarketSnapshotService(prisma as any);
  await snapshots.rebuildForTenant(tenantId, new Date());

  console.log(`Rebuilt snapshots for tenant ${tenantId}. Armando Russi Market Radar is ready!`);
}

async function cleanupArmandoMarketRadar() {
  console.log(`Cleaning up seed for ${ARMANDO_EMAIL}...`);
  const user = await prisma.tenantUser.findUnique({
    where: { email: ARMANDO_EMAIL },
  });
  if (!user) return;

  const tenantId = user.tenantId;

  await prisma.marketCategorySnapshot.deleteMany({ where: { tenantId } });
  await prisma.jobCategoryAssignment.deleteMany({
    where: { tenantId, jobPost: { externalUpworkId: { startsWith: SEED_PREFIX } } },
  });
  await prisma.fitEvaluation.deleteMany({
    where: { jobPost: { tenantId, externalUpworkId: { startsWith: SEED_PREFIX } } },
  });
  await prisma.jobPost.deleteMany({
    where: { tenantId, externalUpworkId: { startsWith: SEED_PREFIX } },
  });
  console.log('Cleanup finished.');
}

if (process.argv.includes('--cleanup')) {
  cleanupArmandoMarketRadar()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
} else {
  seedArmandoMarketRadar()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
