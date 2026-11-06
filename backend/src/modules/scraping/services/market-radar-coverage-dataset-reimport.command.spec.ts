import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { MarketRadarCoverageDatasetReimportCommand } from './market-radar-coverage-dataset-reimport.command';

test('reimports a completed coverage dataset through the command without invoking an actor', async () => {
  const requested: unknown[] = [];
  const command = new MarketRadarCoverageDatasetReimportCommand({
    async reimport(request) {
      requested.push(request);
      return { datasetId: 'dataset-1', newJobs: 4, newSegmentAssignments: 3 };
    },
  });

  const result = await command.execute({ coverageWindowId: 'window-1', segment: 'translation' });

  assert.deepEqual(requested, [{ coverageWindowId: 'window-1', segment: 'translation' }]);
  assert.deepEqual(result, { datasetId: 'dataset-1', newJobs: 4, newSegmentAssignments: 3 });
});

test('reports zero new jobs and segment assignments when the command reimports the same dataset', async () => {
  let imports = 0;
  const command = new MarketRadarCoverageDatasetReimportCommand({
    async reimport() {
      imports += 1;
      return imports === 1
        ? { datasetId: 'dataset-1', newJobs: 4, newSegmentAssignments: 3 }
        : { datasetId: 'dataset-1', newJobs: 0, newSegmentAssignments: 0 };
    },
  });

  await command.execute({ coverageWindowId: 'window-1', segment: 'translation' });
  const repeated = await command.execute({ coverageWindowId: 'window-1', segment: 'translation' });

  assert.deepEqual(repeated, { datasetId: 'dataset-1', newJobs: 0, newSegmentAssignments: 0 });
});
