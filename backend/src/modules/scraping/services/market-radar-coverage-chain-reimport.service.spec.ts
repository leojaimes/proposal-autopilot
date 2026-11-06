import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoverageChainReimportService } from './market-radar-coverage-chain-reimport.service';

test('reimports every stored dataset and preserves zero-count pages in the summary', async () => {
  const imported: unknown[] = [];
  const service = new MarketRadarCoverageChainReimportService(
    {
      async loadCompletedPages() {
        return [
          { datasetId: 'dataset-1', runId: 'run-1', actorInput: { post_filter_text: 'translation' } },
          { datasetId: 'dataset-2', runId: 'run-2', actorInput: {} },
        ];
      },
    },
    {
      async importDataset(input) {
        imported.push(input);
        return input.datasetId === 'dataset-1'
          ? { newJobs: 3, newSegmentAssignments: 2 }
          : { newJobs: 0, newSegmentAssignments: 0 };
      },
    },
  );

  const result = await service.reimport({ coverageWindowId: 'window-1', segment: 'translation' });

  assert.deepEqual(imported, [
    { datasetId: 'dataset-1', runId: 'run-1', segment: 'translation', postFilterText: 'translation' },
    { datasetId: 'dataset-2', runId: 'run-2', segment: 'translation', postFilterText: null },
  ]);
  assert.deepEqual(result, {
    pages: [
      { datasetId: 'dataset-1', newJobs: 3, newSegmentAssignments: 2 },
      { datasetId: 'dataset-2', newJobs: 0, newSegmentAssignments: 0 },
    ],
    total: { newJobs: 3, newSegmentAssignments: 2 },
  });
});

test('stops on an unreadable dataset, identifies it, and does not mutate coverage', async () => {
  let coverageWrites = 0;
  const coveragePages = {
    async loadCompletedPages() {
      return [
        { datasetId: 'dataset-1', runId: 'run-1', actorInput: {} },
        { datasetId: 'dataset-2', runId: 'run-2', actorInput: {} },
      ];
    },
    async recordPage() {
      coverageWrites += 1;
    },
  };
  const service = new MarketRadarCoverageChainReimportService(
    coveragePages,
    {
      async importDataset(input) {
        if (input.datasetId === 'dataset-2') throw new Error('dataset could not be read');
        return { newJobs: 1, newSegmentAssignments: 1 };
      },
    },
  );

  await assert.rejects(
    service.reimport({ coverageWindowId: 'window-1', segment: 'translation' }),
    /dataset-2: dataset could not be read/,
  );
  assert.equal(coverageWrites, 0);
});
