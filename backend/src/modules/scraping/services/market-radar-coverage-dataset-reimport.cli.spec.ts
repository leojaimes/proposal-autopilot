import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { runMarketRadarCoverageDatasetReimport } from './market-radar-coverage-dataset-reimport.cli';

test('fails before importing when the token is unavailable', async () => {
  let imports = 0;

  await assert.rejects(
    runMarketRadarCoverageDatasetReimport({
      token: undefined,
      coverageWindowId: 'window-1',
      segment: 'translation',
      command: {
        async execute() {
          imports += 1;
          return { datasetId: 'dataset-1', newJobs: 1, newSegmentAssignments: 1 };
        },
      },
    }),
    /APIFY_TOKEN is required/,
  );

  assert.equal(imports, 0);
});

test('forwards the query fingerprint to the internal command', async () => {
  const requests: unknown[] = [];

  await runMarketRadarCoverageDatasetReimport({
    token: 'token-1',
    coverageWindowId: 'window-1',
    segment: 'translation',
    queryFingerprint: 'translation:approved',
    command: {
      async execute(request) {
        requests.push(request);
        return { pages: [], total: { newJobs: 0, newSegmentAssignments: 0 } };
      },
    },
  });

  assert.deepEqual(requests, [{
    coverageWindowId: 'window-1', segment: 'translation', queryFingerprint: 'translation:approved',
  }]);
});
