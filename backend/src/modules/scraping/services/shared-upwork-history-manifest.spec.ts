import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeSharedUpworkHistoryManifest } from './shared-upwork-history-manifest';

test('writes a versioned paginated portable manifest for the protected seed', async () => {
  const items = [{
    externalUpworkId: '021929210319849117903', jobUrl: 'https://www.upwork.com/jobs/~021929210319849117903',
    postedAt: new Date('2026-10-01T23:59:00Z'), title: 'Manifest job', description: 'Store the seed for recovery.',
    budgetType: 'HOURLY' as const, hourlyMin: 15, hourlyMax: 35, skills: ['Figma'], clientCountry: 'Canada',
    isPaymentVerified: true, clientTotalSpend: 15737.82, rawApifyPayload: { id: '021929210319849117903' }, isProtected: true as const,
  }];
  const manifestPath = join(await mkdtemp(join(tmpdir(), 'shared-upwork-manifest-')), 'history.v1.json');

  await writeSharedUpworkHistoryManifest(manifestPath, {
    actorId: 'hyperbach/upwork-jobs-history', runId: 'run-manifest', datasetId: 'dataset-manifest',
    sourceWindow: { from: '2026-10-01', to: '2026-10-01' },
    page: { number: 1, size: 1000, nextCursor: null },
    items,
  });

  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const portableItems = [{ ...items[0], postedAt: '2026-10-01T23:59:00.000Z' }];
  assert.deepEqual(manifest, {
    version: 1, actorId: 'hyperbach/upwork-jobs-history', runId: 'run-manifest', datasetId: 'dataset-manifest',
    sourceWindow: { from: '2026-10-01', to: '2026-10-01' },
    page: { number: 1, size: 1000, nextCursor: null },
    itemCount: 1, sha256: createHash('sha256').update(JSON.stringify(portableItems)).digest('hex'), items: portableItems,
  });
});
