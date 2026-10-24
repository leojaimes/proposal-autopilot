import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { MarketTaxonomyAssignmentService } from './market-taxonomy-assignment.service';
import { TaxonomyFallbackUnavailableError } from './market-taxonomy-classifier.service';

const prisma = new PrismaClient();
const tenantId = '00000000-0000-0000-0000-000000000001';

after(async () => {
  await prisma.$disconnect();
});

test('persists a primary taxonomy assignment in the local PostgreSQL database', async () => {
  const externalUpworkId = `local-taxonomy-test-${randomUUID()}`;
  const job = await prisma.jobPost.create({
    data: {
      tenantId,
      externalUpworkId,
      title: 'Senior Design System consultant',
      description: 'Create a component library and design tokens for a B2B SaaS product.',
      jobUrl: 'https://example.invalid/local-taxonomy-test',
      postedAt: new Date(),
    },
  });

  try {
    const service = new MarketTaxonomyAssignmentService(prisma as any);
    const rules = await service.loadActiveRules();
    await service.classifyAndPersist(
      tenantId,
      job.id,
      {
        title: job.title,
        description: job.description,
        skills: ['Figma'],
      },
      rules,
    );
    await service.classifyAndPersist(
      tenantId,
      job.id,
      {
        title: job.title,
        description: job.description,
        skills: ['Figma'],
      },
      rules,
    );

    const assignment = await prisma.jobCategoryAssignment.findFirst({
      where: { jobPostId: job.id, isPrimary: true },
      include: { taxonomyNode: true },
    });

    assert.ok(assignment);
    assert.equal(assignment.taxonomyNode.slug, 'design-systems');
    assert.equal(assignment.source, 'RULES');
    assert.ok(Number(assignment.confidence) > 0.8);
    assert.equal(assignment.taxonomyVersion, 1);

    const classifiedJob = await prisma.jobPost.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(classifiedJob.taxonomyClassificationState, 'CLASSIFIED');
    assert.equal(classifiedJob.taxonomyClassifierVersion, 'taxonomy-rules-v1');
    assert.equal(classifiedJob.taxonomyClassificationError, null);
    assert.equal(await prisma.jobCategoryAssignment.count({
      where: { jobPostId: job.id, isPrimary: true },
    }), 1);
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});

test('persists the fallback as a primary assignment when no taxonomy rule matches', async () => {
  const externalUpworkId = `local-taxonomy-fallback-test-${randomUUID()}`;
  const job = await prisma.jobPost.create({
    data: {
      tenantId,
      externalUpworkId,
      title: 'Bookkeeper needed',
      description: 'Monthly financial reconciliation.',
      jobUrl: 'https://example.invalid/local-taxonomy-fallback-test',
      postedAt: new Date(),
    },
  });

  try {
    const service = new MarketTaxonomyAssignmentService(prisma as any);
    const rules = await service.loadActiveRules();
    await service.classifyAndPersist(
      tenantId,
      job.id,
      { title: job.title, description: job.description, skills: ['Accounting'] },
      rules,
    );

    const assignment = await prisma.jobCategoryAssignment.findFirst({
      where: { jobPostId: job.id, isPrimary: true },
      include: { taxonomyNode: true },
    });

    assert.ok(assignment);
    assert.equal(assignment.taxonomyNode.slug, 'other-services');
    assert.equal(assignment.source, 'RULES');
    assert.equal(assignment.classifierVersion, 'taxonomy-rules-v1');
    assert.equal(Number(assignment.confidence), 0.1);
    assert.deepEqual(assignment.evidence, {
      matchedTerms: [],
      matchedFields: [],
      fallbackReason: 'no-rule-match',
    });

    const fallbackJob = await prisma.jobPost.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(fallbackJob.taxonomyClassificationState, 'FALLBACK');
    assert.equal(fallbackJob.taxonomyFallbackReason, 'no-rule-match');
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});

test('records FAILED when fallback taxonomy configuration is unavailable', async () => {
  const externalUpworkId = `local-taxonomy-missing-fallback-${randomUUID()}`;
  const job = await prisma.jobPost.create({
    data: {
      tenantId,
      externalUpworkId,
      title: 'Bookkeeper needed',
      description: 'Monthly financial reconciliation.',
      jobUrl: 'https://example.invalid/local-taxonomy-missing-fallback',
      postedAt: new Date(),
    },
  });

  try {
    const service = new MarketTaxonomyAssignmentService(prisma as any);
    const rules = (await service.loadActiveRules()).filter((rule) => rule.slug !== 'other-services');

    await assert.rejects(
      service.classifyAndPersist(
        tenantId,
        job.id,
        { title: job.title, description: job.description, skills: ['Accounting'] },
        rules,
      ),
      TaxonomyFallbackUnavailableError,
    );

    const failedJob = await prisma.jobPost.findUniqueOrThrow({ where: { id: job.id } });
    assert.equal(failedJob.taxonomyClassificationState, 'FAILED');
    assert.match(failedJob.taxonomyClassificationError || '', /fallback.*unavailable/i);
    assert.equal(await prisma.jobCategoryAssignment.count({
      where: { jobPostId: job.id, isPrimary: true },
    }), 0);
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});

test('serializes concurrent duplicate classifications into one primary assignment', async () => {
  const externalUpworkId = `local-taxonomy-concurrent-${randomUUID()}`;
  const job = await prisma.jobPost.create({
    data: {
      tenantId,
      externalUpworkId,
      title: 'Design system consultant',
      description: 'Create Figma components and reusable design tokens.',
      jobUrl: 'https://example.invalid/local-taxonomy-concurrent',
      postedAt: new Date(),
    },
  });

  try {
    const service = new MarketTaxonomyAssignmentService(prisma as any);
    const rules = await service.loadActiveRules();
    await Promise.all(Array.from({ length: 4 }, () => service.classifyAndPersist(
      tenantId,
      job.id,
      { title: job.title, description: job.description, skills: ['Figma'] },
      rules,
    )));

    assert.equal(await prisma.jobCategoryAssignment.count({
      where: { jobPostId: job.id, isPrimary: true },
    }), 1);
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
  }
});
