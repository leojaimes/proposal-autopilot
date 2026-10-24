import { Injectable } from '@nestjs/common';
import { MarketTaxonomyKind, TaxonomyClassificationState } from '@prisma/client';
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
      select: { id: true, slug: true, metadata: true, taxonomyVersion: true },
      orderBy: { slug: 'asc' },
    });
  }

  async classifyAndPersist(
    tenantId: string,
    jobPostId: string,
    input: TaxonomyClassificationInput,
    rules: TaxonomyClassificationRule[],
    options: { lifecycleManagedByWork?: boolean } = {},
  ): Promise<void> {
    await this.setClassificationPending(tenantId, jobPostId);

    try {
      const classification = this.classifier.classify(input, rules);
      const state = classification.evidence.fallbackReason
        ? TaxonomyClassificationState.FALLBACK
        : TaxonomyClassificationState.CLASSIFIED;

      await this.prisma.$transaction(async (tx) => {
        // Serialize the primary-assignment transition per job. The matching
        // partial unique index is a second line of defence across deployments.
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "job_posts"
          WHERE "id" = ${jobPostId}::uuid AND "tenant_id" = ${tenantId}::uuid
          FOR UPDATE
        `;
        if (locked.length !== 1) {
          throw new Error(`Job ${jobPostId} does not belong to tenant ${tenantId}`);
        }
        await tx.jobCategoryAssignment.updateMany({
          where: { tenantId, jobPostId, isPrimary: true },
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
            taxonomyVersion: classification.taxonomyVersion,
            evidence: classification.evidence,
          },
          update: {
            source: 'RULES',
            confidence: classification.confidence,
            isPrimary: true,
            classifierVersion: 'taxonomy-rules-v1',
            taxonomyVersion: classification.taxonomyVersion,
            evidence: classification.evidence,
            classifiedAt: new Date(),
          },
        });
        await tx.jobPost.updateMany({
          where: { id: jobPostId, tenantId },
          data: {
            taxonomyClassificationState: state,
            taxonomyClassifierVersion: 'taxonomy-rules-v1',
            taxonomyFallbackReason: classification.evidence.fallbackReason || null,
            taxonomyClassificationError: null,
            taxonomyClassifiedAt: new Date(),
          },
        });
      });
    } catch (error) {
      if (!options.lifecycleManagedByWork) {
        await this.markClassificationFailed(tenantId, jobPostId, error);
      }
      throw error;
    }
  }

  private async setClassificationPending(tenantId: string, jobPostId: string): Promise<void> {
    const result = await this.prisma.jobPost.updateMany({
      where: { id: jobPostId, tenantId },
      data: {
        taxonomyClassificationState: TaxonomyClassificationState.PENDING,
        taxonomyClassificationError: null,
        taxonomyFallbackReason: null,
      },
    });

    if (result.count !== 1) {
      throw new Error(`Job ${jobPostId} does not belong to tenant ${tenantId}`);
    }
  }

  private async markClassificationFailed(tenantId: string, jobPostId: string, error: unknown): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    await this.prisma.jobPost.updateMany({
      where: { id: jobPostId, tenantId },
      data: {
        taxonomyClassificationState: TaxonomyClassificationState.FAILED,
        taxonomyClassificationError: message.slice(0, 4000),
        taxonomyClassifiedAt: new Date(),
      },
    });
  }
}
