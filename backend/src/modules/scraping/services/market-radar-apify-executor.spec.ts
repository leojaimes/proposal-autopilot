import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarApifyExecutor } from './market-radar-apify-executor';

test('starts the actor with canonical input and resume cursor', async () => {
  const calls: unknown[] = [];
  const executor = new MarketRadarApifyExecutor({
    async call(actorId: string, input: Record<string, unknown>) {
      calls.push({ actorId, input });
      return { runId: 'run-1', datasetId: 'dataset-1' };
    },
  });

  await executor.execute({
    actorInput: { limit: 1000, category_name: 'Translation' },
    inputCursor: 'resume-from-here',
  });

  assert.deepEqual(calls, [{
    actorId: 'hyperbach/upwork-scraper-ai',
    input: { limit: 1000, category_name: 'Translation', page_after: 'resume-from-here' },
  }]);
});

test('returns run and dataset IDs after a successful run', async () => {
  const executor = new MarketRadarApifyExecutor({
    async call() { return { runId: 'run-success', datasetId: 'dataset-success' }; },
  });

  const result = await executor.execute({
    actorInput: { limit: 1000, category_name: 'Translation' },
    inputCursor: null,
  });

  assert.deepEqual(result, { runId: 'run-success', datasetId: 'dataset-success' });
});

test('propagates actor failure without recording coverage', async () => {
  const executor = new MarketRadarApifyExecutor({
    async call() { throw new Error('actor failure'); },
  });

  await assert.rejects(
    executor.execute({ actorInput: { limit: 1000 }, inputCursor: null }),
    /actor failure/,
  );
});
