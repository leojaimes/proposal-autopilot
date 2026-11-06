import { MarketRadarSegment } from './market-radar-coverage-window';

type CoverageChainReimporter = {
  reimport(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<{
    pages: Array<{ datasetId: string; newJobs: number; newSegmentAssignments: number }>;
    total: { newJobs: number; newSegmentAssignments: number };
  }>;
};

export class MarketRadarCoverageChainReimportCommand {
  constructor(private readonly reimporter: CoverageChainReimporter) {}

  execute(request: { coverageWindowId: string; segment: MarketRadarSegment; queryFingerprint: string }) {
    return this.reimporter.reimport(request);
  }
}
