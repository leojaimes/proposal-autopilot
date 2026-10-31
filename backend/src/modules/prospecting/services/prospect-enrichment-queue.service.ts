import { Injectable, Logger } from '@nestjs/common';
import { BusinessPainLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { WebsiteHealthInspectorService } from './website-health-inspector.service';
import { CompanyPainAnalyzerService } from './company-pain-analyzer.service';

const HUMAN_LOCKED_PAIN_STATUSES = new Set<BusinessPainLifecycleStatus>([
  BusinessPainLifecycleStatus.VERIFIED,
  BusinessPainLifecycleStatus.PITCHED,
  BusinessPainLifecycleStatus.FALSE_POSITIVE,
  BusinessPainLifecycleStatus.DISMISSED,
  BusinessPainLifecycleStatus.RESOLVED_BY_US,
  BusinessPainLifecycleStatus.RESOLVED_EXTERNALLY,
]);

@Injectable()
export class ProspectEnrichmentQueueService {
  private readonly logger = new Logger(ProspectEnrichmentQueueService.name);
  private readonly pendingQueue: string[] = [];
  private readonly inFlightIds = new Set<string>();
  private activeWorkers = 0;
  private readonly maxConcurrency = 5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly websiteInspector: WebsiteHealthInspectorService,
    private readonly painAnalyzer: CompanyPainAnalyzerService,
  ) {}

  enqueueBusinessIds(businessIds: string[]): number {
    let added = 0;
    for (const id of businessIds) {
      if (!id || this.inFlightIds.has(id) || this.pendingQueue.includes(id)) {
        continue;
      }
      this.pendingQueue.push(id);
      added++;
    }

    if (added > 0) {
      setImmediate(() => this.drainQueue());
    }
    return added;
  }

  getQueueSnapshot(): { queued: number; activeWorkers: number } {
    return {
      queued: this.pendingQueue.length,
      activeWorkers: this.activeWorkers,
    };
  }

  async enrichSingleBusinessNow(businessId: string): Promise<void> {
    const business = await this.prisma.prospectedBusiness.findUnique({
      where: { id: businessId },
      include: {
        detectedPains: {
          include: { painCatalog: true },
        },
      },
    });

    if (!business) return;

    try {
      const report = await this.websiteInspector.inspectWebsite(business.websiteUrl);
      const isBrokenWebsite = report.category === 'DOWN_OR_EXPIRED';
      const isSlowOrInsecureWebsite = report.category === 'SLOW_OR_INSECURE';

      const rawSnippets = Array.isArray((business.painAnalysis as any)?.sampleReviews)
        ? ((business.painAnalysis as any).sampleReviews as string[])
        : [];

      const diagnosis = await this.painAnalyzer.analyzeAsync({
        name: business.name,
        category: business.category ?? undefined,
        city: business.city ?? undefined,
        websiteUrl: business.websiteUrl,
        websiteHttpStatus: report.httpStatus,
        isBrokenWebsite,
        isSlowOrInsecureWebsite,
        rating: business.rating ? Number(business.rating) : 4.5,
        reviewsCount: business.reviewsCount,
        reviewsSnippets: rawSnippets,
        priceLevel: business.priceLevel,
        ownershipType: business.ownershipType,
      });

      await this.prisma.$transaction(async (tx) => {
        const existingByCatalogId = new Map(
          business.detectedPains.map((p) => [p.painCatalogId, p]),
        );

        for (const item of diagnosis.detectedPains) {
          let catalogId = item.painCatalogId;
          if (!catalogId) {
            const cat = await tx.companyPainCatalog.findUnique({ where: { code: item.code } });
            catalogId = cat?.id;
          }
          if (!catalogId) continue;

          const existing = existingByCatalogId.get(catalogId);
          // Respect human lifecycle states — never overwrite audited/dismissed/resolved records
          if (existing && HUMAN_LOCKED_PAIN_STATUSES.has(existing.status)) {
            continue;
          }

          await tx.prospectedBusinessPain.upsert({
            where: {
              uq_business_pain_catalog: {
                businessId: business.id,
                painCatalogId: catalogId,
              },
            },
            create: {
              tenantId: business.tenantId,
              businessId: business.id,
              painCatalogId: catalogId,
              status: BusinessPainLifecycleStatus.DETECTED,
              isPrimary: item.isPrimary,
              confidence: item.confidence,
              adjustedTicketUsd: item.adjustedTicketUsd,
              evidence: item.evidence as any,
              customPitchOwner: item.pitchOwner,
              customPitchGatekeeper: item.pitchGatekeeper,
              customPitchEnterprise: item.pitchEnterprise,
            },
            update: {
              isPrimary: item.isPrimary,
              confidence: item.confidence,
              adjustedTicketUsd: item.adjustedTicketUsd,
              evidence: item.evidence as any,
              customPitchOwner: item.pitchOwner,
              customPitchGatekeeper: item.pitchGatekeeper,
              customPitchEnterprise: item.pitchEnterprise,
            },
          });
        }

        // Recompute active primary pain respecting dismissed/false-positive overrides
        const activePains = await tx.prospectedBusinessPain.findMany({
          where: {
            businessId: business.id,
            status: {
              in: [
                BusinessPainLifecycleStatus.DETECTED,
                BusinessPainLifecycleStatus.VERIFIED,
                BusinessPainLifecycleStatus.PITCHED,
              ],
            },
          },
          include: { painCatalog: true },
          orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }],
        });

        const topActive = activePains[0];
        await tx.prospectedBusiness.update({
          where: { id: business.id },
          data: {
            websiteHttpStatus: report.httpStatus,
            websiteCheckedAt: new Date(),
            enrichmentStatus: 'ENRICHED',
            ...(topActive
              ? {
                  primaryPain:
                    topActive.painCatalog.categoryEnum ?? diagnosis.primaryPain,
                  painConfidence: topActive.confidence,
                  suggestedOffer: topActive.painCatalog.suggestedOffer,
                  estimatedTicketUsd: topActive.adjustedTicketUsd,
                  salesPitchDraft:
                    business.ownershipType === 'INDEPENDENT'
                      ? topActive.customPitchOwner ?? diagnosis.salesPitchDraft
                      : topActive.customPitchEnterprise ?? diagnosis.salesPitchDraft,
                }
              : {}),
          },
        });
      });
    } catch (err: any) {
      this.logger.warn(`Async enrichment failed for business ${businessId}: ${err?.message}`);
      await this.prisma.prospectedBusiness
        .update({
          where: { id: businessId },
          data: { enrichmentStatus: 'FAILED', websiteCheckedAt: new Date() },
        })
        .catch(() => {});
    }
  }

  private drainQueue(): void {
    while (this.activeWorkers < this.maxConcurrency && this.pendingQueue.length > 0) {
      const nextId = this.pendingQueue.shift()!;
      if (this.inFlightIds.has(nextId)) continue;

      this.inFlightIds.add(nextId);
      this.activeWorkers++;

      this.enrichSingleBusinessNow(nextId)
        .catch((err) => {
          this.logger.error(`Unexpected enrichment worker error for ${nextId}: ${err?.message}`);
        })
        .finally(() => {
          this.inFlightIds.delete(nextId);
          this.activeWorkers--;
          if (this.pendingQueue.length > 0) {
            setImmediate(() => this.drainQueue());
          }
        });
    }
  }
}

