import { strict as assert } from 'node:assert';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { MarketTaxonomyAssignmentService } from './market-taxonomy-assignment.service';

const prisma = new PrismaClient();
const tenantId = '00000000-0000-0000-0000-000000000001';

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

    const assignment = await prisma.jobCategoryAssignment.findFirst({
      where: { jobPostId: job.id, isPrimary: true },
      include: { taxonomyNode: true },
    });

    assert.ok(assignment);
    assert.equal(assignment.taxonomyNode.slug, 'design-systems');
    assert.equal(assignment.source, 'RULES');
    assert.ok(Number(assignment.confidence) > 0.8);
  } finally {
    await prisma.jobPost.delete({ where: { id: job.id } });
    await prisma.$disconnect();
  }
});
