import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarDatasetReimportService } from './market-radar-dataset-reimport.service';

test('reimports a recorded coverage dataset without invoking an actor', async () => {
  const importedDatasets: unknown[] = [];
  const service = new MarketRadarDatasetReimportService(
    {
      async loadLatestCompletedPage() {
        return {
          datasetId: 'dataset-1',
          runId: 'run-1',
          actorInput: { post_filter_text: 'translation' },
        };
      },
    },
    {
      async importDataset(input) {
        importedDatasets.push(input);
        return { newJobs: 4, newSegmentAssignments: 4 };
      },
    },
  );

  const result = await service.reimport({ coverageWindowId: 'window-1', segment: 'translation' });

  assert.deepEqual(importedDatasets, [{
    datasetId: 'dataset-1', runId: 'run-1', segment: 'translation', postFilterText: 'translation',
  }]);
  assert.deepEqual(result, { datasetId: 'dataset-1', newJobs: 4, newSegmentAssignments: 4 });
});

test('does not record or replace a coverage checkpoint when dataset reading fails', async () => {
  let coverageWrites = 0;
  const coveragePages = {
    async loadLatestCompletedPage() {
      return { datasetId: 'dataset-1', runId: 'run-1', actorInput: {} };
    },
    async recordPage() {
      coverageWrites += 1;
    },
  };
  const service = new MarketRadarDatasetReimportService(
    coveragePages,
    {
      async importDataset() {
        throw new Error('dataset could not be read');
      },
    },
  );

  await assert.rejects(
    service.reimport({ coverageWindowId: 'window-1', segment: 'translation' }),
    /dataset could not be read/,
  );
  assert.equal(coverageWrites, 0);
});

test('rejects a completed coverage page without canonical actor input before importing', async () => {
  let imports = 0;
  const service = new MarketRadarDatasetReimportService(
    {
      async loadLatestCompletedPage() {
        return { datasetId: 'dataset-1', runId: 'run-1', actorInput: null };
      },
    },
    {
      async importDataset() {
        imports += 1;
        return { newJobs: 1, newSegmentAssignments: 1 };
      },
    },
  );

  await assert.rejects(
    service.reimport({ coverageWindowId: 'window-1', segment: 'translation' }),
    /canonical actor input is required/,
  );
  assert.equal(imports, 0);
});
