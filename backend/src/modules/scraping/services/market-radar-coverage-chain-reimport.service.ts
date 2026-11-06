import { MarketRadarSegment } from './market-radar-coverage-window';

type CompletedCoveragePageRepository = {
  loadCompletedPages(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<Array<{ datasetId: string; runId: string; actorInput: unknown }>>;
};

type SharedCatalogDatasetImporter = {
  importDataset(input: {
    datasetId: string;
    runId: string;
    segment: string;
    postFilterText: string | null;
  }): Promise<{ newJobs: number; newSegmentAssignments: number }>;
};

export class MarketRadarCoverageChainReimportService {
  constructor(
    private readonly coveragePages: CompletedCoveragePageRepository,
    private readonly importer: SharedCatalogDatasetImporter,
  ) {}

  async reimport(request: { coverageWindowId: string; segment: MarketRadarSegment; queryFingerprint: string }) {
    const pages = await this.coveragePages.loadCompletedPages(request);
    const importedPages = [];
    let newJobs = 0;
    let newSegmentAssignments = 0;

    for (const page of pages) {
      if (!page.actorInput || typeof page.actorInput !== 'object' || Array.isArray(page.actorInput)) {
        throw new Error(`canonical actor input is required for dataset ${page.datasetId}`);
      }
      const postFilter = (page.actorInput as Record<string, unknown>).post_filter_text;
      let imported: { newJobs: number; newSegmentAssignments: number };
      try {
        imported = await this.importer.importDataset({
          datasetId: page.datasetId,
          runId: page.runId,
          segment: request.segment,
          postFilterText: typeof postFilter === 'string' ? postFilter : null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`${page.datasetId}: ${message}`);
      }
      importedPages.push({ datasetId: page.datasetId, ...imported });
      newJobs += imported.newJobs;
      newSegmentAssignments += imported.newSegmentAssignments;
    }

    return { pages: importedPages, total: { newJobs, newSegmentAssignments } };
  }
}
