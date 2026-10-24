import { Injectable } from '@nestjs/common';
import {
  Prisma,
  TaxonomyClassificationState,
  TaxonomyClassificationWorkStatus,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { TaxonomyClassificationInput } from './market-taxonomy-classifier.service';

export const TAXONOMY_CLASSIFIER_VERSION = 'taxonomy-rules-v1';
export const DEFAULT_TAXONOMY_WORK_MAX_ATTEMPTS = 3;
export const TAXONOMY_WORK_LEASE_MS = 5 * 60 * 1000;

type PrismaExecutor = PrismaService | Prisma.TransactionClient;

export interface QueueTaxonomyClassificationWorkInput {
  tenantId: string;
  jobPostId: string;
  taxonomyVersion: number;
  batchId?: string;
  input: TaxonomyClassificationInput;
  maxAttempts?: number;
  force?: boolean;
}

@Injectable()
export class TaxonomyClassificationWorkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Called in the JobPost upsert transaction. Duplicate delivery retains a
   * completed/leased work item, while explicit reprocess can create a retry.
   */
  async queue(
    db: PrismaExecutor,
    input: QueueTaxonomyClassificationWorkInput,
  ): Promise<void> {
    const unique = {
      uq_tenant_job_taxonomy_work: {
        tenantId: input.tenantId,
        jobPostId: input.jobPostId,
        taxonomyVersion: input.taxonomyVersion,
      },
    };
    const payload = { skills: input.input.skills || [] };

    // Upsert is the duplicate-delivery boundary. Two concurrent ingesters can
    // race here without producing two work records or surfacing a unique error.
    try {
      await db.taxonomyClassificationWork.upsert({
        where: unique,
        create: {
          tenantId: input.tenantId,
          jobPostId: input.jobPostId,
          taxonomyVersion: input.taxonomyVersion,
          classifierVersion: TAXONOMY_CLASSIFIER_VERSION,
          batchId: input.batchId,
          inputPayload: payload,
          maxAttempts: input.maxAttempts ?? DEFAULT_TAXONOMY_WORK_MAX_ATTEMPTS,
        },
        update: {},
      });
    } catch (error: unknown) {
      // Prisma can implement a composite upsert as select+insert. PostgreSQL's
      // unique constraint wins the race; the loser is an idempotent replay.
      const duplicate = (error as { code?: string })?.code === 'P2002';
      if (!duplicate) throw error;
    }
    if (!input.force) return;

    const existing = await db.taxonomyClassificationWork.findUniqueOrThrow({ where: unique });
    if (existing.status === TaxonomyClassificationWorkStatus.PROCESSING) return;

    await db.taxonomyClassificationWork.update({
      where: { id: existing.id },
      data: {
        batchId: input.batchId,
        inputPayload: payload,
        status: TaxonomyClassificationWorkStatus.PENDING,
        attempts: 0,
        availableAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        completedAt: null,
        failedAt: null,
        maxAttempts: input.maxAttempts ?? existing.maxAttempts,
      },
    });
  }

  async queueForJob(input: QueueTaxonomyClassificationWorkInput): Promise<void> {
    await this.queue(this.prisma, input);
  }

  async currentTaxonomyVersion(): Promise<number> {
    const latest = await this.prisma.marketTaxonomyNode.aggregate({
      where: { isActive: true },
      _max: { taxonomyVersion: true },
    });
    return latest._max.taxonomyVersion ?? 1;
  }

  /** Recover expired leases from a crashed process and create work for pending jobs. */
  async reconcile(): Promise<{ recovered: number; queued: number; recoveredWorkIds: string[] }> {
    const now = new Date();
    const leaseExpiredAt = new Date(now.getTime() - TAXONOMY_WORK_LEASE_MS);
    const expiredLeases = await this.prisma.taxonomyClassificationWork.findMany({
      where: {
        status: TaxonomyClassificationWorkStatus.PROCESSING,
        lockedAt: { lte: leaseExpiredAt },
      },
      select: { id: true },
    });
    const recovered = await this.prisma.taxonomyClassificationWork.updateMany({
      where: {
        id: { in: expiredLeases.map((work) => work.id) },
        status: TaxonomyClassificationWorkStatus.PROCESSING,
        lockedAt: { lte: leaseExpiredAt },
      },
      data: {
        status: TaxonomyClassificationWorkStatus.RETRYING,
        availableAt: now,
        lockedAt: null,
        lockedBy: null,
      },
    });
    const taxonomyVersion = await this.currentTaxonomyVersion();
    const pendingJobs = await this.prisma.jobPost.findMany({
      where: {
        taxonomyClassificationState: 'PENDING',
        taxonomyClassificationWork: { none: { taxonomyVersion } },
      },
      select: { id: true, tenantId: true, title: true, description: true },
    });

    await Promise.all(pendingJobs.map((job) => this.queueForJob({
      tenantId: job.tenantId,
      jobPostId: job.id,
      taxonomyVersion,
      input: { title: job.title, description: job.description, skills: [] },
    })));

    return {
      recovered: recovered.count,
      queued: pendingJobs.length,
      recoveredWorkIds: expiredLeases.map((work) => work.id),
    };
  }

  async claimNext(
    workerId: string,
    options: { batchId?: string; tenantId?: string } = {},
  ) {
    const now = new Date();
    const candidate = await this.prisma.taxonomyClassificationWork.findFirst({
      where: {
        ...(options.batchId ? { batchId: options.batchId } : {}),
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
        status: { in: [TaxonomyClassificationWorkStatus.PENDING, TaxonomyClassificationWorkStatus.RETRYING] },
        availableAt: { lte: now },
      },
      orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
    });
    if (!candidate) return null;

    // Compare-and-set makes duplicate delivery safe even when more than one
    // process attempts to drain the same tenant/batch.
    const claimed = await this.prisma.taxonomyClassificationWork.updateMany({
      where: {
        id: candidate.id,
        status: { in: [TaxonomyClassificationWorkStatus.PENDING, TaxonomyClassificationWorkStatus.RETRYING] },
        availableAt: { lte: now },
      },
      data: {
        status: TaxonomyClassificationWorkStatus.PROCESSING,
        attempts: { increment: 1 },
        lockedAt: now,
        lockedBy: `${workerId}:${randomUUID()}`,
      },
    });
    if (claimed.count !== 1) return null;
    return this.prisma.taxonomyClassificationWork.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { jobPost: { select: { title: true, description: true } } },
    });
  }

  async complete(workId: string, lockedBy: string): Promise<boolean> {
    const completed = await this.prisma.taxonomyClassificationWork.updateMany({
      where: { id: workId, status: TaxonomyClassificationWorkStatus.PROCESSING, lockedBy },
      data: {
        status: TaxonomyClassificationWorkStatus.COMPLETED,
        completedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
      },
    });
    return completed.count === 1;
  }

  async failOrRetry(
    workId: string,
    lockedBy: string,
    error: unknown,
  ): Promise<TaxonomyClassificationWorkStatus | null> {
    const message = error instanceof Error ? error.message : String(error);
    return this.prisma.$transaction(async (tx) => {
      const work = await tx.taxonomyClassificationWork.findUniqueOrThrow({ where: { id: workId } });
      if (work.status !== TaxonomyClassificationWorkStatus.PROCESSING || work.lockedBy !== lockedBy) return null;
      const terminal = work.attempts >= work.maxAttempts;
      const settled = await tx.taxonomyClassificationWork.updateMany({
        where: { id: workId, status: TaxonomyClassificationWorkStatus.PROCESSING, lockedBy },
        data: terminal ? {
          status: TaxonomyClassificationWorkStatus.FAILED,
          failedAt: new Date(),
          lockedAt: null,
          lockedBy: null,
          lastError: message.slice(0, 4000),
        } : {
          status: TaxonomyClassificationWorkStatus.RETRYING,
          availableAt: new Date(Date.now() + (work.attempts * 100)),
          lockedAt: null,
          lockedBy: null,
          lastError: message.slice(0, 4000),
        },
      });
      if (settled.count !== 1) return null;
      if (terminal) {
        await tx.jobPost.updateMany({
          where: { id: work.jobPostId, tenantId: work.tenantId },
          data: {
            taxonomyClassificationState: TaxonomyClassificationState.FAILED,
            taxonomyClassificationError: message.slice(0, 4000),
            taxonomyClassifiedAt: new Date(),
          },
        });
      }
      return terminal ? TaxonomyClassificationWorkStatus.FAILED : TaxonomyClassificationWorkStatus.RETRYING;
    });
  }

  async completedTenantIds(workIds: string[]): Promise<string[]> {
    if (workIds.length === 0) return [];
    const completed = await this.prisma.taxonomyClassificationWork.findMany({
      where: { id: { in: workIds }, status: TaxonomyClassificationWorkStatus.COMPLETED },
      select: { tenantId: true },
      distinct: ['tenantId'],
    });
    return completed.map((work) => work.tenantId);
  }

  async batchSummary(batchId: string): Promise<Record<TaxonomyClassificationWorkStatus, number>> {
    const rows = await this.prisma.taxonomyClassificationWork.groupBy({
      by: ['status'],
      where: { batchId },
      _count: { _all: true },
    });
    const result = Object.values(TaxonomyClassificationWorkStatus)
      .reduce((summary, status) => ({ ...summary, [status]: 0 }), {} as Record<TaxonomyClassificationWorkStatus, number>);
    for (const row of rows) result[row.status] = row._count._all;
    return result;
  }

  async nextAvailableDelay(batchId: string): Promise<number | null> {
    const work = await this.prisma.taxonomyClassificationWork.findFirst({
      where: {
        batchId,
        status: { in: [TaxonomyClassificationWorkStatus.PENDING, TaxonomyClassificationWorkStatus.RETRYING] },
      },
      orderBy: { availableAt: 'asc' },
      select: { availableAt: true },
    });
    return work ? Math.max(0, work.availableAt.getTime() - Date.now()) : null;
  }
}
