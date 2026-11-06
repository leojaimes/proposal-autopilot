import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMarketRadarCoveragePreflight } from './market-radar-coverage-preflight.cli';

test('runs the internal preflight script without requiring an Apify token', async () => {
  const requests: unknown[] = [];
  const result = await runMarketRadarCoveragePreflight({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    command: {
      async execute(request) {
        requests.push(request);
        return { state: 'covered' as const };
      },
    },
  });

  assert.deepEqual(requests, [{
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
  }]);
  assert.deepEqual(result, { state: 'covered' });
});

test('fails before opening the database when window, segment or fingerprint is missing', async () => {
  let calls = 0;

  await assert.rejects(
    runMarketRadarCoveragePreflight({
      coverageWindowId: 'window-1',
      segment: 'translation',
      queryFingerprint: '',
      command: {
        async execute() {
          calls += 1;
          return { state: 'covered' as const };
        },
      },
    }),
    /query fingerprint is required/,
  );

  assert.equal(calls, 0);
});
