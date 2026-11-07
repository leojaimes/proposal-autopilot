import { runMarketRadarCoverageGapPlan } from './market-radar-coverage-gap-plan.cli';
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

function required(environment: Record<string, string | undefined>, name: string): string {
  const value = environment[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function readMarketRadarCoverageGapPlanOperationInput(environment: Record<string, string | undefined>): {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInputJson: string;
  maxItems: string;
} {
  const actorInputJson = required(environment, 'APIFY_ACTOR_INPUT_JSON');
  const maxItems = required(environment, 'APIFY_MAX_ITEMS');
  JSON.parse(actorInputJson);

  if (!Number.isInteger(Number(maxItems)) || Number(maxItems) <= 0) {
    throw new Error('max items must be a positive integer');
  }

  return {
    coverageWindowId: required(environment, 'MARKET_RADAR_COVERAGE_WINDOW_ID'),
    segment: required(environment, 'APIFY_SEGMENT') as MarketRadarSegment,
    queryFingerprint: required(environment, 'APIFY_QUERY_FINGERPRINT'),
    actorInputJson,
    maxItems,
  };
}

export async function runMarketRadarCoverageGapPlanOperation<Result>(input: {
  environment: Record<string, string | undefined>;
  command: CoverageGapPlanCommand<Result>;
}): Promise<Result> {
  const operationInput = readMarketRadarCoverageGapPlanOperationInput(input.environment);

  return runMarketRadarCoverageGapPlan({
    ...operationInput,
    command: input.command,
  });
}
