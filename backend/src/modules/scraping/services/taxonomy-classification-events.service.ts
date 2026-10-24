import { Injectable, OnModuleInit } from '@nestjs/common';
import { TaxonomyClassificationWorkStatus } from '@prisma/client';
import { ScrapingProgressService } from '../scraping-progress.service';
import { MarketRadarRebuildQueueService } from './market-radar-rebuild-queue.service';
import { MarketTaxonomyAssignmentService } from './market-taxonomy-assignment.service';
import { TaxonomyClassificationInput } from './market-taxonomy-classifier.service';
import { TaxonomyClassificationWorkService } from './taxonomy-classification-work.service';

export interface TaxonomyClassificationWorkItem {
  batchId: string;
  tenantId: string;
  jobPostId: string;
  input?: TaxonomyClassificationInput;
  totalJobs?: number;
}

interface BatchMetadata {
  tenantId: string;
  totalJobs?: number;
}

/**
 * Drives persisted taxonomy work. Memory only records which batch should emit
 * progress; a process restart safely resumes from taxonomy_classification_work.
 */
@Injectable()
export class TaxonomyClassificationEventsService implements OnModuleInit {
  private readonly batches = new Map<string, BatchMetadata>();
  private readonly running = new Map<string, Promise<void>>();
  private readonly concurrency = 4;

  constructor(
    private readonly assignments: MarketTaxonomyAssignmentService,
    private readonly work: TaxonomyClassificationWorkService,
    private readonly progress: ScrapingProgressService,
    private readonly radarRebuildQueue: MarketRadarRebuildQueueService,
  ) {}

  async onModuleInit(): Promise<void> {
    const reconciliation = await this.work.reconcile();
    void this.run('__reconciliation__').then(async () => {
      // Recovery has no live batch/SSE metadata. Rebuild each tenant only
      // after its expired lease has actually completed successfully.
      const tenants = await this.work.completedTenantIds(reconciliation.recoveredWorkIds);
      for (const tenantId of tenants) {
        this.radarRebuildQueue.schedule(tenantId, `taxonomy-recovery-${tenantId}`);
      }
    });
  }

  /** Work must already be durable before this wake-up is called. */
  enqueue(item: TaxonomyClassificationWorkItem): void {
    this.batches.set(item.batchId, { tenantId: item.tenantId, totalJobs: item.totalJobs });
    this.emit(item.batchId, 'QUEUED', 'Taxonomy classification queued');
    void this.run(item.batchId);
  }

  /**
   * Wait until persisted batch work has settled. Successful work schedules one
   * coalesced Radar rebuild for the whole drained batch, never per job.
   */
  async drain(batchId: string): Promise<void> {
    await this.run(batchId);
    const summary = await this.work.batchSummary(batchId);
    const metadata = this.batches.get(batchId);
    if (metadata && summary.COMPLETED > 0) this.radarRebuildQueue.schedule(metadata.tenantId, batchId);
    this.emit(
      batchId,
      summary.FAILED > 0 ? 'FAILED' : 'COMPLETED',
      summary.FAILED > 0
        ? `Taxonomy classification settled with ${summary.FAILED} terminal failure(s)`
        : 'Taxonomy classification completed',
      summary,
    );
  }

  private run(batchId: string): Promise<void> {
    const current = this.running.get(batchId);
    if (current) return current;
    const task = this.drainReadyWork(batchId).finally(() => {
      if (this.running.get(batchId) === task) this.running.delete(batchId);
    });
    this.running.set(batchId, task);
    return task;
  }

  private async drainReadyWork(batchId: string): Promise<void> {
    const rules = await this.assignments.loadActiveRules();
    while (true) {
      await Promise.all(Array.from({ length: this.concurrency }, (_, index) => (
        this.processUntilIdle(batchId, `taxonomy-${process.pid}-${index}`, rules)
      )));
      const pendingDelay = await this.work.nextAvailableDelay(batchId === '__reconciliation__' ? undefined : batchId);
      if (pendingDelay === null) return;
      await new Promise((resolve) => setTimeout(resolve, Math.min(Math.max(pendingDelay, 1), 500)));
    }
  }

  private async processUntilIdle(
    batchId: string,
    workerId: string,
    rules: Awaited<ReturnType<MarketTaxonomyAssignmentService['loadActiveRules']>>,
  ): Promise<void> {
    while (true) {
      const work = await this.work.claimNext(workerId, batchId === '__reconciliation__' ? {} : { batchId });
      if (!work) return;
      try {
        await this.assignments.classifyAndPersist(
          work.tenantId,
          work.jobPostId,
          { title: work.jobPost.title, description: work.jobPost.description, skills: this.readSkills(work.inputPayload) },
          rules,
          { lifecycleManagedByWork: true },
        );
        await this.work.complete(work.id, work.lockedBy!);
      } catch (error) {
        await this.work.failOrRetry(work.id, work.lockedBy!, error);
      }
    }
  }

  private readSkills(payload: unknown): string[] {
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as { skills?: unknown }).skills)) return [];
    return (payload as { skills: unknown[] }).skills.filter((skill): skill is string => typeof skill === 'string');
  }

  private emit(
    batchId: string,
    status: 'QUEUED' | 'COMPLETED' | 'FAILED',
    message: string,
    summary?: Record<TaxonomyClassificationWorkStatus, number>,
  ): void {
    const metadata = this.batches.get(batchId);
    if (!metadata) return;
    const latest = this.progress.getLatestEvent(batchId);
    this.progress.emitProgress({
      batchId,
      tenantId: metadata.tenantId,
      step: latest?.step ?? 'SCORING',
      message,
      percentage: Math.max(latest?.percentage ?? 40, 40),
      currentJobIndex: latest?.currentJobIndex,
      totalJobs: metadata.totalJobs ?? latest?.totalJobs,
      currentJobTitle: latest?.currentJobTitle,
      highFitCount: latest?.highFitCount,
      mediumFitCount: latest?.mediumFitCount,
      classificationStatus: status,
      classificationQueued: (summary?.PENDING ?? 0) + (summary?.PROCESSING ?? 0) + (summary?.RETRYING ?? 0) + (summary?.COMPLETED ?? 0) + (summary?.FAILED ?? 0),
      classificationCompleted: summary?.COMPLETED ?? 0,
      classificationFailed: summary?.FAILED ?? 0,
    });
  }
}
