import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { runMarketRadarCoverageGapPlanBootstrap } from '../src/modules/scraping/services/market-radar-coverage-gap-plan.bootstrap';
import { MarketRadarCoverageGapPlanCommand } from '../src/modules/scraping/services/market-radar-coverage-gap-plan.command';
import { MarketRadarGapPlanService } from '../src/modules/scraping/services/market-radar-gap-plan.service';
import { MarketRadarCoveragePreflightCommand } from '../src/modules/scraping/services/market-radar-coverage-preflight.command';
import { MarketRadarCoveragePreflightService } from '../src/modules/scraping/services/market-radar-coverage-preflight.service';
import { PrismaMarketRadarCoverageRepository } from '../src/modules/scraping/services/prisma-market-radar-coverage.repository';

async function main() {
  return runMarketRadarCoverageGapPlanBootstrap({
    environment: process.env,
    createPrisma: () => new PrismaClient(),
    createCommand(prisma) {
      const coveragePages = new PrismaMarketRadarCoverageRepository(prisma);
      const preflight = new MarketRadarCoveragePreflightService(coveragePages);
      return new MarketRadarCoverageGapPlanCommand(
        new MarketRadarCoveragePreflightCommand(preflight),
        new MarketRadarGapPlanService(),
      );
    },
  });
}

main()
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
