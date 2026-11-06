import { MarketRadarSegment } from './market-radar-coverage-window';

type PreflightDecision = { state: 'covered' } | { state: 'continue'; inputCursor: string } | { state: 'uncovered' };

type CoveragePreflight = {
  resolve(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<PreflightDecision>;
};

export class MarketRadarCoveragePreflightCommand {
  constructor(private readonly preflight: CoveragePreflight) {}

  execute(request: { coverageWindowId: string; segment: MarketRadarSegment; queryFingerprint: string }) {
    return this.preflight.resolve(request);
  }
}
