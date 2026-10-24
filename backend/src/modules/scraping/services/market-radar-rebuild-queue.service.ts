import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ScrapingProgressService } from '../scraping-progress.service';
import { MarketRadarOperationsService } from './market-radar-operations.service';

export type MarketRadarRebuildStatus = 'QUEUED' | 'COMPLETED' | 'FAILED';

interface TenantRebuildState {
  timer?: NodeJS.Timeout;
  pendingBatchIds: Set<string>;
  running?: Promise<void>;
}

function configuredDebounceMs(): number {
  const configured = Number.parseInt(process.env.MARKET_RADAR_REBUILD_DEBOUNCE_MS ?? '', 10);
  if (!Number.isSafeInteger(configured)) return 1000;
  return Math.min(1500, Math.max(750, configured));
}

/**
 * Coalesces taxonomy-triggered Radar rebuilds per tenant. Classification only
 * schedules work here; the rebuild runs independently from the scoring loop.
 */
@Injectable()
export class MarketRadarRebuildQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(MarketRadarRebuildQueueService.name);
  private readonly tenants = new Map<string, TenantRebuildState>();

  constructor(
    private readonly radarOperations: MarketRadarOperationsService,
    private readonly progress: ScrapingProgressService,
  ) {}

  /** Schedule a rebuild without awaiting it. Repeated calls within the debounce window coalesce. */
  schedule(tenantId: string, batchId: string): void {
    const state = this.tenants.get(tenantId) ?? {
      pendingBatchIds: new Set<string>(),
    };
    this.tenants.set(tenantId, state);
    state.pendingBatchIds.add(batchId);

    if (state.timer) clearTimeout(state.timer);
    state.timer = setTimeout(() => {
      state.timer = undefined;
      this.startRebuild(tenantId, state);
    }, configuredDebounceMs());

    this.emitStatus(tenantId, state.pendingBatchIds, 'QUEUED', 'Market Radar rebuild queued');
  }

  /**
   * Cancels a pending debounce and waits for an already-running rebuild. The
   * controller calls this before its authoritative final rebuild.
   */
  async flush(tenantId: string): Promise<void> {
    const state = this.tenants.get(tenantId);
    if (!state) return;

    while (state.timer || state.running) {
      if (state.timer) {
        clearTimeout(state.timer);
        state.timer = undefined;
        state.pendingBatchIds.clear();
      }
      const running = state.running;
      if (running) await running;
    }

    if (state.pendingBatchIds.size === 0) this.tenants.delete(tenantId);
  }

  onModuleDestroy(): void {
    for (const state of this.tenants.values()) {
      if (state.timer) clearTimeout(state.timer);
    }
    this.tenants.clear();
  }

  private startRebuild(tenantId: string, state: TenantRebuildState): void {
    if (state.running || state.pendingBatchIds.size === 0) return;

    const batchIds = new Set(state.pendingBatchIds);
    state.pendingBatchIds.clear();
    const rebuild = this.executeRebuild(tenantId, batchIds);
    state.running = rebuild;
    void rebuild.then(
      () => this.finishRebuild(tenantId, state, rebuild),
      () => this.finishRebuild(tenantId, state, rebuild),
    );
  }

  private async executeRebuild(tenantId: string, batchIds: Set<string>): Promise<void> {
    try {
      await this.radarOperations.rebuildAfterSuccessfulBatch(tenantId);
      const health = await this.radarOperations.getHealth(tenantId);
      this.emitStatus(
        tenantId,
        batchIds,
        'COMPLETED',
        'Market Radar updated after taxonomy classification',
        undefined,
        health.latestSnapshotRevision ?? undefined,
      );
    } catch (error: unknown) {
      const normalized = error instanceof Error ? error : new Error(String(error));
      this.logger.error(`Async Market Radar rebuild failed for tenant ${tenantId}: ${normalized.message}`);
      this.emitStatus(tenantId, batchIds, 'FAILED', `Market Radar rebuild failed: ${normalized.message}`, normalized.message);
    }
  }

  private finishRebuild(tenantId: string, state: TenantRebuildState, rebuild: Promise<void>): void {
    if (state.running === rebuild) state.running = undefined;
    if (state.pendingBatchIds.size > 0 && !state.timer) {
      this.startRebuild(tenantId, state);
    } else if (!state.timer && !state.running && state.pendingBatchIds.size === 0) {
      this.tenants.delete(tenantId);
    }
  }

  private emitStatus(
    tenantId: string,
    batchIds: Set<string>,
    status: MarketRadarRebuildStatus,
    message: string,
    error?: string,
    radarRevision?: number,
  ): void {
    for (const batchId of batchIds) {
      const latest = this.progress.getLatestEvent(batchId);
      if (!latest || latest.tenantId !== tenantId) continue;
      this.progress.emitProgress({
        ...latest,
        message,
        radarRebuildStatus: status,
        radarSnapshotUpdated: status === 'COMPLETED',
        ...(radarRevision != null ? { radarRevision } : {}),
        ...(error ? { error } : {}),
      });
    }
  }
}
