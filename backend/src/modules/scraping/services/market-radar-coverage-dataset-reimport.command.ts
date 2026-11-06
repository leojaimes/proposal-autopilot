import { MarketRadarSegment } from './market-radar-coverage-window';

type DatasetReimporter = {
  reimport(request: { coverageWindowId: string; segment: MarketRadarSegment }): Promise<{
    datasetId: string;
    newJobs: number;
    newSegmentAssignments: number;
  }>;
};

export class MarketRadarCoverageDatasetReimportCommand {
  constructor(private readonly reimporter: DatasetReimporter) {}

  execute(request: { coverageWindowId: string; segment: MarketRadarSegment }) {
    return this.reimporter.reimport(request);
  }
}
