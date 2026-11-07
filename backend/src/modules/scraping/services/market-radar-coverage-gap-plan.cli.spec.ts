import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMarketRadarCoverageGapPlan } from './market-radar-coverage-gap-plan.cli';

test('returns the computed plan for valid actor input and max items', async () => {
  let received: unknown;
  const plan = { state: 'uncovered', approvalRequired: true, maxTotalChargeUsd: 1 };

  const result = await runMarketRadarCoverageGapPlan({
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    actorInputJson: '{"limit":1000,"category_name":"Translation"}',
    maxItems: '1000',
    command: {
      async execute(request) {
        received = request;
        return plan;
      },
    },
  });

  assert.deepEqual(result, plan);
  assert.deepEqual(received, {
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    actorInput: { limit: 1000, category_name: 'Translation' },
    maxItems: 1000,
  });
});

test('rejects malformed actor input JSON before invoking the command', async () => {
  let invoked = false;

  await assert.rejects(
    runMarketRadarCoverageGapPlan({
      coverageWindowId: 'window-1',
      segment: 'translation',
      queryFingerprint: 'translation:approved',
      actorInputJson: '{not-json}',
      maxItems: '1000',
      command: {
        async execute() {
          invoked = true;
          return { state: 'unexpected' };
        },
      },
    }),
    SyntaxError,
  );

  assert.equal(invoked, false);
});

test('rejects a missing or non-positive max items value before invoking the command', async () => {
  let invocations = 0;
  const command = {
    async execute() {
      invocations += 1;
      return { state: 'unexpected' };
    },
  };

  for (const maxItems of ['', '0', '-1']) {
    await assert.rejects(
      runMarketRadarCoverageGapPlan({
        coverageWindowId: 'window-1',
        segment: 'translation',
        queryFingerprint: 'translation:approved',
        actorInputJson: '{"limit":1000}',
        maxItems,
        command,
      }),
      /max items must be a positive integer/,
    );
  }

  assert.equal(invocations, 0);
});
