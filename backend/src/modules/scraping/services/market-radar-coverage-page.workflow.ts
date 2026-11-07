import { findOldestApifyJobPostedAt } from './apify-dataset-reader';
import { MarketRadarSegment } from './market-radar-coverage-window';

type CoverageRequest = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInput: Record<string, unknown>;
  inputCursor?: string | null;
  postFilterText?: string | null;
  maxTotalChargeUsd?: number;
};

type RecordedCoveragePage = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInput: Record<string, unknown>;
  inputCursor: string | null;
  outputCursor: string | null;
  apifyRunId: string;
  apifyDatasetId: string;
  oldestObservedAt: Date;
};

type CoverageRunner = {
  prepareNextRequest(request: Omit<CoverageRequest, 'actorInput'>): Promise<{ inputCursor: string | null }>;
  recordCompletedPage(page: RecordedCoveragePage): Promise<unknown>;
};

type PageClient = {
  execute(input: Record<string, unknown>, options?: { maxTotalChargeUsd?: number }): Promise<{
    runId: string; datasetId: string; nextPage: string | null; isNotificationMode: boolean;
  }>;
};

type DatasetReader = { read(datasetId: string): Promise<Record<string, unknown>[]> };

type DatasetImporter = {
  importDataset(input: {
    datasetId: string; runId: string; segment: string; postFilterText: string | null;
  }): Promise<{ newJobs: number; newSegmentAssignments: number }>;
};

export class MarketRadarCoveragePageWorkflow {
  constructor(
    private readonly coverageRunner: CoverageRunner,
    private readonly pageClient: PageClient,
    private readonly datasetReader: DatasetReader,
    private readonly datasetImporter: DatasetImporter,
  ) {}

  async execute(request: CoverageRequest) {
    const prepared = request.inputCursor === undefined
      ? await this.coverageRunner.prepareNextRequest(request)
      : { inputCursor: request.inputCursor };
    const page = await this.pageClient.execute(
      {
        ...request.actorInput,
        ...(prepared.inputCursor ? { page_after: prepared.inputCursor } : {}),
      },
      request.maxTotalChargeUsd == null ? undefined : { maxTotalChargeUsd: request.maxTotalChargeUsd },
    );
    const oldestObservedAt = findOldestApifyJobPostedAt(await this.datasetReader.read(page.datasetId));
    if (!oldestObservedAt) throw new Error('dataset has no valid job posting dates');
    let imported: { newJobs: number; newSegmentAssignments: number };
    try {
      imported = await this.datasetImporter.importDataset({
        datasetId: page.datasetId,
        runId: page.runId,
        segment: request.segment,
        postFilterText: request.postFilterText ?? null,
      });
    } catch (error: unknown) {
      const recoverable = error instanceof Error ? error : new Error('catalog import failed');
      Object.assign(recoverable, { runId: page.runId, datasetId: page.datasetId });
      throw recoverable;
    }
    await this.coverageRunner.recordCompletedPage({
      coverageWindowId: request.coverageWindowId,
      segment: request.segment,
      queryFingerprint: request.queryFingerprint,
      actorInput: request.postFilterText
        ? { ...request.actorInput, post_filter_text: request.postFilterText }
        : request.actorInput,
      inputCursor: prepared.inputCursor, outputCursor: page.nextPage,
      apifyRunId: page.runId, apifyDatasetId: page.datasetId, oldestObservedAt,
    });
    return {
      state: 'completed' as const,
      runId: page.runId,
      datasetId: page.datasetId,
      inputCursor: prepared.inputCursor,
      outputCursor: page.nextPage,
      oldestObservedAt,
      newJobs: imported.newJobs,
      newSegmentAssignments: imported.newSegmentAssignments,
    };
  }
}
