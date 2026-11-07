import * as assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';

test('approved-page launcher rejects missing APIFY_TEXT_MATCH before Prisma or actor startup', () => {
  const result = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register/transpile-only', resolve(__dirname, 'run-approved-market-radar-page.ts')],
    {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/proposal_autopilot_db?schema=public',
        APIFY_TOKEN: 'test-token',
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'design-systems',
        APIFY_QUERY_FINGERPRINT: 'design-systems:2026-10-22:design-v1',
        APIFY_ACTOR_INPUT_JSON: '{"limit":1000}',
        APIFY_MAX_ITEMS: '1000',
        APIFY_TEXT_MATCH: '',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APIFY_TEXT_MATCH is required/);
});

test('approved-page launcher compiles with the historical page factory and USD cap', () => {
  const result = spawnSync(
    process.execPath,
    ['-r', 'ts-node/register', resolve(__dirname, 'run-approved-market-radar-page.ts')],
    {
      cwd: resolve(__dirname, '..'),
      encoding: 'utf8',
      timeout: 10_000,
      env: {
        ...process.env,
        DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:1/proposal_autopilot_db?schema=public',
        APIFY_TOKEN: 'test-token',
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'design-systems',
        APIFY_QUERY_FINGERPRINT: 'design-systems:2026-10-22:design-v1',
        APIFY_ACTOR_INPUT_JSON: '{"limit":1000}',
        APIFY_MAX_ITEMS: '1000',
        APIFY_TEXT_MATCH: '',
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /APIFY_TEXT_MATCH is required/);
});
