import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApifyLiveDatasetImporter } from './apify-live-dataset-importer';

test('imports all pages from that stored dataset into the shared catalog', async () => {
  const reads: Array<{ datasetId: string; token: string }> = [];
  const savedRows: unknown[][] = [];
  const importer = new ApifyLiveDatasetImporter(
    'token-1',
    async (datasetId, token) => {
      reads.push({ datasetId, token });
      return [
        { id: 'job-1', url: 'https://www.upwork.com/jobs/~job-1', date_posted: '2026-11-03T10:00:00Z', title: 'First job' },
        { id: 'job-2', url: 'https://www.upwork.com/jobs/~job-2', date_posted: '2026-11-03T09:00:00Z', title: 'Second job' },
      ];
    },
    {
      async saveLive(rows) {
        savedRows.push(rows);
        return { newJobs: 2, newSegmentAssignments: 2 };
      },
    },
  );

  const result = await importer.importDataset({
    datasetId: 'dataset-1', runId: 'run-1', segment: 'translation', postFilterText: null,
  });

  assert.deepEqual(reads, [{ datasetId: 'dataset-1', token: 'token-1' }]);
  assert.equal(savedRows[0].length, 2);
  assert.deepEqual(result, { newJobs: 2, newSegmentAssignments: 2 });
});
