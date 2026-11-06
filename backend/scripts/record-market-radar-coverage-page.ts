import 'dotenv/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { MarketRadarSegment } from '../src/modules/scraping/services/market-radar-coverage-window';
import { PrismaMarketRadarCoverageRepository } from '../src/modules/scraping/services/prisma-market-radar-coverage.repository';

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Set ${name}.`);
  return value;
}

async function main() {
  const windowStartAt = new Date(required('MARKET_RADAR_WINDOW_START'));
  const windowEndAt = new Date(required('MARKET_RADAR_WINDOW_END'));
  const oldestObservedAt = new Date(required('APIFY_OLDEST_POSTED_AT'));
  if ([windowStartAt, windowEndAt, oldestObservedAt].some((date) => Number.isNaN(date.valueOf()))) {
    throw new Error('Use ISO timestamps for the coverage window and oldest posting date.');
  }
  const actorInput = JSON.parse(required('APIFY_ACTOR_INPUT_JSON')) as unknown;
  if (!actorInput || Array.isArray(actorInput) || typeof actorInput !== 'object') {
    throw new Error('APIFY_ACTOR_INPUT_JSON must be an object.');
  }
  const prisma = new PrismaClient();
  try {
    let window = await prisma.marketRadarCoverageWindow.findFirst({ where: { windowStartAt, windowEndAt } });
    if (!window) {
      window = await prisma.marketRadarCoverageWindow.create({ data: { windowStartAt, windowEndAt } });
    }
    const segment = required('APIFY_SEGMENT') as MarketRadarSegment;
    const inputCursor = process.env.APIFY_INPUT_CURSOR?.trim() || null;
    const existing = await prisma.marketRadarCoveragePage.count({ where: { coverageWindowId: window.id, segment } });
    if (existing && !inputCursor) throw new Error(`Coverage chain already exists for ${segment}.`);
    const page = await new PrismaMarketRadarCoverageRepository(prisma).recordPage({
      coverageWindowId: window.id,
      segment,
      queryFingerprint: required('APIFY_QUERY_FINGERPRINT'),
      actorInput: actorInput as Prisma.InputJsonValue,
      inputCursor,
      outputCursor: process.env.APIFY_OUTPUT_CURSOR?.trim() || null,
      apifyRunId: required('APIFY_RUN_ID'),
      apifyDatasetId: required('APIFY_DATASET_ID'),
      oldestObservedAt,
    });
    console.log(JSON.stringify({ coverageWindowId: window.id, pageId: page.id, outputCursor: page.outputCursor }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
