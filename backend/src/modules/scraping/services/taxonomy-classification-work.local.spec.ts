import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { PrismaClient, TaxonomyClassificationState, TaxonomyClassificationWorkStatus } from '@prisma/client';
import { TaxonomyClassificationWorkService } from './taxonomy-classification-work.service';

const prisma = new PrismaClient();
const tenantId = '00000000-0000-0000-0000-000000000001';

after(async () => {
  await prisma.$disconnect();
});

async function createJob(id: string, tenant = tenantId) {
  return prisma.jobPost.create({
    data: {
      tenantId: tenant,
      externalUpworkId: id,
      title: 'Design system consultant',
      description: 'Build a component library in Figma.',
      jobUrl: `https://example.invalid/${id}`,
      postedAt: new Date(),
    },
  });
}

test('recovers a claimed work item and keeps concurrent duplicate delivery idempotent', async () => {
  const job = await createJob(`outbox-recovery-${randomUUID()}`);
  const service = new TaxonomyClassificationWorkService(prisma as any);
  const input = {
    tenantId,
    jobPostId: job.id,
    taxonomyVersion: 1,
    batchId: `batch-${randomUUID()}`,
    input: { title: job.title, description: job.description, skills: ['Figma'] },
  };

  try {
    await Promise.all(Array.from({ length: 8 }, () => service.queueForJob(input)));
    assert.equal(await prisma.taxonomyClassificationWork.count({ where: { jobPostId: job.id } }), 1);

    const claimed = await service.claimNext('worker-before-restart', { batchId: input.batchId });
    assert.ok(claimed);
    assert.equal(claimed.status, TaxonomyClassificationWorkStatus.PROCESSING);

    const liveLeaseReconciliation = await service.reconcile();
    assert.equal(liveLeaseReconciliation.recovered, 0);
    assert.equal((await prisma.taxonomyClassificationWork.findUniqueOrThrow({ where: { id: claimed.id } })).status, TaxonomyClassificationWorkStatus.PROCESSING);

    await prisma.taxonomyClassificationWork.update({
      where: { id: claimed.id },
      data: { lockedAt: new Date(Date.now() - (6 * 60 * 1000)) },
    });
    const reconciliation = await service.reconcile();
    assert.equal(reconciliation.recovered, 1);
    const recovered = await prisma.taxonomyClassificationWork.findUniqueOrThrow({ where: { id: claimed.id } });
    assert.equal(recovered.status, TaxonomyClassificationWorkStatus.RETRYING);

    const replayed = await service.claimNext('worker-after-restart', { batchId: input.batchId });
    assert.equal(replayed?.id, claimed.id);
    assert.notEqual(replayed?.lockedBy, claimed.lockedBy);
    assert.equal(await service.complete(claimed.id, claimed.lockedBy!), false);
    assert.equal(await service.complete(replayed!.id, replayed!.lockedBy!), true);
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});

test('keeps work tenant-scoped and marks repeated failures terminally', async () => {
  const isolatedTenant = await prisma.tenant.create({
    data: { name: 'Taxonomy work isolation', slug: `taxonomy-work-${randomUUID()}` },
  });
  const first = await createJob(`outbox-tenant-a-${randomUUID()}`);
  const second = await createJob(`outbox-tenant-b-${randomUUID()}`, isolatedTenant.id);
  const service = new TaxonomyClassificationWorkService(prisma as any);
  const batchId = `batch-${randomUUID()}`;

  try {
    await service.queueForJob({
      tenantId,
      jobPostId: first.id,
      taxonomyVersion: 1,
      batchId,
      maxAttempts: 2,
      input: { title: first.title, description: first.description, skills: [] },
    });
    await service.queueForJob({
      tenantId: isolatedTenant.id,
      jobPostId: second.id,
      taxonomyVersion: 1,
      batchId,
      input: { title: second.title, description: second.description, skills: [] },
    });

    const tenantAWork = await service.claimNext('tenant-a-worker', { tenantId, batchId });
    assert.equal(tenantAWork?.jobPostId, first.id);
    assert.equal(await service.failOrRetry(tenantAWork!.id, tenantAWork!.lockedBy!, new Error('temporary upstream failure')), TaxonomyClassificationWorkStatus.RETRYING);

    await new Promise((resolve) => setTimeout(resolve, 120));
    const retry = await service.claimNext('tenant-a-worker', { tenantId, batchId });
    assert.equal(retry?.id, tenantAWork?.id);
    assert.equal(await service.failOrRetry(retry!.id, retry!.lockedBy!, new Error('terminal upstream failure')), TaxonomyClassificationWorkStatus.FAILED);

    const tenantBWork = await prisma.taxonomyClassificationWork.findUniqueOrThrow({
      where: { uq_tenant_job_taxonomy_work: { tenantId: isolatedTenant.id, jobPostId: second.id, taxonomyVersion: 1 } },
    });
    assert.equal(tenantBWork.status, TaxonomyClassificationWorkStatus.PENDING);
  } finally {
    await prisma.tenant.delete({ where: { id: isolatedTenant.id } });
    await prisma.jobPost.deleteMany({ where: { id: first.id } });
  }
});

test('does not let a stale worker failure mark the job failed', async () => {
  const job = await createJob(`outbox-stale-failure-${randomUUID()}`);
  const service = new TaxonomyClassificationWorkService(prisma as any);
  const batchId = `batch-${randomUUID()}`;

  try {
    await service.queueForJob({
      tenantId,
      jobPostId: job.id,
      taxonomyVersion: 1,
      batchId,
      maxAttempts: 2,
      input: { title: job.title, description: job.description, skills: [] },
    });
    const stale = await service.claimNext('worker-stale', { batchId });
    assert.ok(stale);
    await prisma.taxonomyClassificationWork.update({
      where: { id: stale!.id },
      data: { lockedAt: new Date(Date.now() - (6 * 60 * 1000)) },
    });
    await service.reconcile();
    const current = await service.claimNext('worker-current', { batchId });
    assert.ok(current);

    assert.equal(await service.failOrRetry(stale!.id, stale!.lockedBy!, new Error('stale failure')), null);
    assert.equal(
      (await prisma.jobPost.findUniqueOrThrow({ where: { id: job.id } })).taxonomyClassificationState,
      TaxonomyClassificationState.PENDING,
    );
    assert.equal(await service.failOrRetry(current!.id, current!.lockedBy!, new Error('current failure')), TaxonomyClassificationWorkStatus.FAILED);
    assert.equal(
      (await prisma.jobPost.findUniqueOrThrow({ where: { id: job.id } })).taxonomyClassificationState,
      TaxonomyClassificationState.FAILED,
    );
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});
