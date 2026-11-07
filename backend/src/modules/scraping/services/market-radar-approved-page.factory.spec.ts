import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarketRadarApprovedPageCommand } from './market-radar-approved-page.factory';

test('wires one capped historical page through import and coverage recording', async () => {
  const events: string[] = [];
  const command = createMarketRadarApprovedPageCommand({
    token: 'test-token',
    coveragePages: {
      async loadLastPage() { return null; },
      async recordPage() { events.push('coverage'); },
    },
    pageClient: {
      async execute(_input, options) {
        events.push(`page:${options?.maxTotalChargeUsd}`);
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: null, isNotificationMode: false };
      },
    },
    readDataset: async () => [{
      id: 'job-1', url: 'https://www.upwork.com/jobs/~job-1', date_posted: '2026-10-22T00:00:00.000Z', title: 'Design system',
    }],
    catalog: {
      async saveLive() {
        events.push('catalog');
        return { newJobs: 1, newSegmentAssignments: 1 };
      },
    },
  });

  await command.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    postFilterText: 'design system',
    plan: {
      state: 'uncovered', actorInput: { limit: 1000 }, inputCursor: null,
      maxItems: 1000, maxTotalChargeUsd: 1, approvalRequired: true,
    },
  });

  assert.deepEqual(events, ['page:1', 'catalog', 'coverage']);
});
