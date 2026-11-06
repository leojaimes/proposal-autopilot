import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { readApifyDatasetPages } from '../src/modules/scraping/services/apify-dataset-reader';
import { matchesApifyJobText } from '../src/modules/scraping/services/apify-job-text-matcher';
import { PrismaSharedUpworkCatalogRepository } from '../src/modules/scraping/services/prisma-shared-upwork-catalog.repository';

const actorId = 'hyperbach/upwork-scraper-ai' as const;
const runId = process.env.APIFY_RUN_ID;
const datasetId = process.env.APIFY_DATASET_ID;
const token = process.env.APIFY_TOKEN;
const sourceSegment = process.env.APIFY_SEGMENT?.trim();
const textMatch = process.env.APIFY_TEXT_MATCH?.trim();

function rowFromLivePayload(raw: Record<string, unknown>, segment: string) {
  if (typeof raw.id !== 'string' || typeof raw.url !== 'string' || typeof raw.date_posted !== 'string') return null;
  if (textMatch && !matchesApifyJobText(raw, textMatch)) return null;
  const postedAt = new Date(raw.date_posted);
  if (Number.isNaN(postedAt.valueOf())) return null;
  const observedAt = new Date(typeof raw.refreshed_at === 'string' ? raw.refreshed_at : String(raw.created_at ?? raw.date_posted));
  return {
    externalUpworkId: raw.id,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled Upwork job',
    description: typeof raw.description === 'string' ? raw.description : '',
    jobUrl: raw.url,
    postedAt,
    rawApifyPayload: raw as Prisma.InputJsonValue,
    sourceObservedAt: Number.isNaN(observedAt.valueOf()) ? postedAt : observedAt,
    sourceSegment: segment,
  };
}

async function main() {
  if (!runId || !datasetId || !token || !sourceSegment) throw new Error('Set APIFY_RUN_ID, APIFY_DATASET_ID, and APIFY_SEGMENT.');
  if (sourceSegment.length > 50) throw new Error('APIFY_SEGMENT must be 50 characters or fewer.');
  const prisma = new PrismaClient();
  try {
    const rows = (await readApifyDatasetPages(datasetId, token)).map((row) => rowFromLivePayload(row, sourceSegment)).filter((row): row is NonNullable<typeof row> => row != null);
    const result = await new PrismaSharedUpworkCatalogRepository(prisma).saveLive(rows, { actorId, runId, datasetId });
    return {
      received: rows.length,
      inserted: result.newJobs,
      newSegmentAssignments: result.newSegmentAssignments,
      runId,
      datasetId,
    };
  } finally {
    await prisma.$disconnect();
  }
}

main().then((result) => console.log(JSON.stringify(result))).catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
