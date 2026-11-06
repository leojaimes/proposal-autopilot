import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoveragePreflightService } from './market-radar-coverage-preflight.service';

test('returns covered when the latest coverage page is terminal for the canonical search', async () => {
  const service = new MarketRadarCoveragePreflightService({
    async loadLastPageForQuery() {
      return { outputCursor: null };
    },
  });

  const decision = await service.resolve({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
  });

  assert.deepEqual(decision, { state: 'covered' });
});

test('returns continuation when the latest coverage page exposes a next cursor', async () => {
  const service = new MarketRadarCoveragePreflightService({
    async loadLastPageForQuery() {
      return { outputCursor: 'resume-from-here' };
    },
  });

  const decision = await service.resolve({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
  });

  assert.deepEqual(decision, { state: 'continue', inputCursor: 'resume-from-here' });
});

test('returns uncovered when no coverage page exists for the search window', async () => {
  const service = new MarketRadarCoveragePreflightService({
    async loadLastPageForQuery() {
      return null;
    },
  });

  const decision = await service.resolve({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:2026-10-22',
  });

  assert.deepEqual(decision, { state: 'uncovered' });
});

test('returns uncovered when the coverage belongs to a different query fingerprint', async () => {
  const requests: unknown[] = [];
  const service = new MarketRadarCoveragePreflightService({
    async loadLastPageForQuery(request) {
      requests.push(request);
      return null;
    },
  });

  const decision = await service.resolve({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:different-filter',
  });

  assert.deepEqual(requests, [{
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:different-filter',
  }]);
  assert.deepEqual(decision, { state: 'uncovered' });
});
