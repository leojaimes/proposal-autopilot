import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoveragePageWorkflow } from './market-radar-coverage-page.workflow';

test('persists a completed page with its cursor, run, dataset, and canonical input', async () => {
  const persistedPages: unknown[] = [];
  const actorInputs: unknown[] = [];
  const datasetIds: string[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest(request) {
        return { ...request, inputCursor: 'previous-cursor' };
      },
      async recordCompletedPage(page) { persistedPages.push(page); },
    },
    {
      async execute(input) {
        actorInputs.push(input);
        return {
          runId: 'run-1', datasetId: 'dataset-1', nextPage: 'next-cursor', isNotificationMode: false,
        };
      },
    },
    {
      async read(datasetId) {
        datasetIds.push(datasetId);
        return [{ date_posted: '2026-10-22T00:00:00.000Z' }];
      },
    },
  );

  await workflow.execute({
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
    actorInput: { limit: 1000, category_name: 'Translation' },
  });

  assert.deepEqual(actorInputs, [{ limit: 1000, category_name: 'Translation', page_after: 'previous-cursor' }]);
  assert.deepEqual(datasetIds, ['dataset-1']);
  assert.deepEqual(persistedPages, [{
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
    actorInput: { limit: 1000, category_name: 'Translation' }, inputCursor: 'previous-cursor',
    outputCursor: 'next-cursor', apifyRunId: 'run-1', apifyDatasetId: 'dataset-1',
    oldestObservedAt: new Date('2026-10-22T00:00:00.000Z'),
  }]);
});

test('aborts before persistence when a dataset has no valid job posting date', async () => {
  const persistedPages: unknown[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest(request) { return { ...request, inputCursor: null }; },
      async recordCompletedPage(page) { persistedPages.push(page); },
    },
    {
      async execute() {
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: 'next-cursor', isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: 'not-a-date' }]; } },
  );

  await assert.rejects(
    workflow.execute({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:2026-10-22',
      actorInput: { limit: 1000, category_name: 'Translation' },
    }),
    /dataset has no valid job posting dates/,
  );

  assert.deepEqual(persistedPages, []);
});
