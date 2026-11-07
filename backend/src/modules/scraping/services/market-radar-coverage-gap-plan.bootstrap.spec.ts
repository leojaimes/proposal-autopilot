import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMarketRadarCoverageGapPlanBootstrap } from './market-radar-coverage-gap-plan.bootstrap';

test('rejects invalid input before creating Prisma', async () => {
  let prismaCreated = false;

  await assert.rejects(
    runMarketRadarCoverageGapPlanBootstrap({
      environment: {
        MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
        APIFY_SEGMENT: 'translation',
        APIFY_QUERY_FINGERPRINT: 'translation:approved',
        APIFY_MAX_ITEMS: '1000',
      },
      createPrisma() {
        prismaCreated = true;
        return { async $disconnect() {} };
      },
      createCommand() {
        return { async execute() { return { state: 'unexpected' }; } };
      },
    }),
    /APIFY_ACTOR_INPUT_JSON is required/,
  );

  assert.equal(prismaCreated, false);
});

test('creates Prisma after valid input and returns the complete plan', async () => {
  let prismaCreated = false;
  let received: unknown;
  const plan = { state: 'uncovered', maxTotalChargeUsd: 1, approvalRequired: true };

  const result = await runMarketRadarCoverageGapPlanBootstrap({
    environment: {
      MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
      APIFY_SEGMENT: 'translation',
      APIFY_QUERY_FINGERPRINT: 'translation:approved',
      APIFY_ACTOR_INPUT_JSON: '{"limit":1000}',
      APIFY_MAX_ITEMS: '1000',
    },
    createPrisma() {
      prismaCreated = true;
      return { async $disconnect() {} };
    },
    createCommand() {
      return {
        async execute(request) {
          received = request;
          return plan;
        },
      };
    },
  });

  assert.equal(prismaCreated, true);
  assert.deepEqual(result, plan);
  assert.deepEqual(received, {
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    actorInput: { limit: 1000 },
    maxItems: 1000,
  });
});

test('disconnects Prisma after the plan completes', async () => {
  let disconnected = false;

  await runMarketRadarCoverageGapPlanBootstrap({
    environment: {
      MARKET_RADAR_COVERAGE_WINDOW_ID: 'window-1',
      APIFY_SEGMENT: 'translation',
      APIFY_QUERY_FINGERPRINT: 'translation:approved',
      APIFY_ACTOR_INPUT_JSON: '{"limit":1000}',
      APIFY_MAX_ITEMS: '1000',
    },
    createPrisma() {
      return {
        async $disconnect() {
          disconnected = true;
        },
      };
    },
    createCommand() {
      return { async execute() { return { state: 'covered' }; } };
    },
  });

  assert.equal(disconnected, true);
});
