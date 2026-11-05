import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { ProtectedCatalogRow } from './upwork-history-seed-importer';

type SeedPage = {
  number: number;
  size: number;
  nextCursor: { postedAt: string; externalUpworkId: string } | null;
};

type ManifestInput = {
  actorId: 'hyperbach/upwork-jobs-history';
  runId: string;
  datasetId: string;
  sourceWindow: { from: string; to: string };
  page: SeedPage;
  items: ProtectedCatalogRow[];
};

export async function writeSharedUpworkHistoryManifest(manifestPath: string, input: ManifestInput) {
  const items = input.items.map((item) => ({ ...item, postedAt: item.postedAt.toISOString() }));
  const manifest = {
    version: 1,
    actorId: input.actorId,
    runId: input.runId,
    datasetId: input.datasetId,
    sourceWindow: input.sourceWindow,
    page: input.page,
    itemCount: items.length,
    sha256: createHash('sha256').update(JSON.stringify(items)).digest('hex'),
    items,
  };
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return manifest;
}
