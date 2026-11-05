import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { join } from 'node:path';
import { readApifyDatasetPages } from '../src/modules/scraping/services/apify-dataset-reader';
import { PrismaSharedUpworkCatalogRepository } from '../src/modules/scraping/services/prisma-shared-upwork-catalog.repository';
import { writeSharedUpworkHistoryManifest } from '../src/modules/scraping/services/shared-upwork-history-manifest';
import { UpworkHistorySeedImporter } from '../src/modules/scraping/services/upwork-history-seed-importer';

const actorId = 'hyperbach/upwork-jobs-history' as const;
const runId = process.env.APIFY_RUN_ID;
const datasetId = process.env.APIFY_DATASET_ID;
const token = process.env.APIFY_TOKEN;
const from = process.env.UPWORK_HISTORY_FROM;
const to = process.env.UPWORK_HISTORY_TO;

async function main() {
  if (!runId || !datasetId || !token || !from || !to) {
    throw new Error('Set APIFY_RUN_ID, APIFY_DATASET_ID, UPWORK_HISTORY_FROM and UPWORK_HISTORY_TO.');
  }
  const prisma = new PrismaClient();
  const catalog = new PrismaSharedUpworkCatalogRepository(prisma);
  try {
    if (await catalog.hasCompletedProtectedSeed()) return { imported: 0, skipped: true };
    const rawItems = await readApifyDatasetPages(datasetId, token);
    const manifestPath = process.env.SHARED_UPWORK_HISTORY_SEED_PATH
      ?? join(__dirname, '../prisma/seeds/shared-upwork-history.page-0001.v1.json');
    const importer = new UpworkHistorySeedImporter(
      { async getMostRecent() { return { runId, datasetId, items: rawItems }; } },
      {
        hasCompletedProtectedSeed: () => catalog.hasCompletedProtectedSeed(),
        async saveProtected(rows, provenance) {
          const last = rows.at(-1);
          await writeSharedUpworkHistoryManifest(manifestPath, {
            actorId,
            runId: provenance.runId,
            datasetId: provenance.datasetId,
            sourceWindow: { from, to },
            page: {
              number: 1,
              size: 1000,
              nextCursor: last == null ? null : { postedAt: last.postedAt.toISOString(), externalUpworkId: last.externalUpworkId },
            },
            items: rows,
          });
          await catalog.saveProtected(rows, provenance);
        },
      },
    );
    return await importer.importOnce();
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
