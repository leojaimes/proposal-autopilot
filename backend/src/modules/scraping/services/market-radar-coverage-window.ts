export const MARKET_RADAR_SEGMENTS = [
  'social-media-content',
  'translation',
  'ux-ui',
  'n8n-automation',
  'gohighlevel',
  'ux-research',
  'aeo-geo',
  'ai-prototyping',
  'design-systems',
] as const;

export type MarketRadarSegment = (typeof MARKET_RADAR_SEGMENTS)[number];

export type MarketRadarCoverageWindow = {
  startAt: Date;
  endAt: Date;
  segments: readonly MarketRadarSegment[];
};

export type MarketRadarCoveragePage = {
  segment: MarketRadarSegment;
  queryFingerprint: string;
  inputCursor: string | null;
  outputCursor: string | null;
  runId: string;
  datasetId: string;
};

export function createFifteenDayCoverageWindow(endAt: Date): MarketRadarCoverageWindow {
  const startAt = new Date(Date.UTC(
    endAt.getUTCFullYear(),
    endAt.getUTCMonth(),
    endAt.getUTCDate() - 14,
  ));

  return { startAt, endAt, segments: MARKET_RADAR_SEGMENTS };
}

export function recordCoveragePage(page: MarketRadarCoveragePage): MarketRadarCoveragePage {
  return page;
}

export function recordNextCoveragePage(
  previous: MarketRadarCoveragePage,
  next: MarketRadarCoveragePage,
): MarketRadarCoveragePage {
  if (previous.outputCursor !== next.inputCursor) {
    throw new Error('cursor does not continue the previous page');
  }
  return recordCoveragePage(next);
}

export function hasSegmentCoverageReachedWindowStart(
  window: MarketRadarCoverageWindow,
  oldestObservedAt: Date,
): boolean {
  return oldestObservedAt <= window.startAt;
}

export function createCoverageDailyBuckets(
  window: MarketRadarCoverageWindow,
  countsByDay: Record<string, number>,
): Array<{ day: string; count: number }> {
  const buckets: Array<{ day: string; count: number }> = [];
  for (const day = new Date(window.startAt); day <= window.endAt; day.setUTCDate(day.getUTCDate() + 1)) {
    const key = day.toISOString().slice(0, 10);
    buckets.push({ day: key, count: countsByDay[key] ?? 0 });
  }
  return buckets;
}
