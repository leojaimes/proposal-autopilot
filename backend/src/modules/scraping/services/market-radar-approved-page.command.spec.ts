import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarApprovedPageCommand } from './market-radar-approved-page.command';

test('does not start an actor for a covered gap plan', async () => {
  let workflowInvoked = false;
  const command = new MarketRadarApprovedPageCommand({
    async execute() {
      workflowInvoked = true;
      return { runId: 'unexpected', datasetId: 'unexpected', nextCursor: null };
    },
  });

  const result = await command.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system|design tokens|component library|figma variables',
    plan: {
      state: 'covered',
      actorInput: null,
      inputCursor: null,
      maxItems: null,
      maxTotalChargeUsd: 0,
      approvalRequired: false,
    },
  });

  assert.deepEqual(result, { state: 'covered' });
  assert.equal(workflowInvoked, false);
});

test('runs exactly one historical page with the approved cap and cursor', async () => {
  let received: unknown;
  const command = new MarketRadarApprovedPageCommand({
    async execute(request) {
      received = request;
      return { runId: 'run-1', datasetId: 'dataset-1', nextCursor: 'next-page' };
    },
  });

  const result = await command.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system|design tokens|component library|figma variables',
    plan: {
      state: 'continue',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
      inputCursor: 'approved-cursor',
      maxItems: 1000,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    },
  });

  assert.deepEqual(result, { runId: 'run-1', datasetId: 'dataset-1', nextCursor: 'next-page' });
  assert.deepEqual(received, {
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    inputCursor: 'approved-cursor',
    postFilterText: 'design system|design tokens|component library|figma variables',
    maxTotalChargeUsd: 1,
  });
});

test('returns recoverable run and dataset IDs without recording coverage when import fails', async () => {
  const command = new MarketRadarApprovedPageCommand({
    async execute() {
      throw Object.assign(new Error('catalog import failed'), {
        runId: 'run-recoverable',
        datasetId: 'dataset-recoverable',
      });
    },
  });

  const result = await command.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system|design tokens|component library|figma variables',
    plan: {
      state: 'uncovered',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
      inputCursor: null,
      maxItems: 1000,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    },
  });

  assert.deepEqual(result, {
    state: 'import_failed',
    runId: 'run-recoverable',
    datasetId: 'dataset-recoverable',
  });
});

test('reports polling recovery separately from a dataset import failure', async () => {
  const command = new MarketRadarApprovedPageCommand({
    async execute() {
      throw Object.assign(new Error('Apify actor run could not be polled'), {
        stage: 'polling',
        runId: 'run-pending',
        datasetId: 'dataset-pending',
      });
    },
  });

  const result = await command.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system|design tokens|component library|figma variables',
    plan: {
      state: 'uncovered',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
      inputCursor: null,
      maxItems: 1000,
      maxTotalChargeUsd: 1,
      approvalRequired: true,
    },
  });

  assert.deepEqual(result, {
    state: 'run_incomplete',
    runId: 'run-pending',
    datasetId: 'dataset-pending',
  });
});
