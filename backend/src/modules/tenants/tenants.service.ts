import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';

export interface UpdatePositioningDto {
  offerHeadline: string;
  targetAudience: string;
  voiceRules?: string[];
  coreRoles?: string[];
  hybridRoles?: string[];
  tangentialRoles?: string[];
  excludedRoles?: string[];
}

export interface CreateProofStoryDto {
  keyCode: string;
  companyOrProduct: string;
  impactMetric: string;
  domainTags?: string[];
}

export interface FullProfileSyncDto {
  offerHeadline: string;
  targetAudience: string;
  voiceRules?: string[];
  coreRoles: string[];
  hybridRoles: string[];
  tangentialRoles: string[];
  excludedRoles: string[];
  searchKeywords?: string[];
  minHourlyRate?: number;
  minBudgetFixed?: number;
  proofStories?: Array<{
    keyCode: string;
    companyOrProduct: string;
    impactMetric: string;
    domainTags?: string[];
  }>;
}

export interface UpdateScrapeConfigDto {
  searchKeywords: string[];
  minBudgetFixed?: number;
  minHourlyRate?: number;
  recencyDays?: number;
  verifiedPaymentOnly?: boolean;
  targetCountries?: string[];
  targetRegions?: string[];
  excludedCountries?: string[];
  geoFilterMode?: string;
}

export interface SaveCredentialDto {
  provider: 'APIFY' | 'ANTHROPIC' | 'OPENAI' | 'GEMINI' | 'BEDROCK';
  apiKey: string;
}

import { ClaudeProposalService } from '../proposals/claude-proposal.service';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly claudeProposal: ClaudeProposalService,
  ) {}

  /**
   * Obtiene la configuración completa del Workspace (Perfil, Historias, Filtros de Scrape, Llaves)
   */
  async getTenantConfig(tenantId: string) {
    let tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        positioningProfiles: {
          include: { proofStories: true },
        },
        scrapeConfigs: true,
        credentials: {
          select: { id: true, provider: true, isHealthy: true, lastValidatedAt: true },
        },
      },
    });

    // Si el workspace aún no existe en DB, creamos su perfil base automáticamente
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Personal Workspace',
          slug: 'personal-workspace',
          baseHourlyRate: 65.00,
          positioningProfiles: {
            create: {
              offerHeadline: 'AI-native UX for product teams: senior design-system, prototyping, and research.',
              targetAudience: 'Seed-to-Series B SaaS founders and product leads.',
              voiceRules: ['First person peer-to-peer', 'No em dashes anywhere', 'Sell result before tool'],
            },
          },
          scrapeConfigs: {
            create: {
              searchKeywords: [
                'UX research', 'design system', 'Figma design system', 
                'AI product design', 'usability testing', 'AI prototyping', 
                'vibe coding', 'agentic workflow design', 'N8N automation design', 'GenAI UX'
              ],
              minBudgetFixed: 1000.00,
              minHourlyRate: 40.00,
              recencyDays: 3,
              verifiedPaymentOnly: true,
            },
          },
        },
        include: {
          positioningProfiles: {
            include: { proofStories: true },
          },
          scrapeConfigs: true,
          credentials: {
            select: { id: true, provider: true, isHealthy: true, lastValidatedAt: true },
          },
        },
      });
    }

    return tenant;
  }

  /**
   * Actualiza el perfil de posicionamiento (Oferta, Audiencia y Reglas de Voz)
   */
  async updatePositioning(tenantId: string, dto: UpdatePositioningDto) {
    const tenant = await this.getTenantConfig(tenantId);
    let profile = tenant.positioningProfiles[0];

    if (profile) {
      return this.prisma.positioningProfile.update({
        where: { id: profile.id },
        data: {
          offerHeadline: dto.offerHeadline,
          targetAudience: dto.targetAudience,
          voiceRules: dto.voiceRules || profile.voiceRules,
          ...(dto.coreRoles && { coreRoles: dto.coreRoles }),
          ...(dto.hybridRoles && { hybridRoles: dto.hybridRoles }),
          ...(dto.tangentialRoles && { tangentialRoles: dto.tangentialRoles }),
          ...(dto.excludedRoles && { excludedRoles: dto.excludedRoles }),
        },
      });
    }

    return this.prisma.positioningProfile.create({
      data: {
        tenantId,
        offerHeadline: dto.offerHeadline,
        targetAudience: dto.targetAudience,
        voiceRules: dto.voiceRules || [],
        coreRoles: dto.coreRoles || undefined,
        hybridRoles: dto.hybridRoles || undefined,
        tangentialRoles: dto.tangentialRoles || undefined,
        excludedRoles: dto.excludedRoles || undefined,
      },
    });
  }

  /**
   * Sincroniza atómicamente el perfil completo (Oferta, Audiencia, Taxonomía, Queries, Filtros y Proof Stories)
   */
  async syncFullProfile(tenantId: string, dto: FullProfileSyncDto) {
    const tenant = await this.getTenantConfig(tenantId);
    let profile = tenant.positioningProfiles[0];

    if (!profile) {
      profile = await this.prisma.positioningProfile.create({
        data: {
          tenantId,
          offerHeadline: dto.offerHeadline,
          targetAudience: dto.targetAudience,
          voiceRules: dto.voiceRules || ['First person peer-to-peer', 'No em dashes anywhere', 'Sell result before tool'],
          coreRoles: dto.coreRoles,
          hybridRoles: dto.hybridRoles,
          tangentialRoles: dto.tangentialRoles,
          excludedRoles: dto.excludedRoles,
        },
        include: { proofStories: true },
      });
    } else {
      await this.prisma.positioningProfile.update({
        where: { id: profile.id },
        data: {
          offerHeadline: dto.offerHeadline,
          targetAudience: dto.targetAudience,
          voiceRules: dto.voiceRules || profile.voiceRules,
          coreRoles: dto.coreRoles,
          hybridRoles: dto.hybridRoles,
          tangentialRoles: dto.tangentialRoles,
          excludedRoles: dto.excludedRoles,
        },
      });
    }

    // Actualizar configuración de Scraping
    let config = tenant.scrapeConfigs[0];
    if (config) {
      await this.prisma.scrapeConfig.update({
        where: { id: config.id },
        data: {
          ...(dto.searchKeywords && dto.searchKeywords.length > 0 && { searchKeywords: dto.searchKeywords }),
          ...(dto.minHourlyRate !== undefined && { minHourlyRate: dto.minHourlyRate }),
          ...(dto.minBudgetFixed !== undefined && { minBudgetFixed: dto.minBudgetFixed }),
        },
      });
    }

    // Sincronizar Proof Stories (reemplazar atómicamente por las nuevas)
    if (dto.proofStories && dto.proofStories.length > 0) {
      await this.prisma.proofStory.deleteMany({
        where: { positioningProfileId: profile.id },
      });

      for (const story of dto.proofStories) {
        await this.prisma.proofStory.create({
          data: {
            positioningProfileId: profile.id,
            keyCode: story.keyCode.toUpperCase().replace(/\s+/g, '_'),
            companyOrProduct: story.companyOrProduct,
            impactMetric: story.impactMetric,
            domainTags: story.domainTags || [],
          },
        });
      }
    }

    return this.getTenantConfig(tenantId);
  }

  /**
   * Crea una nueva Proof Story para el generador de propuestas
   */
  async createProofStory(tenantId: string, dto: CreateProofStoryDto) {
    const tenant = await this.getTenantConfig(tenantId);
    let profile = tenant.positioningProfiles[0];

    return this.prisma.proofStory.create({
      data: {
        positioningProfileId: profile.id,
        keyCode: dto.keyCode.toUpperCase().replace(/\s+/g, '_'),
        companyOrProduct: dto.companyOrProduct,
        impactMetric: dto.impactMetric,
        domainTags: dto.domainTags || [],
      },
    });
  }

  /**
   * Actualiza una Proof Story existente
   */
  async updateProofStory(id: string, dto: Partial<CreateProofStoryDto>) {
    return this.prisma.proofStory.update({
      where: { id },
      data: {
        ...(dto.keyCode && { keyCode: dto.keyCode.toUpperCase().replace(/\s+/g, '_') }),
        ...(dto.companyOrProduct && { companyOrProduct: dto.companyOrProduct }),
        ...(dto.impactMetric && { impactMetric: dto.impactMetric }),
        ...(dto.domainTags && { domainTags: dto.domainTags }),
      },
    });
  }

  /**
   * Elimina una Proof Story
   */
  async deleteProofStory(id: string) {
    return this.prisma.proofStory.delete({
      where: { id },
    });
  }

  /**
   * Actualiza la configuración de filtros de scraping
   */
  async updateScrapeConfig(tenantId: string, dto: UpdateScrapeConfigDto) {
    const tenant = await this.getTenantConfig(tenantId);
    let config = tenant.scrapeConfigs[0];

    if (config) {
      return this.prisma.scrapeConfig.update({
        where: { id: config.id },
        data: {
          searchKeywords: dto.searchKeywords,
          ...(dto.minBudgetFixed !== undefined && { minBudgetFixed: dto.minBudgetFixed }),
          ...(dto.minHourlyRate !== undefined && { minHourlyRate: dto.minHourlyRate }),
          ...(dto.recencyDays !== undefined && { recencyDays: dto.recencyDays }),
          ...(dto.verifiedPaymentOnly !== undefined && { verifiedPaymentOnly: dto.verifiedPaymentOnly }),
          ...(dto.targetCountries !== undefined && { targetCountries: dto.targetCountries }),
          ...(dto.targetRegions !== undefined && { targetRegions: dto.targetRegions }),
          ...(dto.excludedCountries !== undefined && { excludedCountries: dto.excludedCountries }),
          ...(dto.geoFilterMode !== undefined && { geoFilterMode: dto.geoFilterMode }),
        },
      });
    }

    return this.prisma.scrapeConfig.create({
      data: {
        tenantId,
        searchKeywords: dto.searchKeywords,
        minBudgetFixed: dto.minBudgetFixed ?? 1000.00,
        minHourlyRate: dto.minHourlyRate ?? 40.00,
        recencyDays: dto.recencyDays ?? 3,
        verifiedPaymentOnly: dto.verifiedPaymentOnly ?? true,
        targetCountries: dto.targetCountries ?? [],
        targetRegions: dto.targetRegions ?? [],
        excludedCountries: dto.excludedCountries ?? [],
        geoFilterMode: dto.geoFilterMode ?? 'WEIGHTED_PREFERENCE',
      },
    });
  }

  /**
   * Guarda o actualiza credenciales de LLM o Scraper (Apify, Anthropic, OpenAI, Gemini, Bedrock)
   */
  async saveCredential(tenantId: string, dto: SaveCredentialDto) {
    return this.prisma.tenantCredential.upsert({
      where: {
        uq_tenant_provider: {
          tenantId,
          provider: dto.provider,
        },
      },
      create: {
        tenantId,
        provider: dto.provider,
        encryptedPayload: dto.apiKey,
        isHealthy: true,
        lastValidatedAt: new Date(),
      },
      update: {
        encryptedPayload: dto.apiKey,
        isHealthy: true,
        lastValidatedAt: new Date(),
      },
    });
  }

  /**
   * Sintetiza queries de búsqueda optimizadas para Upwork usando Gemini
   * basándose en la oferta de transformación y las Proof Stories activas.
   */
  async synthesizeSearchQueries(tenantId: string) {
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    if (!profile) {
      throw new NotFoundException(`No se encontró un perfil activo para el tenant ${tenantId}`);
    }

    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({
      where: { tenantId },
    });

    const synthesis = await this.claudeProposal.synthesizeQueries({
      offerHeadline: profile.offerHeadline,
      targetAudience: profile.targetAudience,
      proofStories: profile.proofStories.map(ps => ({
        companyOrProduct: ps.companyOrProduct,
        impactMetric: ps.impactMetric,
        domainTags: ps.domainTags,
      })),
    });

    // Actualizar ScrapeConfig con las queries generadas
    if (scrapeConfig) {
      await this.prisma.scrapeConfig.update({
        where: { id: scrapeConfig.id },
        data: {
          searchKeywords: synthesis.searchQueries,
          minHourlyRate: scrapeConfig.minHourlyRate || synthesis.suggestedMinHourlyRate,
          minBudgetFixed: scrapeConfig.minBudgetFixed || synthesis.suggestedMinBudgetFixed,
        },
      });
    }

    return {
      success: true,
      queries: synthesis.searchQueries,
      suggestedMinHourlyRate: synthesis.suggestedMinHourlyRate,
      suggestedMinBudgetFixed: synthesis.suggestedMinBudgetFixed,
      rationale: synthesis.rationale,
    };
  }

  /**
   * Sintetiza la taxonomía dinámica de afinidad de roles (4 capas) con IA
   * basándose en la oferta de transformación y las Proof Stories activas.
   */
  async synthesizeTaxonomy(tenantId: string) {
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    if (!profile) {
      throw new NotFoundException(`No se encontró un perfil activo para el tenant ${tenantId}`);
    }

    const synthesis = await this.claudeProposal.synthesizeTaxonomy({
      offerHeadline: profile.offerHeadline,
      targetAudience: profile.targetAudience,
      proofStories: profile.proofStories.map(ps => ({
        companyOrProduct: ps.companyOrProduct,
        impactMetric: ps.impactMetric,
        domainTags: ps.domainTags,
      })),
    });

    // Guardar la taxonomía sintetizada en el perfil
    const updated = await this.prisma.positioningProfile.update({
      where: { id: profile.id },
      data: {
        coreRoles: synthesis.coreRoles,
        hybridRoles: synthesis.hybridRoles,
        tangentialRoles: synthesis.tangentialRoles,
        excludedRoles: synthesis.excludedRoles,
      },
    });

    return {
      success: true,
      coreRoles: updated.coreRoles,
      hybridRoles: updated.hybridRoles,
      tangentialRoles: updated.tangentialRoles,
      excludedRoles: updated.excludedRoles,
      rationale: synthesis.rationale,
    };
  }
}
