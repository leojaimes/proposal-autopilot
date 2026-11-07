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
    { async importDataset() { return { newJobs: 1, newSegmentAssignments: 1 }; } },
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

test('returns the imported page evidence after recording coverage', async () => {
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: 'previous-cursor' }; },
      async recordCompletedPage() {},
    },
    {
      async execute() {
        return { runId: 'run-evidence', datasetId: 'dataset-evidence', nextPage: 'next-cursor', isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { return { newJobs: 8, newSegmentAssignments: 5 }; } },
  );

  const result = await workflow.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
  });

  assert.deepEqual(result, {
    state: 'completed',
    runId: 'run-evidence',
    datasetId: 'dataset-evidence',
    inputCursor: 'previous-cursor',
    outputCursor: 'next-cursor',
    oldestObservedAt: new Date('2026-10-22T00:00:00.000Z'),
    newJobs: 8,
    newSegmentAssignments: 5,
  });
});

test('uses the approved cursor instead of a generic latest segment cursor', async () => {
  const actorInputs: unknown[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: 'generic-cursor' }; },
      async recordCompletedPage() {},
    },
    {
      async execute(input) {
        actorInputs.push(input);
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { return { newJobs: 1, newSegmentAssignments: 1 }; } },
  );

  await workflow.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    inputCursor: 'approved-cursor',
  });

  assert.deepEqual(actorInputs, [{
    limit: 1000,
    category_name: 'Design & Creative',
    page_after: 'approved-cursor',
  }]);
});

test('passes the approved USD cap through the real coverage workflow', async () => {
  let receivedOptions: unknown;
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: null }; },
      async recordCompletedPage() {},
    },
    {
      async execute(_input, options) {
        receivedOptions = options;
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { return { newJobs: 1, newSegmentAssignments: 1 }; } },
  );

  await workflow.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    inputCursor: null,
    maxTotalChargeUsd: 1,
  });

  assert.deepEqual(receivedOptions, { maxTotalChargeUsd: 1 });
});

test('does not pass operational fields to coverage persistence', async () => {
  const persisted: unknown[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: null }; },
      async recordCompletedPage(page) { persisted.push(page); },
    },
    {
      async execute() {
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { return { newJobs: 1, newSegmentAssignments: 1 }; } },
  );

  await workflow.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    postFilterText: 'design system|design tokens|component library|figma variables',
    maxTotalChargeUsd: 1,
  });

  assert.deepEqual(persisted, [{
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: {
      limit: 1000,
      category_name: 'Design & Creative',
      post_filter_text: 'design system|design tokens|component library|figma variables',
    },
    inputCursor: null,
    outputCursor: null,
    apifyRunId: 'run-1',
    apifyDatasetId: 'dataset-1',
    oldestObservedAt: new Date('2026-10-22T00:00:00.000Z'),
  }]);
});

test('imports filtered dataset rows before recording a completed coverage page', async () => {
  const events: string[] = [];
  const imports: unknown[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: null }; },
      async recordCompletedPage() { events.push('record'); },
    },
    {
      async execute() {
        return { runId: 'run-1', datasetId: 'dataset-1', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    {
      async importDataset(input) {
        events.push('import');
        imports.push(input);
        return { newJobs: 1, newSegmentAssignments: 1 };
      },
    },
  );

  await workflow.execute({
    coverageWindowId: 'window-1',
    segment: 'design-systems',
    queryFingerprint: 'design-systems:2026-10-22:design-v1',
    actorInput: { limit: 1000, category_name: 'Design & Creative' },
    postFilterText: 'design system|design tokens|component library|figma variables',
  });

  assert.deepEqual(events, ['import', 'record']);
  assert.deepEqual(imports, [{
    datasetId: 'dataset-1',
    runId: 'run-1',
    segment: 'design-systems',
    postFilterText: 'design system|design tokens|component library|figma variables',
  }]);
});

test('does not record coverage when the dataset import fails', async () => {
  const persistedPages: unknown[] = [];
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: null }; },
      async recordCompletedPage(page) { persistedPages.push(page); },
    },
    {
      async execute() {
        return { runId: 'run-recoverable', datasetId: 'dataset-recoverable', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { throw new Error('catalog import failed'); } },
  );

  await assert.rejects(
    workflow.execute({
      coverageWindowId: 'window-1',
      segment: 'design-systems',
      queryFingerprint: 'design-systems:2026-10-22:design-v1',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
    }),
    /catalog import failed/,
  );

  assert.deepEqual(persistedPages, []);
});

test('attaches run and dataset IDs to a real dataset import failure', async () => {
  const workflow = new MarketRadarCoveragePageWorkflow(
    {
      async prepareNextRequest() { return { inputCursor: null }; },
      async recordCompletedPage() {},
    },
    {
      async execute() {
        return { runId: 'run-recoverable', datasetId: 'dataset-recoverable', nextPage: null, isNotificationMode: false };
      },
    },
    { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
    { async importDataset() { throw new Error('catalog import failed'); } },
  );

  await assert.rejects(
    workflow.execute({
      coverageWindowId: 'window-1',
      segment: 'design-systems',
      queryFingerprint: 'design-systems:2026-10-22:design-v1',
      actorInput: { limit: 1000, category_name: 'Design & Creative' },
    }),
    (error: unknown) => {
      assert.equal((error as { runId?: unknown }).runId, 'run-recoverable');
      assert.equal((error as { datasetId?: unknown }).datasetId, 'dataset-recoverable');
      return true;
    },
  );
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
    { async importDataset() { return { newJobs: 0, newSegmentAssignments: 0 }; } },
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
