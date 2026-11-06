import { MarketRadarSegment } from './market-radar-coverage-window';

type LastCoveragePageRepository = {
  loadLastPage(coverageWindowId: string, segment: MarketRadarSegment): Promise<{ outputCursor: string | null } | null>;
  recordPage?(page: CompletedCoveragePage): Promise<unknown>;
};

type CoverageRequest = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
};

type CompletedCoveragePage = CoverageRequest & {
  actorInput: Record<string, unknown>;
  inputCursor: string | null;
  outputCursor: string | null;
  apifyRunId: string;
  apifyDatasetId: string;
  oldestObservedAt: Date;
};

export class MarketRadarCoverageRunner {
  constructor(private readonly coveragePages: LastCoveragePageRepository) {}

  async prepareNextRequest(request: CoverageRequest) {
    const lastPage = await this.coveragePages.loadLastPage(request.coverageWindowId, request.segment);
    return { ...request, inputCursor: lastPage?.outputCursor ?? null };
  }

  async recordCompletedPage(page: CompletedCoveragePage) {
    if (!this.coveragePages.recordPage) {
      throw new Error('coverage page repository cannot record pages');
    }
    if (!page.actorInput || Object.keys(page.actorInput).length === 0) {
      throw new Error('canonical actor input is required');
    }
    if (!(page.oldestObservedAt instanceof Date) || Number.isNaN(page.oldestObservedAt.valueOf())) {
      throw new Error('oldest job posting date is required');
    }
    return this.coveragePages.recordPage(page);
  }
}
