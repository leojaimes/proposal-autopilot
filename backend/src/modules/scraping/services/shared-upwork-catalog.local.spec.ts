import { strict as assert } from 'node:assert';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaSharedUpworkCatalogRepository } from './prisma-shared-upwork-catalog.repository';
import { UpworkHistorySeedImporter } from './upwork-history-seed-importer';
import { runSharedUpworkHistorySeed } from '../../../../scripts/seed-shared-upwork-history';

const prisma = new PrismaClient();

test('creates a protected shared Upwork catalog in PostgreSQL', async () => {
  try {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'shared_upwork_jobs'
      ORDER BY ordinal_position
    `;

    assert.deepEqual(columns.map((column) => column.column_name), [
      'id', 'external_upwork_id', 'title', 'description', 'job_url', 'posted_at',
      'raw_apify_payload', 'source_run_id', 'source_dataset_id', 'is_protected', 'created_at',
    ]);
  } finally {
    await prisma.$disconnect();
  }
});

test('persists protected shared catalog rows with Apify provenance', async () => {
  const externalUpworkId = `seed-test-${randomUUID()}`;
  const repository = new PrismaSharedUpworkCatalogRepository(prisma);

  try {
    await repository.saveProtected([{
      externalUpworkId,
      title: 'Seed test job',
      description: 'A protected seed job persisted for an integration test.',
      jobUrl: `https://www.upwork.com/jobs/~${externalUpworkId}`,
      postedAt: new Date('2026-08-05T00:28:33Z'),
      rawApifyPayload: { id: externalUpworkId },
      isProtected: true,
    }], { actorId: 'hyperbach/upwork-jobs-history', runId: 'run-1', datasetId: 'dataset-1' });

    const saved = await prisma.sharedUpworkJob.findUniqueOrThrow({ where: { externalUpworkId } });
    assert.equal(saved.isProtected, true);
    assert.equal(saved.sourceRunId, 'run-1');
    assert.equal(saved.sourceDatasetId, 'dataset-1');
    assert.deepEqual(saved.rawApifyPayload, { id: externalUpworkId });
  } finally {
    await prisma.$executeRaw`
      UPDATE shared_upwork_jobs SET is_protected = false WHERE external_upwork_id = ${externalUpworkId}
    `;
    await prisma.sharedUpworkJob.deleteMany({ where: { externalUpworkId } });
    await prisma.$disconnect();
  }
});

test('rejects deletion of protected shared catalog rows', async () => {
  const externalUpworkId = `protected-seed-test-${randomUUID()}`;

  try {
    await prisma.sharedUpworkJob.create({ data: {
      externalUpworkId,
      title: 'Protected seed test job',
      description: 'This test verifies the database deletion guard.',
      jobUrl: `https://www.upwork.com/jobs/~${externalUpworkId}`,
      postedAt: new Date('2026-08-05T00:28:33Z'),
      rawApifyPayload: { id: externalUpworkId },
      sourceRunId: 'run-guard',
      sourceDatasetId: 'dataset-guard',
    } });

    await assert.rejects(
      prisma.sharedUpworkJob.delete({ where: { externalUpworkId } }),
      /protected shared Upwork job/i,
    );
  } finally {
    await prisma.$executeRaw`
      UPDATE shared_upwork_jobs SET is_protected = false WHERE external_upwork_id = ${externalUpworkId}
    `;
    await prisma.sharedUpworkJob.deleteMany({ where: { externalUpworkId } });
    await prisma.$disconnect();
  }
});

test('persists the raw Apify payload through the seed importer', async () => {
  const externalUpworkId = `importer-seed-test-${randomUUID()}`;
  const rawPayload = {
    id: externalUpworkId,
    url: `https://www.upwork.com/jobs/~${externalUpworkId}`,
    postedAt: '2026-10-01T23:59:00Z',
    title: 'Newest imported job',
    description: 'Persist the original Apify record.',
    jobType: 'fixed',
  };

  try {
    const importer = new UpworkHistorySeedImporter(
      { async getMostRecent() { return { runId: 'run-importer', datasetId: 'dataset-importer', items: [rawPayload] }; } },
      new PrismaSharedUpworkCatalogRepository(prisma),
    );

    assert.deepEqual(await importer.importOnce(), { imported: 1, runId: 'run-importer', datasetId: 'dataset-importer' });
    const saved = await prisma.sharedUpworkJob.findUniqueOrThrow({ where: { externalUpworkId } });
    assert.deepEqual(saved.rawApifyPayload, rawPayload);
  } finally {
    await prisma.$executeRaw`
      UPDATE shared_upwork_jobs SET is_protected = false WHERE external_upwork_id = ${externalUpworkId}
    `;
    await prisma.sharedUpworkJob.deleteMany({ where: { externalUpworkId } });
    await prisma.$disconnect();
  }
});

test('runs the portable seed command against PostgreSQL', async () => {
  const externalUpworkId = `command-seed-test-${randomUUID()}`;
  const items = [{
    externalUpworkId, jobUrl: `https://www.upwork.com/jobs/~${externalUpworkId}`,
    postedAt: '2026-10-01T23:59:00Z', title: 'Command seed job', description: 'Restore through the CLI command.',
    budgetType: 'FIXED', hourlyMin: null, hourlyMax: null, skills: [], clientCountry: null,
    isPaymentVerified: false, clientTotalSpend: null, rawApifyPayload: { id: externalUpworkId }, isProtected: true,
  }];
  const manifestPath = join(await mkdtemp(join(tmpdir(), 'shared-upwork-command-')), 'seed.json');
  await writeFile(manifestPath, JSON.stringify({
    version: 1, actorId: 'hyperbach/upwork-jobs-history', runId: 'run-command', datasetId: 'dataset-command',
    itemCount: 1, sha256: createHash('sha256').update(JSON.stringify(items)).digest('hex'), items,
  }));

  try {
    assert.deepEqual(await runSharedUpworkHistorySeed(manifestPath), {
      imported: 1, runId: 'run-command', datasetId: 'dataset-command',
    });
    assert.equal((await prisma.sharedUpworkJob.findUniqueOrThrow({ where: { externalUpworkId } })).isProtected, true);
  } finally {
    await prisma.$executeRaw`
      UPDATE shared_upwork_jobs SET is_protected = false WHERE external_upwork_id = ${externalUpworkId}
    `;
    await prisma.sharedUpworkJob.deleteMany({ where: { externalUpworkId } });
    await prisma.$disconnect();
  }
});
