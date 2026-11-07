import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ApifyActorRunClient } from '../src/modules/scraping/services/apify-actor-run.client';
import { readApifyDatasetPages } from '../src/modules/scraping/services/apify-dataset-reader';
import { ApifyRunOutputReader } from '../src/modules/scraping/services/apify-run-output.reader';
import { createMarketRadarApprovedPageCommand } from '../src/modules/scraping/services/market-radar-approved-page.factory';
import { MarketRadarApprovedPageLauncher } from '../src/modules/scraping/services/market-radar-approved-page.launcher';
import { MarketRadarApifyPageClient } from '../src/modules/scraping/services/market-radar-apify-page.client';
import { MarketRadarCoverageGapPlanCommand } from '../src/modules/scraping/services/market-radar-coverage-gap-plan.command';
import { MarketRadarCoveragePreflightCommand } from '../src/modules/scraping/services/market-radar-coverage-preflight.command';
import { MarketRadarCoveragePreflightService } from '../src/modules/scraping/services/market-radar-coverage-preflight.service';
import { readMarketRadarCoverageGapPlanOperationInput } from '../src/modules/scraping/services/market-radar-coverage-gap-plan.operation';
import { MarketRadarGapPlanService } from '../src/modules/scraping/services/market-radar-gap-plan.service';
import { PrismaMarketRadarCoverageRepository } from '../src/modules/scraping/services/prisma-market-radar-coverage.repository';
import { PrismaSharedUpworkCatalogRepository } from '../src/modules/scraping/services/prisma-shared-upwork-catalog.repository';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const operation = readMarketRadarCoverageGapPlanOperationInput(process.env);
  const postFilterText = required('APIFY_TEXT_MATCH');
  const prisma = new PrismaClient();
  try {
    const coveragePages = new PrismaMarketRadarCoverageRepository(prisma);
    const catalog = new PrismaSharedUpworkCatalogRepository(prisma);
    const gapPlan = new MarketRadarCoverageGapPlanCommand(
      new MarketRadarCoveragePreflightCommand(new MarketRadarCoveragePreflightService(coveragePages)),
      new MarketRadarGapPlanService(),
    );
    const launcher = new MarketRadarApprovedPageLauncher(gapPlan, {
      readToken: () => required('APIFY_TOKEN'),
      createCommand: (token) => createMarketRadarApprovedPageCommand({
        token,
        coveragePages,
        catalog,
        readDataset: readApifyDatasetPages,
        pageClient: new MarketRadarApifyPageClient(
          new ApifyActorRunClient(token),
          new ApifyRunOutputReader(token),
        ),
      }),
    });
    return launcher.execute({
      ...operation,
      actorInput: JSON.parse(operation.actorInputJson) as Record<string, unknown>,
      maxItems: Number(operation.maxItems),
      postFilterText,
    });
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
