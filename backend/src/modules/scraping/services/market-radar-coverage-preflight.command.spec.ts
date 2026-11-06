import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoveragePreflightCommand } from './market-radar-coverage-preflight.command';

test('reports covered for a terminal matching coverage chain', async () => {
  const command = new MarketRadarCoveragePreflightCommand({
    async resolve() {
      return { state: 'covered' as const };
    },
  });

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
    }),
    { state: 'covered' },
  );
});

test('reports continuation with the exact saved cursor for a partial matching chain', async () => {
  const command = new MarketRadarCoveragePreflightCommand({
    async resolve() {
      return { state: 'continue' as const, inputCursor: 'resume-from-here' };
    },
  });

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
    }),
    { state: 'continue', inputCursor: 'resume-from-here' },
  );
});

test('reports uncovered when no matching coverage exists', async () => {
  const command = new MarketRadarCoveragePreflightCommand({
    async resolve() {
      return { state: 'uncovered' as const };
    },
  });

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
    }),
    { state: 'uncovered' },
  );
});
