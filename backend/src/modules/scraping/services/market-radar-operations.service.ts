import { Injectable } from '@nestjs/common';
import { MarketTaxonomyKind } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { MarketSnapshotService } from './market-snapshot.service';

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function configuredPositiveInteger(name: string, fallback: number): number {
  const configured = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isSafeInteger(configured) && configured > 0 ? configured : fallback;
}

export type MarketRadarHealth = {
  state: 'READY' | 'PARTIAL' | 'STALE' | 'NO_SNAPSHOTS';
  latestSnapshotAsOf: Date | null;
  latestSnapshotRevision: number | null;
  latestCompletedScrapeAt: Date | null;
  ageDays: number | null;
  expectedCategories: number;
  latestSnapshotCategories: number;
  retainedSnapshots: number;
  retentionDays: number;
  staleAfterDays: number;
  pendingClassificationJobs: number;
  failedClassificationJobs: number;
};

@Injectable()
export class MarketRadarOperationsService {
  constructor(
    private readonly snapshots: MarketSnapshotService,
    private readonly prisma: PrismaService,
  ) {}

  async rebuildAfterSuccessfulBatch(tenantId: string, asOf = new Date()) {
    const result = await this.snapshots.rebuildForTenant(tenantId, asOf);
    const retentionDays = configuredPositiveInteger('MARKET_RADAR_RETENTION_DAYS', 180);
    const cutoff = startOfUtcDay(asOf);
    cutoff.setUTCDate(cutoff.getUTCDate() - retentionDays);
    const deletedSnapshots = await this.prisma.marketCategorySnapshot.deleteMany({
      where: { tenantId, asOf: { lt: cutoff }, decisions: { none: {} } },
    });

    return { ...result, deletedSnapshots: deletedSnapshots.count, retentionDays, cutoff };
  }

  async getHealth(tenantId: string, now = new Date()): Promise<MarketRadarHealth> {
    const [
      expectedCategories,
      latestSnapshot,
      latestCompletedBatch,
      retainedSnapshots,
      pendingClassificationJobs,
      failedClassificationJobs,
    ] = await Promise.all([
      this.prisma.marketTaxonomyNode.count({
        where: {
          isActive: true,
          kind: { in: [MarketTaxonomyKind.SUBCATEGORY, MarketTaxonomyKind.OCCUPATION] },
        },
      }),
      this.prisma.marketCategorySnapshot.findFirst({
        where: { tenantId, isCurrent: true },
        orderBy: { asOf: 'desc' },
        select: { asOf: true, revision: true },
      }),
      this.prisma.batchRun.findFirst({
        where: { tenantId, status: 'COMPLETED' },
        orderBy: { finishedAt: 'desc' },
        select: { finishedAt: true },
      }),
      this.prisma.marketCategorySnapshot.count({ where: { tenantId, isCurrent: true } }),
      this.prisma.taxonomyClassificationWork?.count({
        where: {
          tenantId,
          status: { in: ['PENDING', 'PROCESSING', 'RETRYING'] },
        },
      }) ?? 0,
      this.prisma.taxonomyClassificationWork?.count({
        where: {
          tenantId,
          status: 'FAILED',
        },
      }) ?? 0,
    ]);
    const latestSnapshotCategories = latestSnapshot == null
      ? 0
      : await this.prisma.marketCategorySnapshot.count({
        where: { tenantId, asOf: latestSnapshot.asOf, isCurrent: true },
      });
    const staleAfterDays = configuredPositiveInteger('MARKET_RADAR_STALE_AFTER_DAYS', 2);
    const retentionDays = configuredPositiveInteger('MARKET_RADAR_RETENTION_DAYS', 180);
    const ageDays = latestSnapshot == null
      ? null
      : Math.floor((startOfUtcDay(now).getTime() - startOfUtcDay(latestSnapshot.asOf).getTime()) / 86_400_000);
    const state = latestSnapshot == null
      ? 'NO_SNAPSHOTS'
      : ageDays > staleAfterDays
        ? 'STALE'
        : (latestSnapshotCategories < expectedCategories || pendingClassificationJobs > 0)
          ? 'PARTIAL'
          : 'READY';

    return {
      state,
      latestSnapshotAsOf: latestSnapshot?.asOf ?? null,
      latestSnapshotRevision: latestSnapshot?.revision ?? null,
      latestCompletedScrapeAt: latestCompletedBatch?.finishedAt ?? null,
      ageDays,
      expectedCategories,
      latestSnapshotCategories,
      retainedSnapshots,
      retentionDays,
      staleAfterDays,
      pendingClassificationJobs,
      failedClassificationJobs,
    };
  }
}
