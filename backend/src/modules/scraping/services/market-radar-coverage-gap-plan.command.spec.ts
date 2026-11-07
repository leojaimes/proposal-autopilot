import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoverageGapPlanCommand } from './market-radar-coverage-gap-plan.command';
import { MarketRadarGapPlanService } from './market-radar-gap-plan.service';

test('returns a zero-cost no-op plan when coverage is complete', async () => {
  const command = new MarketRadarCoverageGapPlanCommand(
    {
      async execute() {
        return { state: 'covered' as const };
      },
    },
    new MarketRadarGapPlanService(),
  );

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1',
      segment: 'translation',
      queryFingerprint: 'translation:approved',
      actorInput: { limit: 1000, category_name: 'Translation' },
      maxItems: 1000,
    }),
    {
      state: 'covered',
      actorInput: null,
      inputCursor: null,
      maxItems: null,
      maxTotalChargeUsd: 0,
      approvalRequired: false,
    },
  );
});

test('returns the exact continuation cursor and approval-required USD 1 plan', async () => {
  const command = new MarketRadarCoverageGapPlanCommand(
    {
      async execute() {
        return { state: 'continue' as const, inputCursor: 'after-page-12' };
      },
    },
    new MarketRadarGapPlanService(),
  );

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1',
      segment: 'translation',
      queryFingerprint: 'translation:approved',
      actorInput: { limit: 1000, category_name: 'Translation' },
      maxItems: 1000,
    }),
    {
      state: 'continue',
      actorInput: { limit: 1000, category_name: 'Translation' },
      inputCursor: 'after-page-12',
      maxItems: 1000,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    },
  );
});

test('returns an approval-required initial USD 1 plan when coverage is missing', async () => {
  const command = new MarketRadarCoverageGapPlanCommand(
    {
      async execute() {
        return { state: 'uncovered' as const };
      },
    },
    new MarketRadarGapPlanService(),
  );

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1',
      segment: 'translation',
      queryFingerprint: 'translation:approved',
      actorInput: { limit: 1000, category_name: 'Translation' },
      maxItems: 1000,
    }),
    {
      state: 'uncovered',
      actorInput: { limit: 1000, category_name: 'Translation' },
      inputCursor: null,
      maxItems: 1000,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    },
  );
});
