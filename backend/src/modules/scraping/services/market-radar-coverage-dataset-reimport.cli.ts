import { MarketRadarSegment } from './market-radar-coverage-window';

type ReimportCommand<Result> = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<Result>;
};

export async function runMarketRadarCoverageDatasetReimport<Result>(input: {
  token?: string;
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  command: ReimportCommand<Result>;
}): Promise<Result> {
  if (!input.token?.trim()) throw new Error('APIFY_TOKEN is required');
  return input.command.execute({
    coverageWindowId: input.coverageWindowId,
    segment: input.segment,
    queryFingerprint: input.queryFingerprint,
  });
}
