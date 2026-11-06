import { MarketRadarSegment } from './market-radar-coverage-window';

type CoveragePageRepository = {
  loadLastPageForQuery(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }): Promise<{ outputCursor: string | null } | null>;
};

type CoveragePreflightRequest = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
};

export class MarketRadarCoveragePreflightService {
  constructor(private readonly coveragePages: CoveragePageRepository) {}

  async resolve(
    request: CoveragePreflightRequest,
  ): Promise<{ state: 'covered' } | { state: 'continue'; inputCursor: string } | { state: 'uncovered' }> {
    const latestPage = await this.coveragePages.loadLastPageForQuery(request);
    if (latestPage == null) {
      return { state: 'uncovered' };
    }
    if (latestPage?.outputCursor) {
      return { state: 'continue', inputCursor: latestPage.outputCursor };
    }
    return { state: 'covered' };
  }
}
