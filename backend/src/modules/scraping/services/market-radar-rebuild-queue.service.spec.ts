import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketRadarRebuildQueueService } from './market-radar-rebuild-queue.service';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('arms a follow-up rebuild when work is scheduled while an active rebuild is running', async () => {
  process.env.MARKET_RADAR_REBUILD_DEBOUNCE_MS = '750';

  const rebuildCalls: string[] = [];
  const firstRebuildGate = createDeferred<void>();

  const radarOperations = {
    rebuildAfterSuccessfulBatch: async (tenantId: string) => {
      rebuildCalls.push(tenantId);
      if (rebuildCalls.length === 1) {
        // Hold the first rebuild in-flight so a second schedule can arrive concurrently
        await firstRebuildGate.promise;
      }
    },
  };

  const emittedEvents: Array<Record<string, unknown>> = [];
  const progress = {
    getLatestEvent: (batchId: string) => ({
      batchId,
      tenantId: 'tenant-1',
      totalFound: 1,
      processedCount: 1,
      stage: 'COMPLETED',
    }),
    emitProgress: (event: Record<string, unknown>) => {
      emittedEvents.push(event);
    },
  };

  const service = new MarketRadarRebuildQueueService(radarOperations as any, progress as any);

  try {
    // 1. Schedule first batch and wait for its debounce to fire and start the rebuild
    service.schedule('tenant-1', 'batch-1');
    await new Promise((resolve) => setTimeout(resolve, 850));

    // First rebuild should now be in-flight
    assert.equal(rebuildCalls.length, 1, 'First rebuild should have started');

    // 2. Schedule second batch while first is STILL RUNNING
    service.schedule('tenant-1', 'batch-2');

    // Wait a little while to allow debounce of batch-2 to expire
    await new Promise((resolve) => setTimeout(resolve, 850));

    // Release the first rebuild
    firstRebuildGate.resolve();

    // Give time for follow-up rebuild to execute
    await new Promise((resolve) => setTimeout(resolve, 950));

    // Under bug: rebuildCalls.length remains 1 because batch-2 was dropped!
    // Under fix: rebuildCalls.length must be 2!
    assert.equal(rebuildCalls.length, 2, 'Follow-up rebuild must execute for batch-2');
  } finally {
    service.onModuleDestroy();
  }
});
