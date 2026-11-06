import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { readApifyDatasetPages } from '../src/modules/scraping/services/apify-dataset-reader';
import { ApifyLiveDatasetImporter } from '../src/modules/scraping/services/apify-live-dataset-importer';
import { MarketRadarCoverageChainReimportCommand } from '../src/modules/scraping/services/market-radar-coverage-chain-reimport.command';
import { runMarketRadarCoverageDatasetReimport } from '../src/modules/scraping/services/market-radar-coverage-dataset-reimport.cli';
import { MarketRadarCoverageChainReimportService } from '../src/modules/scraping/services/market-radar-coverage-chain-reimport.service';
import { PrismaMarketRadarCoverageRepository } from '../src/modules/scraping/services/prisma-market-radar-coverage.repository';
import { PrismaSharedUpworkCatalogRepository } from '../src/modules/scraping/services/prisma-shared-upwork-catalog.repository';
import { MarketRadarSegment } from '../src/modules/scraping/services/market-radar-coverage-window';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const token = required('APIFY_TOKEN');
  const coverageWindowId = required('MARKET_RADAR_COVERAGE_WINDOW_ID');
  const segment = required('APIFY_SEGMENT') as MarketRadarSegment;
  const queryFingerprint = required('APIFY_QUERY_FINGERPRINT');
  const prisma = new PrismaClient();
  try {
    const coveragePages = new PrismaMarketRadarCoverageRepository(prisma);
    const catalog = new PrismaSharedUpworkCatalogRepository(prisma);
    const importer = new ApifyLiveDatasetImporter(token, readApifyDatasetPages, catalog);
    const reimporter = new MarketRadarCoverageChainReimportService(coveragePages, importer);
    const command = new MarketRadarCoverageChainReimportCommand(reimporter);
    return runMarketRadarCoverageDatasetReimport({ token, coverageWindowId, segment, queryFingerprint, command });
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
