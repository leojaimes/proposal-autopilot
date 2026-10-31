import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import {
  BusinessOperationalStatus,
  BusinessOwnershipType,
  BusinessPainLifecycleStatus,
  CompanyPainCategory,
  ContactOutcome,
  Prisma,
  ProspectedLeadStatus,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { NominatimGeocodingService, GeocodedCityResult } from './services/nominatim-geocoding.service';
import { CompanyPainAnalyzerService } from './services/company-pain-analyzer.service';
import { LambdaGoogleProspectingService } from './services/lambda-google-prospecting.service';
import { PhoneNormalizerService } from './services/phone-normalizer.service';
import { ChainDetectorService } from './services/chain-detector.service';
import { ProspectEnrichmentQueueService } from './services/prospect-enrichment-queue.service';
import { ContactCooldownPolicyService } from './services/contact-cooldown.service';
import { ScanAreaDto } from './dto/scan-area.dto';
import { ProspectingWebhookPayloadDto } from './dto/prospecting-webhook.dto';
import {
  CreateContactLogDto,
  EmailWebhookEventDto,
  GetLeadsQueryDto,
  UpdateBusinessPainStatusDto,
  UpsertPainCatalogDto,
} from './dto/prospecting-enterprise.dto';
import {
  isPointInsidePolygon,
  calculatePolygonBoundingBox,
  calculatePolygonAreaKm2,
  normalizePolygonCoordinates,
} from './utils/prospecting-geometry.utils';

const ACTIVE_PAIN_STATUSES: BusinessPainLifecycleStatus[] = [
  BusinessPainLifecycleStatus.DETECTED,
  BusinessPainLifecycleStatus.VERIFIED,
  BusinessPainLifecycleStatus.PITCHED,
];

const HUMAN_LOCKED_PAIN_STATUSES = new Set<BusinessPainLifecycleStatus>([
  BusinessPainLifecycleStatus.VERIFIED,
  BusinessPainLifecycleStatus.PITCHED,
  BusinessPainLifecycleStatus.FALSE_POSITIVE,
  BusinessPainLifecycleStatus.DISMISSED,
  BusinessPainLifecycleStatus.RESOLVED_BY_US,
  BusinessPainLifecycleStatus.RESOLVED_EXTERNALLY,
]);

const STALE_REVIEW_DAYS_THRESHOLD = 548; // ~18 months

interface RawIngestCandidate {
  placeId: string;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: number;
  businessStatus?: string;
  lastReviewDate?: string;
  reviewsSnippets?: string[];
  rawGoogleData?: unknown;
}

@Injectable()
export class ProspectingService {
  private readonly logger = new Logger(ProspectingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly geocoding: NominatimGeocodingService,
    private readonly painAnalyzer: CompanyPainAnalyzerService,
    private readonly phoneNormalizer: PhoneNormalizerService,
    private readonly chainDetector: ChainDetectorService,
    @Optional() private readonly enrichmentQueue?: ProspectEnrichmentQueueService,
    @Optional() private readonly contactCooldown?: ContactCooldownPolicyService,
    @Optional() private readonly lambdaGoogle?: LambdaGoogleProspectingService,
  ) {}

  async geocodeCity(
    city: string,
    state?: string,
    country: string = 'Mexico',
  ): Promise<GeocodedCityResult> {
    return this.geocoding.geocodeCity(city, state, country);
  }

  async getGeoPresets(countryCode?: string) {
    const where: Prisma.GeoPresetWhereInput = {};
    if (countryCode) {
      where.countryCode = countryCode.toUpperCase();
    }

    return this.prisma.geoPreset.findMany({
      where,
      orderBy: [
        { countryCode: 'asc' },
        { state: 'asc' },
        { isTactical: 'desc' },
        { city: 'asc' },
      ],
    });
  }

  async getPainCatalog(includeInactive: boolean = false) {
    return this.prisma.companyPainCatalog.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ priorityWeight: 'desc' }, { code: 'asc' }],
    });
  }

  async upsertPainCatalog(dto: UpsertPainCatalogDto) {
    const normalizedCode = dto.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!normalizedCode) {
      throw new BadRequestException('Pain catalog code cannot be empty');
    }

    const record = await this.prisma.companyPainCatalog.upsert({
      where: { code: normalizedCode },
      create: {
        code: normalizedCode,
        categoryEnum: dto.categoryEnum,
        name: dto.name.trim(),
        description: dto.description,
        suggestedOffer: dto.suggestedOffer,
        baseTicketUsd: dto.baseTicketUsd,
        monthlyRetainerUsd: dto.monthlyRetainerUsd ?? null,
        priorityWeight: dto.priorityWeight ?? 50,
        pitchTemplateOwner: dto.pitchTemplateOwner,
        pitchTemplateGatekeeper: dto.pitchTemplateGatekeeper,
        pitchTemplateEnterprise: dto.pitchTemplateEnterprise,
        detectionRules: (dto.detectionRules ?? {}) as Prisma.InputJsonValue,
        isActive: dto.isActive ?? true,
      },
      update: {
        categoryEnum: dto.categoryEnum,
        name: dto.name.trim(),
        description: dto.description,
        suggestedOffer: dto.suggestedOffer,
        baseTicketUsd: dto.baseTicketUsd,
        monthlyRetainerUsd: dto.monthlyRetainerUsd ?? null,
        priorityWeight: dto.priorityWeight ?? 50,
        pitchTemplateOwner: dto.pitchTemplateOwner,
        pitchTemplateGatekeeper: dto.pitchTemplateGatekeeper,
        pitchTemplateEnterprise: dto.pitchTemplateEnterprise,
        detectionRules: (dto.detectionRules ?? {}) as Prisma.InputJsonValue,
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    this.painAnalyzer.invalidateCache();
    return record;
  }

  async scanArea(dto: ScanAreaDto) {
    const tenantId = this.tenantContext.getTenantId();
    const {
      sector,
      center,
      radiusKm,
      city = 'Querétaro',
      state = 'Querétaro',
      country = 'Mexico',
      polygon,
    } = dto;

    const hasPolygon = Boolean(polygon && polygon.length >= 3);
    const normalizedPolygon = hasPolygon ? normalizePolygonCoordinates(polygon!) : null;

    let effectiveCenter = center;
    let polygonAreaKm2 = 0;

    if (normalizedPolygon && normalizedPolygon.length >= 3) {
      const bbox = calculatePolygonBoundingBox(normalizedPolygon);
      polygonAreaKm2 = calculatePolygonAreaKm2(normalizedPolygon);
      effectiveCenter = bbox.centroid;
      this.logger.log(
        `Starting polygon scan for "${sector}" with ${normalizedPolygon.length} vertices (~${polygonAreaKm2} km2) in ${city}`,
      );
    } else {
      this.logger.log(
        `Starting circular area scan for "${sector}" at [${center.lat}, ${center.lng}] with radius ${radiusKm}km in ${city}`,
      );
    }

    let rawCandidates: RawIngestCandidate[] = [];
    const provider = (process.env.GOOGLE_SCRAPING_PROVIDER || 'LAMBDA').toUpperCase();

    if (provider === 'LAMBDA' && this.lambdaGoogle) {
      try {
        const polygonCoords = normalizedPolygon
          ? normalizedPolygon.map((p) => ({ lat: p[0], lng: p[1] }))
          : undefined;

        rawCandidates = await this.lambdaGoogle.scrapeGoogleBusinesses({
          query: sector,
          center: effectiveCenter,
          radiusKm,
          polygon: polygonCoords,
          location: city,
          limit: 20,
        });
      } catch (err: any) {
        this.logger.warn(
          `Lambda Google scraping failed (${err?.message}). Activating local simulation fallback.`,
        );
        rawCandidates = this.generateAreaCandidates(
          sector,
          effectiveCenter,
          radiusKm,
          city,
          state,
          country,
          normalizedPolygon && normalizedPolygon.length >= 3 ? normalizedPolygon : undefined,
        );
      }
    } else {
      rawCandidates = this.generateAreaCandidates(
        sector,
        effectiveCenter,
        radiusKm,
        city,
        state,
        country,
        normalizedPolygon && normalizedPolygon.length >= 3 ? normalizedPolygon : undefined,
      );
    }

    const savedLeads = [];
    const idsToEnrich: string[] = [];

    for (const candidate of rawCandidates) {
      const persisted = await this.ingestCandidateIdempotently(tenantId, {
        ...candidate,
        city: candidate.city || city,
        state: candidate.state || state,
        country: candidate.country || country,
      });
      savedLeads.push(persisted);
      if (persisted.websiteUrl) {
        idsToEnrich.push(persisted.id);
      }
    }

    if (idsToEnrich.length > 0 && this.enrichmentQueue) {
      this.enrichmentQueue.enqueueBusinessIds(idsToEnrich);
    }

    return {
      message:
        hasPolygon && normalizedPolygon
          ? `Polygon scan completed. Identified ${savedLeads.length} businesses within ${polygonAreaKm2} km2.`
          : `Area scan completed. Identified ${savedLeads.length} businesses in ${city}.`,
      scannedSector: sector,
      center: effectiveCenter,
      radiusKm,
      city,
      polygon: normalizedPolygon || undefined,
      polygonAreaKm2: polygonAreaKm2 > 0 ? polygonAreaKm2 : undefined,
      polygonVertices: normalizedPolygon ? normalizedPolygon.length : undefined,
      leads: savedLeads,
    };
  }

  async handleWebhookPayload(payload: ProspectingWebhookPayloadDto) {
    const { event, tenantId, scanId, businesses = [] } = payload;
    this.logger.log(
      `Webhook Event [${event}] for scanId "${scanId}" (Tenant: ${tenantId}) with ${businesses.length} leads.`,
    );

    if (businesses.length === 0) {
      return { received: true, saved: 0, enqueuedForWebAudit: 0 };
    }

    let savedCount = 0;
    const idsToEnrich: string[] = [];

    for (const b of businesses) {
      const persisted = await this.ingestCandidateIdempotently(tenantId, {
        placeId: b.placeId,
        name: b.name,
        category: b.category,
        address: b.address,
        city: b.city,
        state: b.state,
        country: b.country || 'Mexico',
        latitude: b.latitude,
        longitude: b.longitude,
        websiteUrl: b.websiteUrl || null,
        phone: b.phone || null,
        email: b.email || null,
        rating: b.rating,
        reviewsCount: b.reviewsCount,
        priceLevel: b.priceLevel,
        businessStatus: b.businessStatus,
        lastReviewDate: b.lastReviewDate,
        reviewsSnippets: b.reviewsSnippets,
        rawGoogleData: b,
      });

      savedCount++;
      if (persisted.websiteUrl) {
        idsToEnrich.push(persisted.id);
      }
    }

    const enqueuedForWebAudit =
      idsToEnrich.length > 0 && this.enrichmentQueue
        ? this.enrichmentQueue.enqueueBusinessIds(idsToEnrich)
        : 0;

    return { received: true, saved: savedCount, enqueuedForWebAudit };
  }

  async getLeads(query?: GetLeadsQueryDto) {
    const tenantId = this.tenantContext.getTenantId();
    const now = new Date();
    const limit = query?.limit ?? 100;
    const page = query?.page;
    const skip = page && page > 1 ? (page - 1) * limit : 0;

    const where: Prisma.ProspectedBusinessWhereInput = {
      tenantId,
      ...(query?.includeBlacklisted ? {} : { doNotContact: false }),
      ...(query?.city ? { city: { contains: query.city, mode: 'insensitive' } } : {}),
      ...(query?.country ? { country: { contains: query.country, mode: 'insensitive' } } : {}),
      ...(query?.pain ? { primaryPain: query.pain } : {}),
      ...(query?.phoneType ? { phoneType: query.phoneType } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.excludeChains
        ? { ownershipType: BusinessOwnershipType.INDEPENDENT }
        : query?.ownershipType
          ? { ownershipType: query.ownershipType }
          : {}),
      ...(query?.excludeCooldown
        ? {
            OR: [{ contactCooldownUntil: null }, { contactCooldownUntil: { lte: now } }],
          }
        : {}),
      ...(query?.painCode
        ? {
            detectedPains: {
              some: {
                status: { in: ACTIVE_PAIN_STATUSES },
                painCatalog: { code: query.painCode.toUpperCase() },
              },
            },
          }
        : {}),
    };

    const leads = await this.prisma.prospectedBusiness.findMany({
      where,
      include: {
        corporateBrand: {
          select: {
            id: true,
            slug: true,
            name: true,
            rootDomain: true,
            headquartersCity: true,
            totalBranchesTracked: true,
          },
        },
        detectedPains: {
          where: { status: { in: ACTIVE_PAIN_STATUSES } },
          orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }],
          include: {
            painCatalog: {
              select: {
                id: true,
                code: true,
                name: true,
                suggestedOffer: true,
                baseTicketUsd: true,
                monthlyRetainerUsd: true,
              },
            },
          },
        },
      },
      orderBy: [{ scannedAt: 'desc' }, { reviewsCount: 'desc' }],
      skip,
      take: limit,
    });

    if (page !== undefined) {
      const total = await this.prisma.prospectedBusiness.count({ where });
      return {
        total,
        page,
        limit,
        leads,
      };
    }

    return leads;
  }

  async updateLeadStatus(id: string, status: ProspectedLeadStatus) {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.prisma.prospectedBusiness.updateMany({
      where: { id, tenantId },
      data: { status },
    });
    if (result.count === 0) {
      throw new NotFoundException(`Prospected business ${id} not found in tenant`);
    }
    return result;
  }

  async getBusinessPains(businessId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const business = await this.prisma.prospectedBusiness.findFirst({
      where: { id: businessId, tenantId },
      select: { id: true, name: true, ownershipType: true, priceLevel: true },
    });

    if (!business) {
      throw new NotFoundException(`Prospected business ${businessId} not found in tenant`);
    }

    const pains = await this.prisma.prospectedBusinessPain.findMany({
      where: { businessId, tenantId },
      include: { painCatalog: true },
      orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }, { detectedAt: 'desc' }],
    });

    return {
      business,
      pains,
    };
  }

  async updateBusinessPainStatus(
    businessId: string,
    painIdentifier: string,
    dto: UpdateBusinessPainStatusDto,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const actor =
      dto.verifiedBy ||
      this.tenantContext.getUserEmail() ||
      this.tenantContext.getUserId() ||
      'auditor';

    const business = await this.prisma.prospectedBusiness.findFirst({
      where: { id: businessId, tenantId },
    });

    if (!business) {
      throw new NotFoundException(`Prospected business ${businessId} not found in tenant`);
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      painIdentifier,
    );

    const targetPain = await this.prisma.prospectedBusinessPain.findFirst({
      where: {
        businessId,
        tenantId,
        ...(isUuid
          ? { OR: [{ id: painIdentifier }, { painCatalogId: painIdentifier }] }
          : { painCatalog: { code: painIdentifier.toUpperCase() } }),
      },
      include: { painCatalog: true },
    });

    if (!targetPain) {
      throw new NotFoundException(
        `Pain record "${painIdentifier}" not found for business ${businessId}`,
      );
    }

    const isTerminalStatus =
      dto.status === BusinessPainLifecycleStatus.FALSE_POSITIVE ||
      dto.status === BusinessPainLifecycleStatus.DISMISSED ||
      dto.status === BusinessPainLifecycleStatus.RESOLVED_BY_US ||
      dto.status === BusinessPainLifecycleStatus.RESOLVED_EXTERNALLY;

    return this.prisma.$transaction(async (tx) => {
      const updatedPain = await tx.prospectedBusinessPain.update({
        where: { id: targetPain.id },
        data: {
          status: dto.status,
          isPrimary: isTerminalStatus ? false : targetPain.isPrimary,
          dismissReason: dto.dismissReason ?? targetPain.dismissReason,
          verifiedBy: actor,
          resolvedAt: isTerminalStatus ? new Date() : null,
        },
        include: { painCatalog: true },
      });

      // Recompute which remaining active pain becomes primary
      const remainingActive = await tx.prospectedBusinessPain.findMany({
        where: {
          businessId,
          tenantId,
          status: { in: ACTIVE_PAIN_STATUSES },
        },
        include: { painCatalog: true },
        orderBy: [{ confidence: 'desc' }, { detectedAt: 'asc' }],
      });

      if (remainingActive.length > 0) {
        const nextPrimary = remainingActive[0];
        await tx.prospectedBusinessPain.updateMany({
          where: { businessId, tenantId },
          data: { isPrimary: false },
        });
        await tx.prospectedBusinessPain.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });

        await tx.prospectedBusiness.update({
          where: { id: businessId },
          data: {
            primaryPain: nextPrimary.painCatalog.categoryEnum,
            painConfidence: nextPrimary.confidence,
            suggestedOffer: nextPrimary.painCatalog.suggestedOffer,
            estimatedTicketUsd: nextPrimary.adjustedTicketUsd,
            salesPitchDraft:
              business.ownershipType === BusinessOwnershipType.INDEPENDENT
                ? nextPrimary.customPitchOwner
                : nextPrimary.customPitchEnterprise,
            ...(business.status === ProspectedLeadStatus.DISCOVERED
              ? { status: ProspectedLeadStatus.AUDITED }
              : {}),
          },
        });
      } else {
        await tx.prospectedBusiness.update({
          where: { id: businessId },
          data: {
            primaryPain: null,
            painConfidence: null,
            suggestedOffer: null,
            salesPitchDraft: null,
            ...(business.status === ProspectedLeadStatus.DISCOVERED
              ? { status: ProspectedLeadStatus.AUDITED }
              : {}),
          },
        });
      }

      return {
        updatedPain,
        activePainsRemaining: remainingActive.length,
      };
    });
  }

  async getBusinessContacts(businessId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const business = await this.prisma.prospectedBusiness.findFirst({
      where: { id: businessId, tenantId },
      select: {
        id: true,
        name: true,
        phoneE164: true,
        phoneType: true,
        email: true,
        emailDeliverability: true,
        lastContactedAt: true,
        contactCooldownUntil: true,
        contactAttemptsCount: true,
        doNotContact: true,
      },
    });

    if (!business) {
      throw new NotFoundException(`Prospected business ${businessId} not found in tenant`);
    }

    const contacts = await this.prisma.prospectContactLog.findMany({
      where: { businessId, tenantId },
      include: {
        painCatalog: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { contactedAt: 'desc' },
    });

    return {
      business,
      contacts,
    };
  }

  async recordBusinessContact(businessId: string, dto: CreateContactLogDto) {
    if (!this.contactCooldown) {
      throw new BadRequestException('ContactCooldownPolicyService is not configured');
    }
    return this.contactCooldown.recordContactInteraction({
      businessId,
      ...dto,
    });
  }

  async blacklistBusiness(businessId: string, reason: string) {
    if (!this.contactCooldown) {
      throw new BadRequestException('ContactCooldownPolicyService is not configured');
    }
    return this.contactCooldown.blacklistBusiness(businessId, reason);
  }

  async handleEmailWebhook(dto: EmailWebhookEventDto) {
    if (!this.contactCooldown) {
      throw new BadRequestException('ContactCooldownPolicyService is not configured');
    }
    return this.contactCooldown.handleEmailTelemetryWebhook(dto);
  }

  async getCorporateBrands(onlyWithTenantBranches: boolean = false) {
    const tenantId = this.tenantContext.getTenantId();
    const brands = await this.prisma.corporateBrand.findMany({
      where: onlyWithTenantBranches
        ? {
            branches: {
              some: { tenantId },
            },
          }
        : {},
      include: {
        _count: {
          select: {
            branches: {
              where: { tenantId },
            },
          },
        },
      },
      orderBy: [{ totalBranchesTracked: 'desc' }, { name: 'asc' }],
    });

    return brands.map((b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      rootDomain: b.rootDomain,
      industry: b.industry,
      countryScope: b.countryScope,
      headquartersCity: b.headquartersCity,
      corporateWebsite: b.corporateWebsite,
      corporateLinkedin: b.corporateLinkedin,
      isKnownFranchise: b.isKnownFranchise,
      tenantBranchesCount: b._count.branches,
      totalBranchesTracked: b.totalBranchesTracked,
    }));
  }

  async getCorporateBrandBranches(brandId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const brand = await this.prisma.corporateBrand.findUnique({
      where: { id: brandId },
    });

    if (!brand) {
      throw new NotFoundException(`Corporate brand ${brandId} not found`);
    }

    const branches = await this.prisma.prospectedBusiness.findMany({
      where: {
        tenantId,
        corporateBrandId: brandId,
      },
      include: {
        detectedPains: {
          where: { status: { in: ACTIVE_PAIN_STATUSES } },
          include: { painCatalog: true },
        },
      },
      orderBy: [{ city: 'asc' }, { reviewsCount: 'desc' }],
    });

    return {
      brand,
      branches,
    };
  }

  async getProspectingFunnelAnalytics() {
    const tenantId = this.tenantContext.getTenantId();
    const now = new Date();

    const [
      totalBusinesses,
      independentCount,
      chainCount,
      contactedCount,
      blacklistedCount,
      activeCooldownCount,
      painsGrouped,
      contacts,
    ] = await Promise.all([
      this.prisma.prospectedBusiness.count({ where: { tenantId } }),
      this.prisma.prospectedBusiness.count({
        where: { tenantId, ownershipType: BusinessOwnershipType.INDEPENDENT },
      }),
      this.prisma.prospectedBusiness.count({
        where: {
          tenantId,
          ownershipType: {
            in: [BusinessOwnershipType.CHAIN_BRANCH, BusinessOwnershipType.CORPORATE_HQ],
          },
        },
      }),
      this.prisma.prospectedBusiness.count({
        where: { tenantId, status: ProspectedLeadStatus.CONTACTED },
      }),
      this.prisma.prospectedBusiness.count({
        where: { tenantId, doNotContact: true },
      }),
      this.prisma.prospectedBusiness.count({
        where: { tenantId, contactCooldownUntil: { gt: now } },
      }),
      this.prisma.prospectedBusinessPain.findMany({
        where: { tenantId },
        include: { painCatalog: { select: { code: true, name: true } } },
      }),
      this.prisma.prospectContactLog.findMany({
        where: { tenantId },
        select: { channel: true, outcome: true },
      }),
    ]);

    const painStatsMap = new Map<
      string,
      {
        code: string;
        name: string;
        detected: number;
        verified: number;
        pitched: number;
        falsePositives: number;
        resolvedByUs: number;
      }
    >();

    for (const p of painsGrouped) {
      const code = p.painCatalog.code;
      const entry = painStatsMap.get(code) ?? {
        code,
        name: p.painCatalog.name,
        detected: 0,
        verified: 0,
        pitched: 0,
        falsePositives: 0,
        resolvedByUs: 0,
      };
      entry.detected++;
      if (p.status === BusinessPainLifecycleStatus.VERIFIED) entry.verified++;
      if (p.status === BusinessPainLifecycleStatus.PITCHED) entry.pitched++;
      if (p.status === BusinessPainLifecycleStatus.FALSE_POSITIVE) entry.falsePositives++;
      if (p.status === BusinessPainLifecycleStatus.RESOLVED_BY_US) entry.resolvedByUs++;
      painStatsMap.set(code, entry);
    }

    const channelStatsMap = new Map<
      string,
      {
        channel: string;
        attempts: number;
        connected: number;
        meetingsScheduled: number;
        closedWon: number;
      }
    >();

    for (const c of contacts) {
      const entry = channelStatsMap.get(c.channel) ?? {
        channel: c.channel,
        attempts: 0,
        connected: 0,
        meetingsScheduled: 0,
        closedWon: 0,
      };
      entry.attempts++;
      if (
        c.outcome === ContactOutcome.CONNECTED_PITCHED ||
        c.outcome === ContactOutcome.MEETING_SCHEDULED ||
        c.outcome === ContactOutcome.CLOSED_WON
      ) {
        entry.connected++;
      }
      if (c.outcome === ContactOutcome.MEETING_SCHEDULED) entry.meetingsScheduled++;
      if (c.outcome === ContactOutcome.CLOSED_WON) entry.closedWon++;
      channelStatsMap.set(c.channel, entry);
    }

    return {
      overview: {
        totalBusinesses,
        independentCount,
        chainCount,
        contactedCount,
        blacklistedCount,
        activeCooldownCount,
      },
      byPain: Array.from(painStatsMap.values()),
      byChannel: Array.from(channelStatsMap.values()).map((ch) => ({
        ...ch,
        positiveRatePct:
          ch.attempts > 0 ? Number(((ch.connected / ch.attempts) * 100).toFixed(1)) : 0,
      })),
    };
  }

  private async ingestCandidateIdempotently(tenantId: string, candidate: RawIngestCandidate) {
    const country = candidate.country || 'Mexico';
    const normalizedPhone = this.phoneNormalizer.normalize(candidate.phone, country);
    const chainResult = await this.chainDetector.resolveChainHierarchy({
      tenantId,
      placeId: candidate.placeId,
      name: candidate.name,
      websiteUrl: candidate.websiteUrl,
      category: candidate.category,
    });

    const operationalStatus = this.evaluateOperationalStatus(
      candidate.businessStatus,
      candidate.lastReviewDate,
    );

    const diagnosis = await this.painAnalyzer.analyzeAsync({
      name: candidate.name,
      category: candidate.category,
      city: candidate.city,
      websiteUrl: candidate.websiteUrl,
      rating: candidate.rating,
      reviewsCount: candidate.reviewsCount,
      reviewsSnippets: candidate.reviewsSnippets,
      priceLevel: candidate.priceLevel,
      ownershipType: chainResult.ownershipType,
    });

    const existing = await this.prisma.prospectedBusiness.findUnique({
      where: {
        uq_tenant_place: {
          tenantId,
          placeId: candidate.placeId,
        },
      },
      include: {
        detectedPains: true,
      },
    });

    const initialStatus =
      operationalStatus === BusinessOperationalStatus.CLOSED_PERMANENTLY
        ? ProspectedLeadStatus.DISQUALIFIED
        : ProspectedLeadStatus.DISCOVERED;

    const upsertedBusiness = await this.prisma.prospectedBusiness.upsert({
      where: {
        uq_tenant_place: {
          tenantId,
          placeId: candidate.placeId,
        },
      },
      create: {
        tenantId,
        corporateBrandId: chainResult.corporateBrandId,
        placeId: candidate.placeId,
        name: candidate.name,
        branchIdentifier: chainResult.branchIdentifier,
        rootDomain: chainResult.rootDomain,
        ownershipType: chainResult.ownershipType,
        operationalStatus,
        category: candidate.category,
        address: candidate.address,
        city: candidate.city,
        state: candidate.state,
        country,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        websiteUrl: candidate.websiteUrl || null,
        enrichmentStatus: candidate.websiteUrl ? 'PENDING' : 'NOT_APPLICABLE',
        phone: candidate.phone || null,
        phoneE164: normalizedPhone.phoneE164,
        phoneType: normalizedPhone.phoneType,
        email: candidate.email || null,
        emailType: this.classifyEmailType(candidate.email),
        rating: candidate.rating,
        reviewsCount: candidate.reviewsCount || 0,
        lastGoogleReviewAt: candidate.lastReviewDate ? new Date(candidate.lastReviewDate) : null,
        priceLevel: candidate.priceLevel ?? null,
        estimatedTicketUsd: diagnosis.estimatedTicketUsd,
        status: initialStatus,
        primaryPain: diagnosis.primaryPain,
        painConfidence: diagnosis.painConfidence,
        painAnalysis: {
          summary: diagnosis.detectedPainSummary,
          details: diagnosis.painAnalysisDetails,
          sampleReviews: candidate.reviewsSnippets || [],
          whatsappDigits: normalizedPhone.whatsappDigits,
        },
        suggestedOffer: diagnosis.suggestedOffer,
        salesPitchDraft: diagnosis.salesPitchDraft,
        rawGoogleData: (candidate.rawGoogleData ?? candidate) as Prisma.InputJsonValue,
      },
      update: {
        // Non-destructive CRM update: refresh Google telemetry, NEVER overwrite status/notes/cooldown
        corporateBrandId: existing?.corporateBrandId ?? chainResult.corporateBrandId,
        branchIdentifier: existing?.branchIdentifier ?? chainResult.branchIdentifier,
        rootDomain: chainResult.rootDomain ?? existing?.rootDomain,
        ownershipType: chainResult.ownershipType,
        operationalStatus,
        rating: candidate.rating ?? existing?.rating,
        reviewsCount: candidate.reviewsCount ?? existing?.reviewsCount ?? 0,
        websiteUrl: candidate.websiteUrl ?? existing?.websiteUrl ?? null,
        phone: candidate.phone ?? existing?.phone ?? null,
        phoneE164: normalizedPhone.phoneE164 ?? existing?.phoneE164,
        phoneType:
          normalizedPhone.phoneType !== 'UNKNOWN'
            ? normalizedPhone.phoneType
            : existing?.phoneType,
        priceLevel: candidate.priceLevel ?? existing?.priceLevel,
        scannedAt: new Date(),
      },
    });

    // Synchronize M:N pain rows while strictly preserving human lifecycle states
    const existingPainMap = new Map(
      (existing?.detectedPains || []).map((p) => [p.painCatalogId, p]),
    );

    for (const item of diagnosis.detectedPains) {
      let catalogId = item.painCatalogId;
      if (!catalogId) {
        const cat = await this.prisma.companyPainCatalog.findUnique({
          where: { code: item.code },
        });
        catalogId = cat?.id;
      }
      if (!catalogId) continue;

      const prev = existingPainMap.get(catalogId);
      if (prev && HUMAN_LOCKED_PAIN_STATUSES.has(prev.status)) {
        continue;
      }

      await this.prisma.prospectedBusinessPain.upsert({
        where: {
          uq_business_pain_catalog: {
            businessId: upsertedBusiness.id,
            painCatalogId: catalogId,
          },
        },
        create: {
          tenantId,
          businessId: upsertedBusiness.id,
          painCatalogId: catalogId,
          status: BusinessPainLifecycleStatus.DETECTED,
          isPrimary: item.isPrimary,
          confidence: item.confidence,
          adjustedTicketUsd: item.adjustedTicketUsd,
          evidence: item.evidence as unknown as Prisma.InputJsonValue,
          customPitchOwner: item.pitchOwner,
          customPitchGatekeeper: item.pitchGatekeeper,
          customPitchEnterprise: item.pitchEnterprise,
        },
        update: {
          confidence: item.confidence,
          adjustedTicketUsd: item.adjustedTicketUsd,
          evidence: item.evidence as unknown as Prisma.InputJsonValue,
          customPitchOwner: item.pitchOwner,
          customPitchGatekeeper: item.pitchGatekeeper,
          customPitchEnterprise: item.pitchEnterprise,
        },
      });
    }

    // Re-sync primary pain projection from active non-dismissed pains
    const activePains = await this.prisma.prospectedBusinessPain.findMany({
      where: {
        businessId: upsertedBusiness.id,
        status: { in: ACTIVE_PAIN_STATUSES },
      },
      include: { painCatalog: true },
      orderBy: [{ isPrimary: 'desc' }, { confidence: 'desc' }],
    });

    if (activePains.length > 0) {
      const top = activePains[0];
      return this.prisma.prospectedBusiness.update({
        where: { id: upsertedBusiness.id },
        data: {
          primaryPain: top.painCatalog.categoryEnum ?? diagnosis.primaryPain,
          painConfidence: top.confidence,
          suggestedOffer: top.painCatalog.suggestedOffer,
          estimatedTicketUsd: top.adjustedTicketUsd,
          salesPitchDraft:
            upsertedBusiness.ownershipType === BusinessOwnershipType.INDEPENDENT
              ? top.customPitchOwner ?? diagnosis.salesPitchDraft
              : top.customPitchEnterprise ?? diagnosis.salesPitchDraft,
        },
      });
    }

    return upsertedBusiness;
  }

  private evaluateOperationalStatus(
    businessStatus?: string,
    lastReviewDate?: string,
  ): BusinessOperationalStatus {
    const norm = (businessStatus || 'OPERATIONAL').toUpperCase();
    if (norm.includes('CLOSED_PERMANENTLY') || norm === 'PERMANENTLY_CLOSED') {
      return BusinessOperationalStatus.CLOSED_PERMANENTLY;
    }
    if (norm.includes('CLOSED_TEMPORARILY') || norm === 'TEMPORARILY_CLOSED') {
      return BusinessOperationalStatus.CLOSED_TEMPORARILY;
    }

    if (lastReviewDate) {
      const parsed = Date.parse(lastReviewDate);
      if (!Number.isNaN(parsed)) {
        const ageDays = (Date.now() - parsed) / (1000 * 60 * 60 * 24);
        if (ageDays > STALE_REVIEW_DAYS_THRESHOLD) {
          return BusinessOperationalStatus.STALE_OR_INACTIVE;
        }
      }
    }

    return BusinessOperationalStatus.OPERATIONAL;
  }

  private classifyEmailType(email?: string | null): string | null {
    if (!email || !email.includes('@')) return null;
    const prefix = email.split('@')[0].toLowerCase();
    const genericPrefixes = new Set([
      'info',
      'contacto',
      'contact',
      'ventas',
      'sales',
      'hola',
      'hello',
      'citas',
      'recepcion',
      'administracion',
      'admin',
      'soporte',
      'atencion',
    ]);
    return genericPrefixes.has(prefix) ? 'GENERIC_ROLE' : 'DIRECT_PERSON';
  }

  private generateAreaCandidates(
    sector: string,
    center: { lat: number; lng: number },
    radiusKm: number,
    city: string,
    state: string,
    country: string,
    polygon?: [number, number][],
  ): RawIngestCandidate[] {
    const sampleTemplates = [
      {
        namePrefix: 'Clínica & Especialidades',
        suffix: 'del Centro',
        hasWeb: false,
        phone: '+52 442 389 1204',
        rating: 4.8,
        reviewsCount: 112,
        reviewsSnippets: [
          'Excelente trato del doctor pero tardé 4 días en que me contestaran por WhatsApp para una consulta.',
        ],
      },
      {
        namePrefix: 'Centro Integral',
        suffix: 'San Francisco',
        hasWeb: true,
        webDomain: 'consultoriosanfrancisco.com.mx',
        phone: '+52 442 781 9920',
        rating: 3.9,
        reviewsCount: 47,
        reviewsSnippets: [
          'Citas mal coordinadas, llegué a mi horario y me hicieron esperar 1 hora y media.',
          'No tienen agenda online.',
        ],
      },
      {
        namePrefix: 'Grupo Profesional',
        suffix: 'Metropolitano',
        hasWeb: false,
        phone: '+52 442 612 4055',
        rating: 4.6,
        reviewsCount: 88,
        reviewsSnippets: [
          'Muy profesionales pero es imposible cotizar o ver precios si no vas en persona.',
        ],
      },
      {
        namePrefix: 'Servicios Especializados',
        suffix: 'Alteña',
        hasWeb: true,
        webDomain: 'altenaservicios.com.mx',
        phone: '+52 442 901 3341',
        rating: 4.2,
        reviewsCount: 34,
        reviewsSnippets: [
          'Llamas y nadie contesta el teléfono fijo, tuve que ir hasta allá solo a preguntar horarios.',
        ],
      },
      {
        namePrefix: 'Corporativo Comercial',
        suffix: 'del Bajío',
        hasWeb: true,
        webDomain: 'bajioservicioscorp.com.mx',
        phone: '+52 442 550 8219',
        rating: 4.5,
        reviewsCount: 65,
        reviewsSnippets: ['Buen servicio, instalaciones limpias y atención rápida.'],
      },
      {
        namePrefix: 'Industrias & Logística',
        suffix: 'Vanguardia',
        hasWeb: false,
        phone: '+52 442 119 8832',
        rating: 4.4,
        reviewsCount: 29,
        reviewsSnippets: ['No tienen catálogo web ni precios actualizados.'],
      },
    ];

    const bbox = polygon && polygon.length >= 3 ? calculatePolygonBoundingBox(polygon) : null;

    return sampleTemplates
      .map((tpl, i) => {
        let lat: number;
        let lng: number;

        if (polygon && polygon.length >= 3 && bbox) {
          const t = (i + 1) / (sampleTemplates.length + 1);
          lat = Number((bbox.minLat + (bbox.maxLat - bbox.minLat) * t).toFixed(6));
          lng = Number((bbox.minLng + (bbox.maxLng - bbox.minLng) * (0.3 + 0.4 * t)).toFixed(6));

          if (!isPointInsidePolygon([lat, lng], polygon)) {
            lat = Number((bbox.centroid.lat + (lat - bbox.centroid.lat) * 0.4).toFixed(6));
            lng = Number((bbox.centroid.lng + (lng - bbox.centroid.lng) * 0.4).toFixed(6));
          }
        } else {
          const angle = (i * 2 * Math.PI) / sampleTemplates.length;
          const distance = (radiusKm * 0.45) / 111;
          lat = Number((center.lat + Math.sin(angle) * distance).toFixed(6));
          lng = Number((center.lng + Math.cos(angle) * distance).toFixed(6));
        }

        const fullName = `${tpl.namePrefix} ${sector} ${tpl.suffix}`;
        const placeId =
          'gmaps_' +
          createHash('md5').update(`${fullName}_${city}_${lat}_${lng}`).digest('hex').slice(0, 16);

        return {
          placeId,
          name: fullName,
          category: sector,
          address: `Av. Comercial ${100 + i * 25}, Col. Centro, ${city}`,
          city,
          state,
          country,
          latitude: lat,
          longitude: lng,
          websiteUrl: tpl.hasWeb ? `https://${tpl.webDomain}` : undefined,
          phone: tpl.phone,
          rating: tpl.rating,
          reviewsCount: tpl.reviewsCount,
          reviewsSnippets: tpl.reviewsSnippets,
          rawGoogleData: {
            types: ['establishment', 'point_of_interest'],
            userRatingsTotal: tpl.reviewsCount,
            vicinity: `${city}, ${state}`,
            geometry: { location: { lat, lng } },
            insidePolygon: Boolean(polygon && polygon.length >= 3),
          },
        };
      })
      .filter((candidate) => {
        if (polygon && polygon.length >= 3 && candidate.latitude && candidate.longitude) {
          return isPointInsidePolygon([candidate.latitude, candidate.longitude], polygon);
        }
        return true;
      });
  }
}
