import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarApifyPageClient } from './market-radar-apify-page.client';

test('reads nextPage from the completed run OUTPUT', async () => {
  const outputStoreIds: string[] = [];
  const client = new MarketRadarApifyPageClient(
    {
      async callWithOutputStore() {
        return {
          runId: 'run-1',
          datasetId: 'dataset-1',
          keyValueStoreId: 'output-store-1',
        };
      },
    },
    {
      async read(storeId: string) {
        outputStoreIds.push(storeId);
        return { nextPage: 'resume-from-here', isNotificationMode: false };
      },
    },
  );

  const result = await client.execute({ limit: 1000, category_name: 'Translation' });

  assert.deepEqual(outputStoreIds, ['output-store-1']);
  assert.deepEqual(result, {
    runId: 'run-1',
    datasetId: 'dataset-1',
    nextPage: 'resume-from-here',
    isNotificationMode: false,
  });
});
