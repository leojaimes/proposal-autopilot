import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('preflight script fails before Prisma when APIFY_ACTOR_INPUT_JSON is blank', () => {
  const result = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', resolve(__dirname, 'preflight-market-radar-coverage.ts')],
    {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/proposal_autopilot_db?schema=public',
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'translation',
        APIFY_QUERY_FINGERPRINT: 'translation:approved',
        APIFY_ACTOR_INPUT_JSON: '',
        APIFY_MAX_ITEMS: '1000',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APIFY_ACTOR_INPUT_JSON is required/);
});

test('preflight script compiles with the concrete Prisma factory and the gap-plan bootstrap', () => {
  const result = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register', resolve(__dirname, 'preflight-market-radar-coverage.ts')],
    {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/proposal_autopilot_db?schema=public',
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'translation',
        APIFY_QUERY_FINGERPRINT: 'translation:approved',
        APIFY_ACTOR_INPUT_JSON: '',
        APIFY_MAX_ITEMS: '1000',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APIFY_ACTOR_INPUT_JSON is required/);
});
