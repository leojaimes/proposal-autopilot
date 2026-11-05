import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ProtectedCatalogRepository, ProtectedCatalogRow } from './upwork-history-seed-importer';

type PortableCatalogRow = Omit<ProtectedCatalogRow, 'postedAt'> & { postedAt: string };
type SeedCatalog = Pick<ProtectedCatalogRepository, 'saveProtected'>;
type SeedManifest = {
  version: number;
  actorId: 'hyperbach/upwork-jobs-history';
  runId: string;
  datasetId: string;
  itemCount: number;
  sha256: string;
  items: PortableCatalogRow[];
};

export async function rehydrateSharedUpworkHistorySeed(manifestPath: string, catalog: SeedCatalog) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as SeedManifest;
  const checksum = createHash('sha256').update(JSON.stringify(manifest.items)).digest('hex');
  if (
    manifest.version !== 1
    || manifest.actorId !== 'hyperbach/upwork-jobs-history'
    || manifest.itemCount !== manifest.items?.length
    || manifest.sha256 !== checksum
  ) throw new Error('Invalid shared Upwork history seed manifest');

  await catalog.saveProtected(
    manifest.items.map((item) => ({ ...item, postedAt: new Date(item.postedAt) })),
    { actorId: manifest.actorId, runId: manifest.runId, datasetId: manifest.datasetId },
  );
  return { imported: manifest.items.length, runId: manifest.runId, datasetId: manifest.datasetId };
}
