import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketRadarOperationsService } from './market-radar-operations.service';

test('marks a complete, current snapshot set as ready', async () => {
  const asOf = new Date('2026-10-22T00:00:00.000Z');
  const prisma = {
    marketTaxonomyNode: { count: async () => 3 },
    marketCategorySnapshot: {
      findFirst: async () => ({ asOf }),
      count: async () => 3,
      deleteMany: async () => ({ count: 0 }),
    },
    batchRun: { findFirst: async () => ({ finishedAt: new Date('2026-10-22T10:00:00.000Z') }) },
  };
  const service = new MarketRadarOperationsService({ rebuildForTenant: async () => ({}) } as any, prisma as any);

  const health = await service.getHealth('tenant', new Date('2026-10-23T12:00:00.000Z'));

  assert.equal(health.state, 'READY');
  assert.equal(health.ageDays, 1);
  assert.equal(health.latestSnapshotCategories, 3);
});

test('withholds readiness when snapshots are stale or absent', async () => {
  const stalePrisma = {
    marketTaxonomyNode: { count: async () => 2 },
    marketCategorySnapshot: {
      findFirst: async () => ({ asOf: new Date('2026-10-18T00:00:00.000Z') }),
      count: async () => 2,
      deleteMany: async () => ({ count: 0 }),
    },
    batchRun: { findFirst: async () => null },
  };
  const noSnapshotPrisma = {
    ...stalePrisma,
    marketCategorySnapshot: {
      findFirst: async () => null,
      count: async () => 0,
      deleteMany: async () => ({ count: 0 }),
    },
  };

  const stale = await new MarketRadarOperationsService({ rebuildForTenant: async () => ({}) } as any, stalePrisma as any)
    .getHealth('tenant', new Date('2026-10-22T00:00:00.000Z'));
  const absent = await new MarketRadarOperationsService({ rebuildForTenant: async () => ({}) } as any, noSnapshotPrisma as any)
    .getHealth('tenant', new Date('2026-10-22T00:00:00.000Z'));

  assert.equal(stale.state, 'STALE');
  assert.equal(absent.state, 'NO_SNAPSHOTS');
});

test('prunes only snapshots older than the configured retention window after rebuilding', async () => {
  const originalRetention = process.env.MARKET_RADAR_RETENTION_DAYS;
  process.env.MARKET_RADAR_RETENTION_DAYS = '30';
  let deletedWhere: unknown;
  const prisma = {
    marketCategorySnapshot: {
      deleteMany: async ({ where }: { where: unknown }) => {
        deletedWhere = where;
        return { count: 4 };
      },
    },
  };
  const service = new MarketRadarOperationsService({
    rebuildForTenant: async () => ({ categories: 3, profiles: 1, asOf: new Date('2026-10-22T00:00:00.000Z') }),
  } as any, prisma as any);

  try {
    const result = await service.rebuildAfterSuccessfulBatch('tenant', new Date('2026-10-22T12:00:00.000Z'));
    assert.equal(result.deletedSnapshots, 4);
    assert.deepEqual(deletedWhere, {
      tenantId: 'tenant',
      asOf: { lt: new Date('2026-09-22T00:00:00.000Z') },
      decisions: { none: {} },
    });
  } finally {
    if (originalRetention == null) delete process.env.MARKET_RADAR_RETENTION_DAYS;
    else process.env.MARKET_RADAR_RETENTION_DAYS = originalRetention;
  }
});

test('withholds readiness and marks partial when classification work remains pending', async () => {
  const asOf = new Date('2026-10-22T00:00:00.000Z');
  const prisma = {
    marketTaxonomyNode: { count: async () => 3 },
    marketCategorySnapshot: {
      findFirst: async () => ({ asOf, revision: 2 }),
      count: async () => 3,
    },
    batchRun: { findFirst: async () => ({ finishedAt: new Date('2026-10-22T10:00:00.000Z') }) },
    taxonomyClassificationWork: {
      count: async ({ where }: { where: { status?: unknown } }) => {
        if (typeof where.status === 'object' && where.status !== null) return 2;
        return 0;
      },
    },
  };
  const service = new MarketRadarOperationsService({ rebuildForTenant: async () => ({}) } as any, prisma as any);

  const health = await service.getHealth('tenant', new Date('2026-10-22T12:00:00.000Z'));

  assert.equal(health.state, 'PARTIAL');
  assert.equal(health.latestSnapshotRevision, 2);
  assert.equal(health.pendingClassificationJobs, 2);
});
