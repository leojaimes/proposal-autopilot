import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaMarketRadarCoverageRepository } from './prisma-market-radar-coverage.repository';

test('accepts the same actor input when JSON key order changes', async () => {
  const prisma = new PrismaClient();
  const windowStartAt = new Date('2026-10-18T00:00:00.000Z');
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt, windowEndAt: new Date('2026-11-01T23:59:59.999Z'),
    } });
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-10-18',
      actorInput: { limit: 1000, category_name: 'Translation' }, inputCursor: null, outputCursor: 'page-2',
      apifyRunId: 'run-1', apifyDatasetId: 'dataset-1', oldestObservedAt: new Date('2026-10-20T00:00:00.000Z'),
    });
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-10-18',
      actorInput: { category_name: 'Translation', limit: 1000 }, inputCursor: 'page-2', outputCursor: null,
      apifyRunId: 'run-2', apifyDatasetId: 'dataset-2', oldestObservedAt: new Date('2026-10-18T00:00:00.000Z'),
    });

    assert.equal(await prisma.marketRadarCoveragePage.count({ where: { coverageWindowId: window.id } }), 2);
    assert.equal(await repository.loadLastPageForQuery({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:other-filter',
    }), null);
  } finally {
    await prisma.marketRadarCoverageWindow.deleteMany({ where: { windowStartAt } });
    await prisma.$disconnect();
  }
});

test('loads the latest completed dataset for a coverage window and segment from PostgreSQL', async () => {
  const prisma = new PrismaClient();
  const windowStartAt = new Date('2026-10-02T00:00:00.000Z');
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt, windowEndAt: new Date('2026-10-16T23:59:59.999Z'),
    } });
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-10-02',
      actorInput: { limit: 1000 }, inputCursor: null, outputCursor: 'page-2',
      apifyRunId: 'run-1', apifyDatasetId: 'dataset-1', oldestObservedAt: new Date('2026-10-10T00:00:00.000Z'),
    });
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-10-02',
      actorInput: { limit: 1000 }, inputCursor: 'page-2', outputCursor: null,
      apifyRunId: 'run-2', apifyDatasetId: 'dataset-2', oldestObservedAt: new Date('2026-10-02T00:00:00.000Z'),
    });

    assert.deepEqual(
      await repository.loadLatestCompletedPage(window.id, 'translation'),
      { datasetId: 'dataset-2', runId: 'run-2', actorInput: { limit: 1000 } },
    );
  } finally {
    await prisma.marketRadarCoverageWindow.deleteMany({ where: { windowStartAt } });
    await prisma.$disconnect();
  }
});

test('loads every page of a completed coverage chain in recorded order', async () => {
  const prisma = new PrismaClient();
  const windowStartAt = new Date('2026-09-18T00:00:00.000Z');
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt, windowEndAt: new Date('2026-10-02T23:59:59.999Z'),
    } });
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-09-18',
      actorInput: { limit: 1000 }, inputCursor: null, outputCursor: 'page-2',
      apifyRunId: 'run-1', apifyDatasetId: 'dataset-1', oldestObservedAt: new Date('2026-09-26T00:00:00.000Z'),
    });
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:2026-09-18',
      actorInput: { limit: 1000 }, inputCursor: 'page-2', outputCursor: null,
      apifyRunId: 'run-2', apifyDatasetId: 'dataset-2', oldestObservedAt: new Date('2026-09-18T00:00:00.000Z'),
    });

    assert.deepEqual(await repository.loadCompletedPages({
      coverageWindowId: window.id,
      segment: 'translation',
      queryFingerprint: 'translation:2026-09-18',
    }), [
      { datasetId: 'dataset-1', runId: 'run-1', actorInput: { limit: 1000 } },
      { datasetId: 'dataset-2', runId: 'run-2', actorInput: { limit: 1000 } },
    ]);
    assert.deepEqual(await repository.loadCompletedPages({
      coverageWindowId: window.id,
      segment: 'translation',
      queryFingerprint: 'translation:other-filter',
    }), []);
  } finally {
    await prisma.marketRadarCoverageWindow.deleteMany({ where: { windowStartAt } });
    await prisma.$disconnect();
  }
});

test('rejects an attempt to record an inconsistent query fingerprint in a coverage chain', async () => {
  const prisma = new PrismaClient();
  const windowStartAt = new Date('2026-09-01T00:00:00.000Z');
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt, windowEndAt: new Date('2026-09-15T23:59:59.999Z'),
    } });
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:approved',
      actorInput: { limit: 1000 }, inputCursor: null, outputCursor: 'page-2',
      apifyRunId: 'run-1', apifyDatasetId: 'dataset-1', oldestObservedAt: new Date('2026-09-08T00:00:00.000Z'),
    });
    await assert.rejects(
      repository.recordPage({
        coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:corrupted',
        actorInput: { limit: 1000 }, inputCursor: 'page-2', outputCursor: null,
        apifyRunId: 'run-2', apifyDatasetId: 'dataset-2', oldestObservedAt: new Date('2026-09-01T00:00:00.000Z'),
      }),
      /coverage chain contains inconsistent query fingerprints/,
    );
  } finally {
    await prisma.marketRadarCoverageWindow.deleteMany({ where: { windowStartAt } });
    await prisma.$disconnect();
  }
});

test('rejects a legacy inconsistent chain before preflight can mark it covered', async () => {
  const prisma = new PrismaClient();
  const windowStartAt = new Date('2026-08-18T00:00:00.000Z');
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt, windowEndAt: new Date('2026-09-01T23:59:59.999Z'),
    } });
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    await repository.recordPage({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:approved',
      actorInput: { limit: 1000 }, inputCursor: null, outputCursor: 'page-2',
      apifyRunId: 'run-1', apifyDatasetId: 'dataset-1', oldestObservedAt: new Date('2026-08-25T00:00:00.000Z'),
    });
    await prisma.marketRadarCoveragePage.create({ data: {
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:corrupted',
      actorInput: { limit: 1000 }, inputCursor: 'page-2', outputCursor: null,
      apifyRunId: 'run-2', apifyDatasetId: 'dataset-2', oldestObservedAt: new Date('2026-08-18T00:00:00.000Z'),
    } });

    await assert.rejects(
      repository.loadLastPageForQuery({
        coverageWindowId: window.id, segment: 'translation', queryFingerprint: 'translation:approved',
      }),
      /coverage chain contains inconsistent query fingerprints/,
    );
  } finally {
    await prisma.marketRadarCoverageWindow.deleteMany({ where: { windowStartAt } });
    await prisma.$disconnect();
  }
});
