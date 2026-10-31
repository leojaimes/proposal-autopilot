import { PrismaClient } from '@prisma/client';
import type { PainCatalogSeedItem } from '../src/modules/prospecting/constants/pain-catalog.constants';

function loadCanonicalPainCatalog(): PainCatalogSeedItem[] {
  try {
    // Docker production runner has compiled dist/
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../dist/modules/prospecting/constants/pain-catalog.constants').CANONICAL_PAIN_CATALOG;
  } catch {
    // Local dev ts-node has src/
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../src/modules/prospecting/constants/pain-catalog.constants').CANONICAL_PAIN_CATALOG;
  }
}

export async function seedCompanyPainCatalog(prismaClient?: PrismaClient): Promise<number> {
  const prisma = prismaClient ?? new PrismaClient();
  const shouldDisconnect = !prismaClient;
  const catalog = loadCanonicalPainCatalog();

  try {
    let count = 0;
    for (const item of catalog) {
      await prisma.companyPainCatalog.upsert({
        where: { code: item.code },
        create: {
          code: item.code,
          categoryEnum: item.categoryEnum,
          name: item.name,
          description: item.description,
          suggestedOffer: item.suggestedOffer,
          baseTicketUsd: item.baseTicketUsd,
          monthlyRetainerUsd: item.monthlyRetainerUsd,
          priorityWeight: item.priorityWeight,
          pitchTemplateOwner: item.pitchTemplateOwner,
          pitchTemplateGatekeeper: item.pitchTemplateGatekeeper,
          pitchTemplateEnterprise: item.pitchTemplateEnterprise,
          detectionRules: item.detectionRules,
          isActive: true,
        },
        update: {
          categoryEnum: item.categoryEnum,
          name: item.name,
          description: item.description,
          suggestedOffer: item.suggestedOffer,
          baseTicketUsd: item.baseTicketUsd,
          monthlyRetainerUsd: item.monthlyRetainerUsd,
          priorityWeight: item.priorityWeight,
          pitchTemplateOwner: item.pitchTemplateOwner,
          pitchTemplateGatekeeper: item.pitchTemplateGatekeeper,
          pitchTemplateEnterprise: item.pitchTemplateEnterprise,
          detectionRules: item.detectionRules,
        },
      });
      count++;
    }
    return count;
  } finally {
    if (shouldDisconnect) {
      await prisma.$disconnect();
    }
  }
}

if (require.main === module) {
  seedCompanyPainCatalog()
    .then((n) => console.log(`✅ Seeded ${n} CompanyPainCatalog definitions.`))
    .catch((err) => {
      console.error('❌ Failed seeding CompanyPainCatalog:', err);
      process.exit(1);
    });
}
