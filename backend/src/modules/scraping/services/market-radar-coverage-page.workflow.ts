import { findOldestApifyJobPostedAt } from './apify-dataset-reader';
import { MarketRadarSegment } from './market-radar-coverage-window';

type CoverageRequest = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInput: Record<string, unknown>;
};

type CoverageRunner = {
  prepareNextRequest(request: Omit<CoverageRequest, 'actorInput'>): Promise<{ inputCursor: string | null }>;
  recordCompletedPage(page: CoverageRequest & {
    inputCursor: string | null; outputCursor: string | null; apifyRunId: string;
    apifyDatasetId: string; oldestObservedAt: Date;
  }): Promise<unknown>;
};

type PageClient = {
  execute(input: Record<string, unknown>): Promise<{
    runId: string; datasetId: string; nextPage: string | null; isNotificationMode: boolean;
  }>;
};

type DatasetReader = { read(datasetId: string): Promise<Record<string, unknown>[]> };

export class MarketRadarCoveragePageWorkflow {
  constructor(
    private readonly coverageRunner: CoverageRunner,
    private readonly pageClient: PageClient,
    private readonly datasetReader: DatasetReader,
  ) {}

  async execute(request: CoverageRequest) {
    const prepared = await this.coverageRunner.prepareNextRequest(request);
    const page = await this.pageClient.execute({
      ...request.actorInput,
      ...(prepared.inputCursor ? { page_after: prepared.inputCursor } : {}),
    });
    const oldestObservedAt = findOldestApifyJobPostedAt(await this.datasetReader.read(page.datasetId));
    if (!oldestObservedAt) throw new Error('dataset has no valid job posting dates');
    await this.coverageRunner.recordCompletedPage({
      ...request, inputCursor: prepared.inputCursor, outputCursor: page.nextPage,
      apifyRunId: page.runId, apifyDatasetId: page.datasetId, oldestObservedAt,
    });
  }
}
