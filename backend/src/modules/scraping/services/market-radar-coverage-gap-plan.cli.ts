import { MarketRadarSegment } from './market-radar-coverage-window';

type CoverageGapPlanCommand<Result> = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
    actorInput: Record<string, unknown>;
    maxItems: number;
  }): Promise<Result>;
};

export async function runMarketRadarCoverageGapPlan<Result>(input: {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInputJson: string;
  maxItems: string;
  command: CoverageGapPlanCommand<Result>;
}): Promise<Result> {
  const maxItems = Number(input.maxItems);
  if (!Number.isInteger(maxItems) || maxItems <= 0) {
    throw new Error('max items must be a positive integer');
  }

  return input.command.execute({
    coverageWindowId: input.coverageWindowId,
    segment: input.segment,
    queryFingerprint: input.queryFingerprint,
    actorInput: JSON.parse(input.actorInputJson) as Record<string, unknown>,
    maxItems,
  });
}
