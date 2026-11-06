import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { MarketRadarCoveragePreflightCommand } from '../src/modules/scraping/services/market-radar-coverage-preflight.command';
import { runMarketRadarCoveragePreflight } from '../src/modules/scraping/services/market-radar-coverage-preflight.cli';
import { MarketRadarCoveragePreflightService } from '../src/modules/scraping/services/market-radar-coverage-preflight.service';
import { MarketRadarSegment } from '../src/modules/scraping/services/market-radar-coverage-window';
import { PrismaMarketRadarCoverageRepository } from '../src/modules/scraping/services/prisma-market-radar-coverage.repository';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const coverageWindowId = required('MARKET_RADAR_COVERAGE_WINDOW_ID');
  const segment = required('APIFY_SEGMENT') as MarketRadarSegment;
  const queryFingerprint = required('APIFY_QUERY_FINGERPRINT');
  const prisma = new PrismaClient();
  try {
    const coveragePages = new PrismaMarketRadarCoverageRepository(prisma);
    const preflight = new MarketRadarCoveragePreflightService(coveragePages);
    const command = new MarketRadarCoveragePreflightCommand(preflight);
    return runMarketRadarCoveragePreflight({ coverageWindowId, segment, queryFingerprint, command });
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
