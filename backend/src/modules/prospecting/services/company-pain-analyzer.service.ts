import { Injectable, Logger, Optional } from '@nestjs/common';
import { BusinessOwnershipType, CompanyPainCategory } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { CANONICAL_PAIN_CATALOG } from '../constants/pain-catalog.constants';
import {
  isSocialOrDirectoryDomain,
  validateExternalBusinessUrlSync,
} from '../utils/url-safety.util';

export interface BusinessAnalysisInput {
  name: string;
  category?: string;
  city?: string;
  websiteUrl?: string | null;
  websiteHttpStatus?: number | null;
  isBrokenWebsite?: boolean;
  isSlowOrInsecureWebsite?: boolean;
  rating?: number;
  reviewsCount?: number;
  reviewsSnippets?: string[];
  priceLevel?: number | null;
  ownershipType?: BusinessOwnershipType;
  branchCount?: number;
}

export interface DetectedPainItem {
  painCatalogId?: string;
  code: string;
  categoryEnum: CompanyPainCategory;
  name: string;
  suggestedOffer: string;
  confidence: number;
  priorityScore: number;
  isPrimary: boolean;
  baseTicketUsd: number;
  adjustedTicketUsd: number;
  pitchOwner: string;
  pitchGatekeeper: string;
  pitchEnterprise: string;
  evidence: {
    hasWebsite: boolean;
    websiteHttpStatus?: number | null;
    matchedKeywords: string[];
    ratingObserved: number;
    sentimentScore: 'POSITIVE' | 'NEUTRAL' | 'CRITICAL_PAIN';
  };
}

export interface PainDiagnosisResult {
  primaryPain: CompanyPainCategory;
  painConfidence: number;
  detectedPainSummary: string;
  suggestedOffer: string;
  salesPitchDraft: string;
  estimatedTicketUsd: number;
  detectedPains: DetectedPainItem[];
  painAnalysisDetails: {
    hasWebsite: boolean;
    negativeReviewsFound: number;
    flaggedKeywords: string[];
    sentimentScore: 'POSITIVE' | 'NEUTRAL' | 'CRITICAL_PAIN';
  };
}

interface CatalogRuleRecord {
  id?: string;
  code: string;
  categoryEnum: CompanyPainCategory;
  name: string;
  suggestedOffer: string;
  baseTicketUsd: number;
  priorityWeight: number;
  pitchTemplateOwner: string;
  pitchTemplateGatekeeper: string;
  pitchTemplateEnterprise: string;
  detectionRules: {
    requiresNoWebsite?: boolean;
    requiresBrokenWebsite?: boolean;
    keywords?: string[];
    minKeywordMatches?: number;
    maxRatingThreshold?: number;
    defaultConfidence?: number;
  };
}

const PRICE_LEVEL_MULTIPLIERS: Record<number, number> = {
  1: 0.7,
  2: 1.0,
  3: 1.5,
  4: 2.2,
};

@Injectable()
export class CompanyPainAnalyzerService {
  private readonly logger = new Logger(CompanyPainAnalyzerService.name);
  private catalogCache: CatalogRuleRecord[] | null = null;
  private cacheExpiresAt = 0;

  constructor(@Optional() private readonly prisma?: PrismaService) {}

  invalidateCache(): void {
    this.catalogCache = null;
    this.cacheExpiresAt = 0;
  }

  computePriceMultiplier(priceLevel?: number | null): number {
    if (!priceLevel || priceLevel < 1 || priceLevel > 4) {
      return 1.0;
    }
    return PRICE_LEVEL_MULTIPLIERS[priceLevel] ?? 1.0;
  }

  async analyzeAsync(input: BusinessAnalysisInput): Promise<PainDiagnosisResult> {
    const catalog = await this.loadCatalog();
    return this.evaluateAgainstCatalog(input, catalog);
  }

  analyze(input: BusinessAnalysisInput): PainDiagnosisResult {
    const fallbackCatalog = this.catalogCache ?? this.getFallbackCatalog();
    return this.evaluateAgainstCatalog(input, fallbackCatalog);
  }

  private evaluateAgainstCatalog(
    input: BusinessAnalysisInput,
    catalog: CatalogRuleRecord[],
  ): PainDiagnosisResult {
    const {
      name,
      city = 'su localidad',
      websiteUrl,
      websiteHttpStatus = null,
      isBrokenWebsite = false,
      isSlowOrInsecureWebsite = false,
      rating = 4.5,
      reviewsCount = 0,
      reviewsSnippets = [],
      priceLevel = null,
      ownershipType = BusinessOwnershipType.INDEPENDENT,
      branchCount = 1,
    } = input;

    const urlInfo = validateExternalBusinessUrlSync(websiteUrl);
    const hasOwnWebsite = Boolean(
      urlInfo.isSafe && urlInfo.normalizedUrl && !isSocialOrDirectoryDomain(urlInfo.rootDomain),
    );
    const websiteIsDown =
      isBrokenWebsite ||
      (websiteHttpStatus !== null &&
        (websiteHttpStatus === 0 ||
          websiteHttpStatus === 404 ||
          websiteHttpStatus === 410 ||
          websiteHttpStatus >= 500));

    const combinedReviews = (reviewsSnippets || []).join(' ').toLowerCase();
    const priceMultiplier = this.computePriceMultiplier(priceLevel);
    const matchedItems: DetectedPainItem[] = [];

    for (const rule of catalog) {
      const dr = rule.detectionRules || {};
      let matched = false;
      let confidence = dr.defaultConfidence ?? 0.7;
      let matchedKeywords: string[] = [];

      if (rule.code === 'WEBSITE_DOWN_OR_EXPIRED' || dr.requiresBrokenWebsite) {
        if (websiteUrl && !urlInfo.isSocialOrDirectory && websiteIsDown) {
          matched = true;
          confidence = 0.99;
          matchedKeywords = ['broken_website', `http_${websiteHttpStatus ?? 0}`];
        }
      } else if (rule.code === 'NO_WEBSITE' || dr.requiresNoWebsite) {
        if (!hasOwnWebsite && !websiteIsDown) {
          matched = true;
          confidence = 0.95;
          matchedKeywords = urlInfo.isSocialOrDirectory ? ['social_only'] : ['no_website'];
        }
      } else if (rule.code === 'OUTDATED_OR_SLOW_WEB') {
        if (hasOwnWebsite && !websiteIsDown && isSlowOrInsecureWebsite) {
          matched = true;
          confidence = 0.84;
          matchedKeywords = ['slow_or_http_insecure'];
        }
      } else if (Array.isArray(dr.keywords) && dr.keywords.length > 0) {
        matchedKeywords = dr.keywords.filter((kw) => combinedReviews.includes(kw.toLowerCase()));
        const minMatches = dr.minKeywordMatches ?? 1;

        if (rule.code === 'NO_ONLINE_BOOKING') {
          if (
            matchedKeywords.length >= 2 ||
            (matchedKeywords.length >= 1 && rating <= (dr.maxRatingThreshold ?? 4.3))
          ) {
            matched = true;
            confidence = matchedKeywords.length >= 2 ? 0.9 : 0.85;
          }
        } else if (rule.code === 'GENERAL_REPUTATION_ISSUE') {
          if (
            rating <= (dr.maxRatingThreshold ?? 3.9) &&
            (matchedKeywords.length >= minMatches || reviewsCount >= 10)
          ) {
            matched = true;
            confidence = 0.82;
            if (matchedKeywords.length === 0) {
              matchedKeywords = ['low_rating_reputation'];
            }
          }
        } else if (matchedKeywords.length >= minMatches) {
          matched = true;
        }
      }

      if (matched) {
        const adjustedTicketUsd = Math.round(rule.baseTicketUsd * priceMultiplier);
        const priorityScore = Number((rule.priorityWeight * confidence).toFixed(2));
        matchedItems.push({
          painCatalogId: rule.id,
          code: rule.code,
          categoryEnum: rule.categoryEnum,
          name: rule.name,
          suggestedOffer: rule.suggestedOffer,
          confidence,
          priorityScore,
          isPrimary: false,
          baseTicketUsd: rule.baseTicketUsd,
          adjustedTicketUsd,
          pitchOwner: this.interpolateTemplate(rule.pitchTemplateOwner, {
            name,
            city,
            rating,
            reviewsCount,
            branchCount,
          }),
          pitchGatekeeper: this.interpolateTemplate(rule.pitchTemplateGatekeeper, {
            name,
            city,
            rating,
            reviewsCount,
            branchCount,
          }),
          pitchEnterprise: this.interpolateTemplate(rule.pitchTemplateEnterprise, {
            name,
            city,
            rating,
            reviewsCount,
            branchCount,
          }),
          evidence: {
            hasWebsite: hasOwnWebsite,
            websiteHttpStatus,
            matchedKeywords,
            ratingObserved: rating,
            sentimentScore: confidence >= 0.82 ? 'CRITICAL_PAIN' : 'NEUTRAL',
          },
        });
      }
    }

    // Fallback when a business has a functioning website and no explicit negative keyword triggers
    if (matchedItems.length === 0) {
      const fallbackRule =
        catalog.find((r) => r.code === 'OUTDATED_OR_SLOW_WEB') ?? this.getFallbackCatalog()[7];
      const adjustedTicketUsd = Math.round(fallbackRule.baseTicketUsd * priceMultiplier);
      matchedItems.push({
        painCatalogId: fallbackRule.id,
        code: fallbackRule.code,
        categoryEnum: fallbackRule.categoryEnum,
        name: fallbackRule.name,
        suggestedOffer: fallbackRule.suggestedOffer,
        confidence: 0.65,
        priorityScore: Number((fallbackRule.priorityWeight * 0.65).toFixed(2)),
        isPrimary: true,
        baseTicketUsd: fallbackRule.baseTicketUsd,
        adjustedTicketUsd,
        pitchOwner: this.interpolateTemplate(fallbackRule.pitchTemplateOwner, {
          name,
          city,
          rating,
          reviewsCount,
          branchCount,
        }),
        pitchGatekeeper: this.interpolateTemplate(fallbackRule.pitchTemplateGatekeeper, {
          name,
          city,
          rating,
          reviewsCount,
          branchCount,
        }),
        pitchEnterprise: this.interpolateTemplate(fallbackRule.pitchTemplateEnterprise, {
          name,
          city,
          rating,
          reviewsCount,
          branchCount,
        }),
        evidence: {
          hasWebsite: hasOwnWebsite,
          websiteHttpStatus,
          matchedKeywords: ['mobile_conversion_optimization'],
          ratingObserved: rating,
          sentimentScore: 'NEUTRAL',
        },
      });
    }

    // Order strictly by priorityScore DESC, then confidence DESC
    matchedItems.sort((a, b) => b.priorityScore - a.priorityScore || b.confidence - a.confidence);
    matchedItems.forEach((item, idx) => {
      item.isPrimary = idx === 0;
    });

    const primary = matchedItems[0];
    const selectedDefaultPitch =
      ownershipType === BusinessOwnershipType.CHAIN_BRANCH ||
      ownershipType === BusinessOwnershipType.CORPORATE_HQ
        ? primary.pitchEnterprise
        : primary.pitchOwner;

    const allFlaggedKeywords = Array.from(
      new Set(matchedItems.flatMap((m) => m.evidence.matchedKeywords)),
    );

    return {
      primaryPain: primary.categoryEnum,
      painConfidence: primary.confidence,
      detectedPainSummary: `${primary.name}: ${primary.suggestedOffer} (${matchedItems.length} oportunidad(es) detectada(s)).`,
      suggestedOffer: primary.suggestedOffer,
      salesPitchDraft: selectedDefaultPitch,
      estimatedTicketUsd: primary.adjustedTicketUsd,
      detectedPains: matchedItems,
      painAnalysisDetails: {
        hasWebsite: hasOwnWebsite,
        negativeReviewsFound: allFlaggedKeywords.length,
        flaggedKeywords: allFlaggedKeywords,
        sentimentScore: primary.evidence.sentimentScore,
      },
    };
  }

  private async loadCatalog(): Promise<CatalogRuleRecord[]> {
    const now = Date.now();
    if (this.catalogCache && now < this.cacheExpiresAt) {
      return this.catalogCache;
    }

    if (this.prisma) {
      try {
        const rows = await this.prisma.companyPainCatalog.findMany({
          where: { isActive: true },
          orderBy: { priorityWeight: 'desc' },
        });
        if (rows.length > 0) {
          this.catalogCache = rows.map((r) => ({
            id: r.id,
            code: r.code,
            categoryEnum: r.categoryEnum ?? CompanyPainCategory.OUTDATED_OR_SLOW_WEB,
            name: r.name,
            suggestedOffer: r.suggestedOffer,
            baseTicketUsd: Number(r.baseTicketUsd),
            priorityWeight: r.priorityWeight,
            pitchTemplateOwner: r.pitchTemplateOwner,
            pitchTemplateGatekeeper: r.pitchTemplateGatekeeper,
            pitchTemplateEnterprise: r.pitchTemplateEnterprise,
            detectionRules: (r.detectionRules as any) || {},
          }));
          this.cacheExpiresAt = now + 5 * 60 * 1000;
          return this.catalogCache;
        }
      } catch (err: any) {
        this.logger.debug(`Using canonical pain fallback catalog: ${err?.message}`);
      }
    }

    return this.getFallbackCatalog();
  }

  private getFallbackCatalog(): CatalogRuleRecord[] {
    return CANONICAL_PAIN_CATALOG.map((item) => ({
      code: item.code,
      categoryEnum: item.categoryEnum,
      name: item.name,
      suggestedOffer: item.suggestedOffer,
      baseTicketUsd: item.baseTicketUsd,
      priorityWeight: item.priorityWeight,
      pitchTemplateOwner: item.pitchTemplateOwner,
      pitchTemplateGatekeeper: item.pitchTemplateGatekeeper,
      pitchTemplateEnterprise: item.pitchTemplateEnterprise,
      detectionRules: item.detectionRules,
    }));
  }

  private interpolateTemplate(
    template: string,
    vars: {
      name: string;
      city: string;
      rating: number;
      reviewsCount: number;
      branchCount: number;
    },
  ): string {
    return (template || '')
      .replace(/\{\{\s*name\s*\}\}/g, vars.name)
      .replace(/\{\{\s*city\s*\}\}/g, vars.city)
      .replace(/\{\{\s*rating\s*\}\}/g, String(vars.rating))
      .replace(/\{\{\s*reviewsCount\s*\}\}/g, String(vars.reviewsCount))
      .replace(/\{\{\s*branchCount\s*\}\}/g, String(vars.branchCount));
  }
}
