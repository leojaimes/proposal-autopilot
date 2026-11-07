import * as assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { MarketRadarCoveragePageWorkflow } from './market-radar-coverage-page.workflow';
import { MarketRadarCoverageRunner } from './market-radar-coverage-runner';
import { PrismaMarketRadarCoverageRepository } from './prisma-market-radar-coverage.repository';

test('persists a local coverage workflow page and restores its cursor', async () => {
  const prisma = new PrismaClient();
  const fingerprint = `translation:${randomUUID()}`;
  const windowStartAt = new Date();
  const windowEndAt = new Date(windowStartAt.valueOf() + 1);
  let windowId: string | undefined;
  try {
    const window = await prisma.marketRadarCoverageWindow.create({ data: {
      windowStartAt,
      windowEndAt,
    } });
    windowId = window.id;
    const repository = new PrismaMarketRadarCoverageRepository(prisma);
    const workflow = new MarketRadarCoveragePageWorkflow(
      new MarketRadarCoverageRunner(repository),
      {
        async execute() {
          return { runId: 'run-local-1', datasetId: 'dataset-local-1', nextPage: 'next-local-cursor', isNotificationMode: false };
        },
      },
      { async read() { return [{ date_posted: '2026-10-22T00:00:00.000Z' }]; } },
      { async importDataset() { return { newJobs: 1, newSegmentAssignments: 1 }; } },
    );

    await workflow.execute({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: fingerprint,
      actorInput: { limit: 1000, category_name: 'Translation' },
    });

    const saved = await prisma.marketRadarCoveragePage.findFirst({ where: { coverageWindowId: window.id } });
    const resumed = await new MarketRadarCoverageRunner(repository).prepareNextRequest({
      coverageWindowId: window.id, segment: 'translation', queryFingerprint: fingerprint,
    });
    assert.deepEqual(saved?.actorInput, { limit: 1000, category_name: 'Translation' });
    assert.equal(saved?.outputCursor, 'next-local-cursor');
    assert.equal(resumed.inputCursor, 'next-local-cursor');
  } finally {
    if (windowId) await prisma.marketRadarCoverageWindow.delete({ where: { id: windowId } });
    await prisma.$disconnect();
  }
});
