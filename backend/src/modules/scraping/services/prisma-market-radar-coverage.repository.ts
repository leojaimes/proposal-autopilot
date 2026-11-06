import { Prisma, PrismaClient } from '@prisma/client';
import { MarketRadarSegment } from './market-radar-coverage-window';

type CoveragePageToRecord = {
  coverageWindowId: string;
  segment: MarketRadarSegment;
  queryFingerprint: string;
  actorInput?: Prisma.InputJsonValue;
  inputCursor: string | null;
  outputCursor: string | null;
  apifyRunId: string;
  apifyDatasetId: string;
  oldestObservedAt: Date;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export class PrismaMarketRadarCoverageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordPage(page: CoveragePageToRecord) {
    const previous = await this.prisma.marketRadarCoveragePage.findFirst({
      where: { coverageWindowId: page.coverageWindowId, segment: page.segment },
      orderBy: { recordedAt: 'desc' },
    });
    if (previous && previous.outputCursor !== page.inputCursor) {
      throw new Error('cursor does not continue the previous page');
    }
    if (previous && previous.queryFingerprint !== page.queryFingerprint) {
      throw new Error('coverage chain contains inconsistent query fingerprints');
    }
    if (previous?.actorInput && stableJson(previous.actorInput) !== stableJson(page.actorInput)) {
      throw new Error('actor input does not match the coverage chain');
    }
    return this.prisma.marketRadarCoveragePage.create({ data: page });
  }

  async loadLastPage(coverageWindowId: string, segment: MarketRadarSegment) {
    return this.prisma.marketRadarCoveragePage.findFirst({
      where: { coverageWindowId, segment },
      orderBy: { oldestObservedAt: 'asc' },
    });
  }

  async loadLastPageForQuery(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }) {
    const pages = await this.prisma.marketRadarCoveragePage.findMany({
      where: { coverageWindowId: request.coverageWindowId, segment: request.segment },
      orderBy: { oldestObservedAt: 'asc' },
      select: { outputCursor: true, queryFingerprint: true },
    });
    if (!pages.some((page) => page.queryFingerprint === request.queryFingerprint)) return null;
    if (pages.some((page) => page.queryFingerprint !== request.queryFingerprint)) {
      throw new Error('coverage chain contains inconsistent query fingerprints');
    }
    return pages.at(0) ?? null;
  }

  async loadLatestCompletedPage(coverageWindowId: string, segment: MarketRadarSegment) {
    return this.prisma.marketRadarCoveragePage.findFirst({
      where: { coverageWindowId, segment, outputCursor: null },
      orderBy: { recordedAt: 'desc' },
      select: { apifyDatasetId: true, apifyRunId: true, actorInput: true },
    }).then((page) => page == null ? null : {
      datasetId: page.apifyDatasetId,
      runId: page.apifyRunId,
      actorInput: page.actorInput,
    });
  }

  async loadCompletedPages(request: {
    coverageWindowId: string;
    segment: MarketRadarSegment;
    queryFingerprint: string;
  }) {
    const pages = await this.prisma.marketRadarCoveragePage.findMany({
      where: { coverageWindowId: request.coverageWindowId, segment: request.segment },
      orderBy: { recordedAt: 'asc' },
      select: { apifyDatasetId: true, apifyRunId: true, actorInput: true, outputCursor: true, queryFingerprint: true },
    });
    if (!pages.some((page) => page.queryFingerprint === request.queryFingerprint)) return [];
    if (pages.some((page) => page.queryFingerprint !== request.queryFingerprint)) {
      throw new Error('coverage chain contains inconsistent query fingerprints');
    }
    if (pages.at(-1)?.outputCursor !== null) return [];
    return pages.map((page) => ({
      datasetId: page.apifyDatasetId,
      runId: page.apifyRunId,
      actorInput: page.actorInput,
    }));
  }
}
