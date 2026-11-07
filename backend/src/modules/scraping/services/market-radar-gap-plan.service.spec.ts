import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarGapPlanService } from './market-radar-gap-plan.service';

test('returns a zero-cost no-op plan for covered coverage', () => {
  const service = new MarketRadarGapPlanService();

  assert.deepEqual(
    service.create({
      decision: { state: 'covered' },
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

test('returns an approval-required continuation plan with the exact cursor and USD 1 cap', () => {
  const service = new MarketRadarGapPlanService();

  assert.deepEqual(
    service.create({
      decision: { state: 'continue', inputCursor: 'after-page-12' },
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

test('returns an approval-required initial plan with USD 1 cap for uncovered coverage', () => {
  const service = new MarketRadarGapPlanService();

  assert.deepEqual(
    service.create({
      decision: { state: 'uncovered' },
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
