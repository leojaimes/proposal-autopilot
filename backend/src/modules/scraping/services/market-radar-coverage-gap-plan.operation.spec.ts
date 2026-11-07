import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readMarketRadarCoverageGapPlanOperationInput,
  runMarketRadarCoverageGapPlanOperation,
} from './market-radar-coverage-gap-plan.operation';

test('parses complete validated operation input without an execution command', () => {
  assert.deepEqual(readMarketRadarCoverageGapPlanOperationInput({
    MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
    APIFY_SEGMENT: 'translation',
    APIFY_QUERY_FINGERPRINT: 'translation:approved',
    APIFY_ACTOR_INPUT_JSON: '{"limit":1000,"category_name":"Translation"}',
    APIFY_MAX_ITEMS: '1000',
  }), {
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    actorInputJson: '{"limit":1000,"category_name":"Translation"}',
    maxItems: '1000',
  });
});

test('rejects missing actor input before creating Prisma', async () => {
  let invoked = false;

  await assert.rejects(
    runMarketRadarCoverageGapPlanOperation({
      environment: {
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'translation',
        APIFY_QUERY_FINGERPRINT: 'translation:approved',
        APIFY_MAX_ITEMS: '1000',
      },
      command: {
        async execute() {
          invoked = true;
          return { state: 'unexpected' };
        },
      },
    }),
    /APIFY_ACTOR_INPUT_JSON is required/,
  );

  assert.equal(invoked, false);
});

test('rejects an invalid max-items value before creating Prisma', async () => {
  let invoked = false;

  await assert.rejects(
    runMarketRadarCoverageGapPlanOperation({
      environment: {
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'translation',
        APIFY_QUERY_FINGERPRINT: 'translation:approved',
        APIFY_ACTOR_INPUT_JSON: '{"limit":1000}',
        APIFY_MAX_ITEMS: '0',
      },
      command: {
        async execute() {
          invoked = true;
          return { state: 'unexpected' };
        },
      },
    }),
    /max items must be a positive integer/,
  );

  assert.equal(invoked, false);
});
