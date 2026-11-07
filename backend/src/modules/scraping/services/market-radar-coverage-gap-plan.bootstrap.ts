import { runMarketRadarCoverageGapPlan } from './market-radar-coverage-gap-plan.cli';
import { readMarketRadarCoverageGapPlanOperationInput } from './market-radar-coverage-gap-plan.operation';
import { MarketRadarSegment } from './market-radar-coverage-window';

type PrismaConnection = {
  $disconnect(): Promise<unknown>;
};

type CoverageGapPlanCommand<Result> = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    maxItems: number;
  }): Promise<Result>;
};

export async function runMarketRadarCoverageGapPlanBootstrap<Prisma extends PrismaConnection, Result>(input: {
  environment: Record<string, string | undefined>;
  createPrisma(): Prisma;
  createCommand(prisma: Prisma): CoverageGapPlanCommand<Result>;
}): Promise<Result> {
  const operationInput = readMarketRadarCoverageGapPlanOperationInput(input.environment);
  const prisma = input.createPrisma();

  try {
    return await runMarketRadarCoverageGapPlan({
      ...operationInput,
      command: input.createCommand(prisma),
    });
  } finally {
    await prisma.$disconnect();
  }
}
