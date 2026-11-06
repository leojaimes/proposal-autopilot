import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoverageChainReimportCommand } from './market-radar-coverage-chain-reimport.command';

test('runs the completed coverage chain through the internal command and returns page and total summaries', async () => {
  const command = new MarketRadarCoverageChainReimportCommand({
    async reimport() {
      return {
        pages: [
          { datasetId: 'dataset-1', newJobs: 2, newSegmentAssignments: 2 },
          { datasetId: 'dataset-2', newJobs: 0, newSegmentAssignments: 0 },
        ],
        total: { newJobs: 2, newSegmentAssignments: 2 },
      };
    },
  });

  assert.deepEqual(
    await command.execute({
      coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
    }),
    {
      pages: [
        { datasetId: 'dataset-1', newJobs: 2, newSegmentAssignments: 2 },
        { datasetId: 'dataset-2', newJobs: 0, newSegmentAssignments: 0 },
      ],
      total: { newJobs: 2, newSegmentAssignments: 2 },
    },
  );
});
