import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { TaxonomyClassificationEventsService } from './taxonomy-classification-events.service';

const item = (id: string) => ({
  batchId: 'batch-1',
  tenantId: 'tenant-1',
  jobPostId: id,
  input: { title: id, description: '', skills: [] },
  rules: [],
});

test('schedules one Radar rebuild after the drained batch settles', async () => {
  let active = 0;
  let maxActive = 0;
  const events: Array<Record<string, unknown>> = [];
  const claimed = Array.from({ length: 8 }, (_, index) => ({
    id: `work-${index + 1}`,
    tenantId: 'tenant-1',
    jobPostId: `job-${index + 1}`,
    inputPayload: { skills: [] },
    jobPost: { title: `job-${index + 1}`, description: '' },
  }));
  const assignment = {
    loadActiveRules: async () => [],
    classifyAndPersist: async (_tenantId: string, _jobPostId: string) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
    },
  };
  const work = {
    reconcile: async () => ({ recovered: 0, queued: 0 }),
    claimNext: async () => claimed.shift() ?? null,
    complete: async () => undefined,
    failOrRetry: async () => 'FAILED',
    nextAvailableDelay: async () => null,
    batchSummary: async () => ({ PENDING: 0, PROCESSING: 0, RETRYING: 0, COMPLETED: 8, FAILED: 0 }),
  };
  const progress = {
    emitProgress: (event: Record<string, unknown>) => events.push(event),
    getLatestEvent: () => undefined,
  };
  let rebuildSchedules = 0;
  const radarRebuildQueue = { schedule: () => { rebuildSchedules += 1; } };
  const worker = new TaxonomyClassificationEventsService(assignment as any, work as any, progress as any, radarRebuildQueue as any);

  for (let i = 1; i <= 8; i += 1) worker.enqueue(item(`job-${i}`));
  await worker.drain('batch-1');

  assert.equal(maxActive, 4);
  assert.equal(rebuildSchedules, 1);
  const last = events.at(-1);
  assert.equal(last?.classificationQueued, 8);
  assert.equal(last?.classificationCompleted, 8);
  assert.equal(last?.classificationFailed, 0);
});

test('schedules a Radar rebuild after successfully recovering expired work on startup', async () => {
  const scheduled: Array<[string, string]> = [];
  const worker = new TaxonomyClassificationEventsService(
    { loadActiveRules: async () => [], classifyAndPersist: async () => undefined } as any,
    {
      reconcile: async () => ({ recovered: 1, queued: 0, recoveredWorkIds: ['expired-work'] }),
      claimNext: async () => null,
      nextAvailableDelay: async () => null,
      completedTenantIds: async () => ['tenant-recovered'],
    } as any,
    { emitProgress: () => undefined, getLatestEvent: () => undefined } as any,
    { schedule: (tenantId: string, batchId: string) => scheduled.push([tenantId, batchId]) } as any,
  );

  await worker.onModuleInit();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(scheduled, [['tenant-recovered', 'taxonomy-recovery-tenant-recovered']]);
});
