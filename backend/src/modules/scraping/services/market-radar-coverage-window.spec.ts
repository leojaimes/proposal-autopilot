import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createFifteenDayCoverageWindow,
  createCoverageDailyBuckets,
  hasSegmentCoverageReachedWindowStart,
  MARKET_RADAR_SEGMENTS,
  recordCoveragePage,
  recordNextCoveragePage,
} from './market-radar-coverage-window';

test('creates a fifteen day window for each market segment', () => {
  const window = createFifteenDayCoverageWindow(new Date('2026-11-05T23:59:59.999Z'));

  assert.equal(window.startAt.toISOString(), '2026-10-22T00:00:00.000Z');
  assert.equal(window.endAt.toISOString(), '2026-11-05T23:59:59.999Z');
  assert.deepEqual(window.segments, [
    'social-media-content', 'translation', 'ux-ui', 'n8n-automation', 'gohighlevel',
    'ux-research', 'aeo-geo', 'ai-prototyping', 'design-systems',
  ]);
});

test('records a page with query fingerprint and cursor chain', () => {
  const page = recordCoveragePage({
    segment: 'social-media-content',
    queryFingerprint: 'social-media-content:2026-10-22',
    inputCursor: null,
    outputCursor: 'next-page',
    runId: 'run-1',
    datasetId: 'dataset-1',
  });

  assert.deepEqual(page, {
    segment: 'social-media-content',
    queryFingerprint: 'social-media-content:2026-10-22',
    inputCursor: null,
    outputCursor: 'next-page',
    runId: 'run-1',
    datasetId: 'dataset-1',
  });
});

test('rejects a page when its cursor does not continue the previous page', () => {
  const previous = recordCoveragePage({
    segment: 'translation', queryFingerprint: 'translation:2026-10-22', inputCursor: null,
    outputCursor: 'expected-next-page', runId: 'run-1', datasetId: 'dataset-1',
  });
  const next = {
    segment: 'translation' as const, queryFingerprint: 'translation:2026-10-22', inputCursor: 'other-page',
    outputCursor: null, runId: 'run-2', datasetId: 'dataset-2',
  };

  assert.throws(() => recordNextCoveragePage(previous, next), /cursor does not continue the previous page/);
});

test('marks a segment complete only after crossing the window start', () => {
  const window = createFifteenDayCoverageWindow(new Date('2026-11-05T23:59:59.999Z'));

  assert.equal(hasSegmentCoverageReachedWindowStart(window, new Date('2026-10-22T00:00:00.000Z')), true);
  assert.equal(hasSegmentCoverageReachedWindowStart(window, new Date('2026-10-22T00:00:00.001Z')), false);
});

test('creates fifteen daily buckets including zero count days', () => {
  const window = createFifteenDayCoverageWindow(new Date('2026-11-05T23:59:59.999Z'));
  const buckets = createCoverageDailyBuckets(window, {
    '2026-10-22': 3,
    '2026-11-05': 1,
  });

  assert.equal(buckets.length, 15);
  assert.deepEqual(buckets[1], { day: '2026-10-23', count: 0 });
  assert.deepEqual(buckets[14], { day: '2026-11-05', count: 1 });
});
