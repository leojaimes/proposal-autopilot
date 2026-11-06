import { MarketRadarSegment } from './market-radar-coverage-window';

type PreflightCommand<Result> = {
  execute(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<Result>;
};

export async function runMarketRadarCoveragePreflight<Result>(input: {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  command: PreflightCommand<Result>;
}): Promise<Result> {
  if (!input.coverageWindowId.trim()) throw new Error('coverage window id is required');
  if (!input.segment.trim()) throw new Error('segment is required');
  if (!input.queryFingerprint.trim()) throw new Error('query fingerprint is required');
  return input.command.execute({
    coverageWindowId: input.coverageWindowId,
    segment: input.segment,
    queryFingerprint: input.queryFingerprint,
  });
}
