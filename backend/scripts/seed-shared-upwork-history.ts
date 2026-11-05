import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import { PrismaSharedUpworkCatalogRepository } from '../src/modules/scraping/services/prisma-shared-upwork-catalog.repository';
import { rehydrateSharedUpworkHistorySeed } from '../src/modules/scraping/services/shared-upwork-history-seed';

const defaultManifestPath = join(__dirname, '../prisma/seeds/shared-upwork-history.v1.json');

export async function runSharedUpworkHistorySeed(manifestPath = process.env.SHARED_UPWORK_HISTORY_SEED_PATH ?? defaultManifestPath) {
  const prisma = new PrismaClient();
  try {
    return await rehydrateSharedUpworkHistorySeed(manifestPath, new PrismaSharedUpworkCatalogRepository(prisma));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runSharedUpworkHistorySeed()
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
