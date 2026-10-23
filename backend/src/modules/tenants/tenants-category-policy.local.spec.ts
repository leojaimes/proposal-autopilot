import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { MarketCategoryLane, PrismaClient } from '@prisma/client';
import { TenantsService } from './tenants.service';

const prisma = new PrismaClient();

test('replaces a profile taxonomy policy set atomically within its tenant', async () => {
  const suffix = randomUUID();
  const tenant = await prisma.tenant.create({ data: { name: 'Local policy test', slug: `local-policy-${suffix}` } });
  try {
    const [designSystems, uxResearch] = await Promise.all([
      prisma.marketTaxonomyNode.findUniqueOrThrow({ where: { slug: 'design-systems' } }),
      prisma.marketTaxonomyNode.findUniqueOrThrow({ where: { slug: 'ux-research' } }),
    ]);
    const profile = await prisma.positioningProfile.create({
      data: {
        tenantId: tenant.id,
        personaName: 'Policy test profile',
        roleTitle: 'Designer',
        offerHeadline: 'Design systems',
        targetAudience: 'SaaS teams',
      },
    });
    const service = new TenantsService(prisma as any, {} as any);

    await service.syncFullProfile(tenant.id, {
      profileId: profile.id,
      offerHeadline: 'Design systems',
      targetAudience: 'SaaS teams',
      coreRoles: [], hybridRoles: [], tangentialRoles: [], excludedRoles: [],
      categoryPolicies: [
        { taxonomyNodeId: designSystems.id, lane: 'CORE', priority: 10 },
        { taxonomyNodeId: uxResearch.id, lane: 'ADJACENT' },
      ],
    });

    const firstPolicies = await prisma.profileCategoryPolicy.findMany({ where: { profileId: profile.id }, orderBy: { priority: 'desc' } });
    assert.deepEqual(firstPolicies.map((policy) => [policy.taxonomyNodeId, policy.lane, policy.priority]), [
      [designSystems.id, MarketCategoryLane.CORE, 10],
      [uxResearch.id, MarketCategoryLane.ADJACENT, 0],
    ]);

    await service.syncFullProfile(tenant.id, {
      profileId: profile.id,
      offerHeadline: 'Design systems',
      targetAudience: 'SaaS teams',
      coreRoles: [], hybridRoles: [], tangentialRoles: [], excludedRoles: [],
      categoryPolicies: [{ taxonomyNodeId: uxResearch.id, lane: 'EXCLUDED' }],
    });

    const replacedPolicies = await prisma.profileCategoryPolicy.findMany({ where: { profileId: profile.id } });
    assert.deepEqual(replacedPolicies.map((policy) => [policy.taxonomyNodeId, policy.lane]), [
      [uxResearch.id, MarketCategoryLane.EXCLUDED],
    ]);
  } finally {
    await prisma.tenant.delete({ where: { id: tenant.id } });
    await prisma.$disconnect();
  }
});
