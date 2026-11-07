import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarApprovedPageLauncher } from './market-radar-approved-page.launcher';

test('returns a no-op for covered coverage without constructing the actor', async () => {
  let tokenRead = false;
  let commandConstructed = false;
  const launcher = new MarketRadarApprovedPageLauncher(
    {
      async execute() {
        return {
          state: 'covered' as const,
          actorInput: null,
          inputCursor: null,
          maxItems: null,
          maxTotalChargeUsd: 0,
          approvalRequired: false,
        };
      },
    },
    {
      readToken() {
        tokenRead = true;
        return 'test-token';
      },
      createCommand() {
        commandConstructed = true;
        return { async execute() { return { state: 'unexpected' }; } };
      },
    },
  );

  const result = await launcher.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    maxItems: 1000,
    postFilterText: 'design system|design tokens|component library|figma variables',
  });

  assert.deepEqual(result, { state: 'covered' });
  assert.equal(tokenRead, false);
  assert.equal(commandConstructed, false);
});

test('constructs exactly one historical page with the plan cursor and USD 1 cap', async () => {
  let constructedWithToken: string | null = null;
  let received: unknown;
  const plan = {
    state: 'continue' as const,
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    inputCursor: 'approved-cursor',
    maxItems: 1000,
    maxTotalChargeUsd: 1,
    approvalRequired: true,
  };
  const launcher = new MarketRadarApprovedPageLauncher(
    { async execute() { return plan; } },
    {
      readToken() { return 'test-token'; },
      createCommand(token) {
        constructedWithToken = token;
        return {
          async execute(request) {
            received = request;
            return { runId: 'run-1', datasetId: 'dataset-1', nextCursor: 'next-page' };
          },
        };
      },
    },
  );

  const result = await launcher.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    maxItems: 1000,
    postFilterText: 'design system|design tokens|component library|figma variables',
  });

  assert.equal(constructedWithToken, 'test-token');
  assert.deepEqual(result, { runId: 'run-1', datasetId: 'dataset-1', nextCursor: 'next-page' });
  assert.deepEqual(received, {
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system|design tokens|component library|figma variables',
    plan,
  });
});

test('rejects a missing token before constructing the actor', async () => {
  let commandConstructed = false;
  const launcher = new MarketRadarApprovedPageLauncher(
    {
      async execute() {
        return {
          state: 'uncovered' as const,
          actorInput: { limit: 1000 },
          inputCursor: null,
          maxItems: 1000,
          maxTotalChargeUsd: 1,
          approvalRequired: true,
        };
      },
    },
    {
      readToken() { return ''; },
      createCommand() {
        commandConstructed = true;
        return { async execute() { return { state: 'unexpected' }; } };
      },
    },
  );

  await assert.rejects(
    launcher.execute({
      coverageWindowId: 'window-1',
      segment: 'design-systems',
      queryFingerprint: 'design-systems:2026-10-22:design-v1',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
      maxItems: 1000,
      postFilterText: 'design system|design tokens|component library|figma variables',
    }),
    /APIFY_TOKEN is required/,
  );

  assert.equal(commandConstructed, false);
});
