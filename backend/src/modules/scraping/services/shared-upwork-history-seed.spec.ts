import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rehydrateSharedUpworkHistorySeed } from './shared-upwork-history-seed';

test('rehydrates protected catalog rows from a verified portable manifest', async () => {
  const items = [{
    externalUpworkId: '021929210319849117903', jobUrl: 'https://www.upwork.com/jobs/~021929210319849117903',
    postedAt: '2026-10-01T23:59:00Z', title: 'Portable seed job', description: 'Restore this record in production.',
    budgetType: 'HOURLY', hourlyMin: 15, hourlyMax: 35, skills: ['Figma'], clientCountry: 'Canada',
    isPaymentVerified: true, clientTotalSpend: 15737.82, rawApifyPayload: { id: '021929210319849117903' }, isProtected: true,
  }];
  const manifestPath = join(await mkdtemp(join(tmpdir(), 'shared-upwork-seed-')), 'seed.json');
  await writeFile(manifestPath, JSON.stringify({
    version: 1, actorId: 'hyperbach/upwork-jobs-history', runId: 'run-portable', datasetId: 'dataset-portable',
    itemCount: 1, sha256: createHash('sha256').update(JSON.stringify(items)).digest('hex'), items,
  }));
  let savedRows: unknown;
  let savedProvenance: unknown;

  const result = await rehydrateSharedUpworkHistorySeed(manifestPath, {
    async saveProtected(rows, provenance) { savedRows = rows; savedProvenance = provenance; },
  });

  assert.deepEqual(result, { imported: 1, runId: 'run-portable', datasetId: 'dataset-portable' });
  assert.deepEqual(savedRows, [{ ...items[0], postedAt: new Date(items[0].postedAt) }]);
  assert.deepEqual(savedProvenance, {
    actorId: 'hyperbach/upwork-jobs-history', runId: 'run-portable', datasetId: 'dataset-portable',
  });
});
