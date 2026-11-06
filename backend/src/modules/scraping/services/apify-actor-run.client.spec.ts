import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApifyActorRunClient } from './apify-actor-run.client';

test('starts an authenticated actor run with the prepared input', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const client = new ApifyActorRunClient('test-token', async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ data: { id: 'run-1', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } }) };
  });

  await client.call('hyperbach/upwork-scraper-ai', { limit: 1000, page_after: 'resume-here' });

  assert.deepEqual(calls, [{
    url: 'https://api.apify.com/v2/acts/hyperbach~upwork-scraper-ai/runs?waitForFinish=60',
    init: {
      method: 'POST',
      headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
      body: JSON.stringify({ limit: 1000, page_after: 'resume-here' }),
    },
  }]);
});

test('returns IDs from a successful terminal run', async () => {
  const client = new ApifyActorRunClient('test-token', async () => ({
    ok: true,
    json: async () => ({ data: { id: 'run-success', status: 'SUCCEEDED', defaultDatasetId: 'dataset-success' } }),
  }));

  const result = await client.call('hyperbach/upwork-scraper-ai', { limit: 1000 });

  assert.deepEqual(result, { runId: 'run-success', datasetId: 'dataset-success' });
});

test('returns the OUTPUT store ID from a successful terminal run', async () => {
  const client = new ApifyActorRunClient('test-token', async () => ({
    ok: true,
    json: async () => ({
      data: {
        id: 'run-success',
        status: 'SUCCEEDED',
        defaultDatasetId: 'dataset-success',
        defaultKeyValueStoreId: 'output-store-success',
      },
    }),
  }));

  const result = await client.callWithOutputStore('hyperbach/upwork-scraper-ai', { limit: 1000 });

  assert.deepEqual(result, {
    runId: 'run-success',
    datasetId: 'dataset-success',
    keyValueStoreId: 'output-store-success',
  });
});

test('rejects failed or malformed terminal runs', async () => {
  const failedClient = new ApifyActorRunClient('test-token', async () => ({ ok: false, json: async () => ({}) }));
  const malformedClient = new ApifyActorRunClient('test-token', async () => ({ ok: true, json: async () => ({ data: { id: 'run-only' } }) }));

  await assert.rejects(failedClient.call('hyperbach/upwork-scraper-ai', {}), /could not be started/);
  await assert.rejects(malformedClient.call('hyperbach/upwork-scraper-ai', {}), /invalid response/);
});

test('rejects a run that did not succeed', async () => {
  const client = new ApifyActorRunClient('test-token', async () => ({
    ok: true,
    json: async () => ({ data: { id: 'run-still-running', status: 'RUNNING', defaultDatasetId: 'dataset-1' } }),
  }));

  await assert.rejects(client.call('hyperbach/upwork-scraper-ai', {}), /did not succeed/);
});

test('caps the actor run charge', async () => {
  const calls: string[] = [];
  const client = new ApifyActorRunClient('test-token', async (url) => {
    calls.push(url);
    return { ok: true, json: async () => ({ data: { id: 'run-1', status: 'SUCCEEDED', defaultDatasetId: 'dataset-1' } }) };
  });

  await client.call('hyperbach/upwork-scraper-ai', { limit: 10000 }, { maxTotalChargeUsd: 5 });

  assert.deepEqual(calls, ['https://api.apify.com/v2/acts/hyperbach~upwork-scraper-ai/runs?waitForFinish=60&maxTotalChargeUsd=5']);
});
