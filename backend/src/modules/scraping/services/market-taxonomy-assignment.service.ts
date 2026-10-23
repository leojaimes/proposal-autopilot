import { Injectable } from '@nestjs/common';
import { MarketTaxonomyKind } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import {
  MarketTaxonomyClassifierService,
  TaxonomyClassificationInput,
  TaxonomyClassificationRule,
} from './market-taxonomy-classifier.service';

@Injectable()
export class MarketTaxonomyAssignmentService {
  private readonly classifier = new MarketTaxonomyClassifierService();

  constructor(private readonly prisma: PrismaService) {}

  async loadActiveRules(): Promise<TaxonomyClassificationRule[]> {
    return this.prisma.marketTaxonomyNode.findMany({
      where: {
        isActive: true,
        kind: { in: [MarketTaxonomyKind.SUBCATEGORY, MarketTaxonomyKind.OCCUPATION] },
      },
      select: { id: true, slug: true, metadata: true },
      orderBy: { slug: 'asc' },
    });
  }

  async classifyAndPersist(
    tenantId: string,
    jobPostId: string,
    input: TaxonomyClassificationInput,
    rules: TaxonomyClassificationRule[],
  ): Promise<void> {
    const classification = this.classifier.classify(input, rules);
    if (!classification) return;

    await this.prisma.$transaction(async (tx) => {
      await tx.jobCategoryAssignment.updateMany({
        where: { jobPostId, isPrimary: true },
        data: { isPrimary: false },
      });
      await tx.jobCategoryAssignment.upsert({
        where: {
          uq_job_taxonomy_assignment: {
            jobPostId,
            taxonomyNodeId: classification.taxonomyNodeId,
          },
        },
        create: {
          tenantId,
          jobPostId,
          taxonomyNodeId: classification.taxonomyNodeId,
          source: 'RULES',
          confidence: classification.confidence,
          isPrimary: true,
          classifierVersion: 'taxonomy-rules-v1',
          evidence: classification.evidence,
        },
        update: {
          source: 'RULES',
          confidence: classification.confidence,
          isPrimary: true,
          classifierVersion: 'taxonomy-rules-v1',
          evidence: classification.evidence,
          classifiedAt: new Date(),
        },
      });
    });
  }
}
