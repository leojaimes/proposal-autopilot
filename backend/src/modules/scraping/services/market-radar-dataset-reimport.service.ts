import { MarketRadarSegment } from './market-radar-coverage-window';

type CoveragePageRepository = {
  loadLatestCompletedPage(
    coverageWindowId: string,
    segment: MarketRadarSegment,
  ): Promise<{ datasetId: string; runId: string; actorInput: unknown } | null>;
};

type SharedCatalogDatasetImporter = {
  importDataset(input: {
    datasetId: string;
    runId: string;
    segment: string;
    postFilterText: string | null;
  }): Promise<{ newJobs: number; newSegmentAssignments: number }>;
};

export class MarketRadarDatasetReimportService {
  constructor(
    private readonly coveragePages: CoveragePageRepository,
    private readonly importer: SharedCatalogDatasetImporter,
  ) {}

  async reimport(request: { coverageWindowId: string; segment: MarketRadarSegment }) {
    const page = await this.coveragePages.loadLatestCompletedPage(
      request.coverageWindowId,
      request.segment,
    );
    if (page == null) throw new Error('no completed coverage page is available for reimport');
    if (!page.actorInput || typeof page.actorInput !== 'object' || Array.isArray(page.actorInput)) {
      throw new Error('canonical actor input is required for reimport');
    }
    const actorInput = page.actorInput as Record<string, unknown>;
    const postFilter = actorInput.post_filter_text;
    const imported = await this.importer.importDataset({
      datasetId: page.datasetId,
      runId: page.runId,
      segment: request.segment,
      postFilterText: typeof postFilter === 'string' ? postFilter : null,
    });
    return { datasetId: page.datasetId, ...imported };
  }
}
