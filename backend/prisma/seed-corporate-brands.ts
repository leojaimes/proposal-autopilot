import { PrismaClient } from '@prisma/client';
import type { CorporateBrandSeedItem } from '../src/modules/prospecting/constants/corporate-brands.constants';

function loadKnownCorporateBrands(): CorporateBrandSeedItem[] {
  try {
    // Docker production runner has compiled dist/
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../dist/modules/prospecting/constants/corporate-brands.constants').KNOWN_CORPORATE_BRANDS;
  } catch {
    // Local dev ts-node has src/
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('../src/modules/prospecting/constants/corporate-brands.constants').KNOWN_CORPORATE_BRANDS;
  }
}

export async function seedCorporateBrands(prismaClient?: PrismaClient): Promise<number> {
  const prisma = prismaClient ?? new PrismaClient();
  const shouldDisconnect = !prismaClient;
  const brands = loadKnownCorporateBrands();

  try {
    let count = 0;
    for (const brand of brands) {
      await prisma.corporateBrand.upsert({
        where: { slug: brand.slug },
        create: {
          slug: brand.slug,
          name: brand.name,
          rootDomain: brand.rootDomain,
          industry: brand.industry,
          countryScope: brand.countryScope,
          headquartersCity: brand.headquartersCity,
          corporateWebsite: `https://${brand.rootDomain}`,
          isKnownFranchise: true,
        },
        update: {
          name: brand.name,
          rootDomain: brand.rootDomain,
          industry: brand.industry,
          countryScope: brand.countryScope,
          headquartersCity: brand.headquartersCity,
          isKnownFranchise: true,
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
  seedCorporateBrands()
    .then((n) => console.log(`✅ Seeded ${n} CorporateBrand definitions.`))
    .catch((err) => {
      console.error('❌ Failed seeding CorporateBrands:', err);
      process.exit(1);
    });
}
