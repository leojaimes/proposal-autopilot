import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoverageRunner } from './market-radar-coverage-runner';

test('prepares an initial request without a cursor', async () => {
  const runner = new MarketRadarCoverageRunner({
    async loadLastPage() { return null; },
  });

  const request = await runner.prepareNextRequest({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
  });

  assert.deepEqual(request, {
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
    inputCursor: null,
  });
});

test('prepares a resumed request from the last saved cursor', async () => {
  const runner = new MarketRadarCoverageRunner({
    async loadLastPage() { return { outputCursor: 'resume-from-here' }; },
  });

  const request = await runner.prepareNextRequest({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
  });

  assert.equal(request.inputCursor, 'resume-from-here');
});

test('records completed page metadata as the next resume point', async () => {
  const recordedPages: unknown[] = [];
  const runner = new MarketRadarCoverageRunner({
    async loadLastPage() { return null; },
    async recordPage(page: unknown) { recordedPages.push(page); },
  });

  await runner.recordCompletedPage({
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
    actorInput: { limit: 1000, category_name: 'Translation' },
    inputCursor: null, outputCursor: 'next-page', apifyRunId: 'run-1', apifyDatasetId: 'dataset-1',
    oldestObservedAt: new Date('2026-10-25T00:00:00.000Z'),
  });

  assert.deepEqual(recordedPages, [{
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
    actorInput: { limit: 1000, category_name: 'Translation' },
    inputCursor: null, outputCursor: 'next-page', apifyRunId: 'run-1', apifyDatasetId: 'dataset-1',
    oldestObservedAt: new Date('2026-10-25T00:00:00.000Z'),
  }]);
});

test('rejects a completed page without its canonical actor input', async () => {
  const runner = new MarketRadarCoverageRunner({
    async loadLastPage() { return null; },
    async recordPage() { throw new Error('must not record'); },
  });

  await assert.rejects(
    runner.recordCompletedPage({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
      inputCursor: null, outputCursor: 'next-page', apifyRunId: 'run-1', apifyDatasetId: 'dataset-1',
      oldestObservedAt: new Date('2026-10-25T00:00:00.000Z'),
    }),
    /canonical actor input is required/,
  );
});

test('rejects a completed page without a valid oldest job posting date', async () => {
  const runner = new MarketRadarCoverageRunner({
    async loadLastPage() { return null; },
    async recordPage() { throw new Error('must not record'); },
  });

  await assert.rejects(
    runner.recordCompletedPage({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
      actorInput: { limit: 1000, category_name: 'Translation' },
      inputCursor: null, outputCursor: 'next-page', apifyRunId: 'run-1', apifyDatasetId: 'dataset-1',
      oldestObservedAt: new Date('invalid'),
    }),
    /oldest job posting date is required/,
  );
});
