import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketTaxonomyKind, Prisma } from '@prisma/client';
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
  description?: string;
  domainTags?: string[];
}

export interface FullProfileSyncDto {
  profileId?: string;
  createProfileId?: string;
  personaName?: string;
  roleTitle?: string;
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
  verifiedPaymentOnly?: boolean;
  weightSkill?: number;
  weightAi?: number;
  weightClient?: number;
  weightRecency?: number;
  targetCountries?: string[];
  targetRegions?: string[];
  excludedCountries?: string[];
  geoFilterMode?: string;
  categoryPolicies?: Array<{
    taxonomyNodeId: string;
    lane: 'CORE' | 'ADJACENT' | 'EXCLUDED';
    includeTerms?: string[];
    excludeTerms?: string[];
    priority?: number;
    aiLeverageEnabled?: boolean;
  }>;
  proofStories?: Array<{
    keyCode: string;
    companyOrProduct: string;
    impactMetric: string;
    description?: string;
    domainTags?: string[];
  }>;
}

export interface CreateProfileDto {
  personaName: string;
  roleTitle?: string;
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
import {
  PublicationsCvDocument,
  DEFAULT_PUBLICATIONS_CV_DOCUMENT,
} from '../proposals/cv-tailor.service';

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
          orderBy: { isActive: 'desc' },
          include: { proofStories: true, categoryPolicies: { include: { taxonomyNode: true } } },
        },
        scrapeConfigs: true,
        credentials: {
          select: { id: true, provider: true, isHealthy: true, lastValidatedAt: true },
        },
      },
    });

    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Workspace',
          slug: `workspace-${tenantId.slice(0, 8)}`,
        },
        include: {
          positioningProfiles: {
            include: { proofStories: true, categoryPolicies: { include: { taxonomyNode: true } } },
          },
          scrapeConfigs: true,
          credentials: {
            select: { id: true, provider: true, isHealthy: true, lastValidatedAt: true },
          },
        },
      });
    }

    const enabledProviders = (process.env.ENABLED_SCRAPING_PROVIDERS || 'UPWORK')
      .split(',')
      .map(p => p.trim().toUpperCase())
      .filter(Boolean);

    return {
      ...tenant,
      enabledScrapingProviders: enabledProviders,
    };
  }

  async getMarketTaxonomy() {
    return this.prisma.marketTaxonomyNode.findMany({
      where: {
        isActive: true,
        kind: { in: [MarketTaxonomyKind.SUBCATEGORY, MarketTaxonomyKind.OCCUPATION] },
      },
      select: { id: true, slug: true, name: true, kind: true, parentId: true },
      orderBy: [{ kind: 'asc' }, { name: 'asc' }],
    });
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
    await this.getTenantConfig(tenantId);
    if (dto.profileId && dto.createProfileId) {
      throw new BadRequestException('profileId y createProfileId no pueden enviarse juntos.');
    }
    if (dto.createProfileId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(dto.createProfileId)) {
      throw new BadRequestException('createProfileId debe ser un UUID válido.');
    }
    const personaName = dto.personaName?.trim() || 'Consultor';
    const profileData = {
      personaName,
      roleTitle: dto.roleTitle?.trim() || undefined,
      offerHeadline: dto.offerHeadline,
      targetAudience: dto.targetAudience,
      voiceRules: dto.voiceRules,
      coreRoles: dto.coreRoles,
      hybridRoles: dto.hybridRoles,
      tangentialRoles: dto.tangentialRoles,
      excludedRoles: dto.excludedRoles,
      searchKeywords: dto.searchKeywords,
      minHourlyRate: dto.minHourlyRate,
      minBudgetFixed: dto.minBudgetFixed,
      verifiedPaymentOnly: dto.verifiedPaymentOnly,
      weightSkill: dto.weightSkill,
      weightAi: dto.weightAi,
      weightClient: dto.weightClient,
      weightRecency: dto.weightRecency,
      targetCountries: dto.targetCountries,
      targetRegions: dto.targetRegions,
      excludedCountries: dto.excludedCountries,
      geoFilterMode: dto.geoFilterMode,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.positioningProfile.updateMany({ where: { tenantId }, data: { isActive: false } });

      const createData = {
        tenantId,
        ...profileData,
        offerHeadline: dto.offerHeadline,
        targetAudience: dto.targetAudience,
        coreRoles: dto.coreRoles || [],
        hybridRoles: dto.hybridRoles || [],
        tangentialRoles: dto.tangentialRoles || [],
        excludedRoles: dto.excludedRoles || [],
        isActive: true,
      };
      let profile;
      if (dto.profileId) {
        profile = await this.updateProfileById(tx, tenantId, dto.profileId, profileData);
      } else if (dto.createProfileId) {
        profile = await tx.positioningProfile.create({
          data: { id: dto.createProfileId, ...createData },
        });
      } else {
        const existing = await tx.positioningProfile.findFirst({
          where: { tenantId, personaName },
          orderBy: { updatedAt: 'desc' },
        });
        profile = existing
          ? await tx.positioningProfile.update({ where: { id: existing.id }, data: { ...profileData, isActive: true } })
          : await tx.positioningProfile.create({ data: createData });
      }

      if (dto.proofStories !== undefined) {
        await tx.proofStory.deleteMany({ where: { positioningProfileId: profile.id } });
        if (dto.proofStories.length > 0) {
          await tx.proofStory.createMany({
            data: dto.proofStories.map((story) => ({
              positioningProfileId: profile.id,
              keyCode: story.keyCode.toUpperCase().replace(/\s+/g, '_').slice(0, 50),
              companyOrProduct: story.companyOrProduct,
              impactMetric: story.impactMetric,
              description: story.description || '',
              domainTags: story.domainTags || [],
            })),
          });
        }
      }

      if (dto.categoryPolicies !== undefined) {
        const requestedNodeIds = [...new Set(dto.categoryPolicies.map((policy) => policy.taxonomyNodeId))];
        if (requestedNodeIds.length !== dto.categoryPolicies.length) {
          throw new BadRequestException('Cada categoría sólo puede tener una política por perfil.');
        }

        const validNodes = await tx.marketTaxonomyNode.findMany({
          where: {
            id: { in: requestedNodeIds },
            isActive: true,
            kind: { in: [MarketTaxonomyKind.SUBCATEGORY, MarketTaxonomyKind.OCCUPATION] },
          },
          select: { id: true },
        });
        if (validNodes.length !== requestedNodeIds.length) {
          throw new BadRequestException('La política contiene una categoría inexistente o inactiva.');
        }

        await tx.profileCategoryPolicy.deleteMany({ where: { profileId: profile.id } });
        if (dto.categoryPolicies.length > 0) {
          await tx.profileCategoryPolicy.createMany({
            data: dto.categoryPolicies.map((policy) => ({
              tenantId,
              profileId: profile.id,
              taxonomyNodeId: policy.taxonomyNodeId,
              lane: policy.lane,
              includeTerms: policy.includeTerms || [],
              excludeTerms: policy.excludeTerms || [],
              priority: policy.priority ?? 0,
              aiLeverageEnabled: policy.aiLeverageEnabled === true,
            })),
          });
        }
      }

      await this.syncActiveProfileToScrapeConfig(tenantId, profile.id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getTenantConfig(tenantId);
  }

  async createBlankProfile(tenantId: string, dto: CreateProfileDto) {
    const personaName = dto.personaName.trim();
    if (!personaName) {
      throw new BadRequestException('El nombre del perfil es obligatorio.');
    }

    await this.getTenantConfig(tenantId);
    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.positioningProfile.findFirst({
        where: { tenantId, personaName },
      });
      if (existing) throw new BadRequestException('Ya existe un perfil con ese nombre.');

      await tx.positioningProfile.updateMany({ where: { tenantId }, data: { isActive: false } });
      const profile = await tx.positioningProfile.create({
        data: {
          tenantId,
          personaName,
          roleTitle: dto.roleTitle?.trim() || 'Consultor',
          offerHeadline: '',
          targetAudience: '',
          voiceRules: [],
          coreRoles: [],
          hybridRoles: [],
          tangentialRoles: [],
          excludedRoles: [],
          isActive: true,
        },
      });
      await this.syncActiveProfileToScrapeConfig(tenantId, profile.id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getTenantConfig(tenantId);
  }

  async deleteProfile(tenantId: string, profileId: string) {
    await this.prisma.$transaction(async (tx) => {
      const profiles = await tx.positioningProfile.findMany({ where: { tenantId } });
      if (profiles.length <= 1) throw new BadRequestException('El workspace debe conservar al menos un perfil.');

      const profile = profiles.find((candidate) => candidate.id === profileId);
      if (!profile) throw new NotFoundException('Perfil no encontrado.');

      if (profile.isActive) {
        const next = profiles.find((candidate) => candidate.id !== profileId)!;
        await tx.positioningProfile.update({ where: { id: next.id }, data: { isActive: true } });
        await this.syncActiveProfileToScrapeConfig(tenantId, next.id, tx);
      }

      // Keep historical job outcomes while allowing this editable profile to go away.
      // The database FKs enforce the same policy for every deletion path.
      await tx.fitEvaluation.updateMany({
        where: { positioningProfileId: profileId },
        data: { positioningProfileId: null },
      });
      await tx.proposal.updateMany({
        where: { positioningProfileId: profileId },
        data: { positioningProfileId: null },
      });
      await tx.positioningProfile.delete({ where: { id: profileId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.getTenantConfig(tenantId);
  }

  private async updateProfileById(
    tx: Prisma.TransactionClient,
    tenantId: string,
    profileId: string,
    profileData: Prisma.PositioningProfileUpdateInput,
  ) {
    const existing = await tx.positioningProfile.findFirst({ where: { id: profileId, tenantId } });
    if (!existing) throw new NotFoundException('Perfil no encontrado.');
    return tx.positioningProfile.update({ where: { id: profileId }, data: { ...profileData, isActive: true } });
  }

  private async syncActiveProfileToScrapeConfig(
    tenantId: string,
    profileId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const profile = await client.positioningProfile.findFirst({ where: { id: profileId, tenantId } });
    if (!profile) return;

    const data = {
      searchKeywords: profile.searchKeywords,
      minBudgetFixed: profile.minBudgetFixed,
      minHourlyRate: profile.minHourlyRate,
      verifiedPaymentOnly: profile.verifiedPaymentOnly,
      targetCountries: profile.targetCountries,
      targetRegions: profile.targetRegions,
      excludedCountries: profile.excludedCountries,
      geoFilterMode: profile.geoFilterMode,
    };
    const config = await client.scrapeConfig.findFirst({ where: { tenantId } });
    if (config) {
      await client.scrapeConfig.update({ where: { id: config.id }, data });
      return;
    }
    await client.scrapeConfig.create({ data: { tenantId, ...data } });
  }

  /**
   * Activa un perfil existente mediante su ID, dentro del tenant actual.
   */
  async activateProfile(tenantId: string, profileId: string) {
    if (!profileId) throw new BadRequestException('profileId es obligatorio.');
    await this.prisma.$transaction(async (tx) => {
      const profile = await tx.positioningProfile.findFirst({ where: { id: profileId, tenantId } });
      if (!profile) throw new NotFoundException('Perfil no encontrado.');
      await tx.positioningProfile.updateMany({ where: { tenantId }, data: { isActive: false } });
      await tx.positioningProfile.update({ where: { id: profile.id }, data: { isActive: true } });
      await this.syncActiveProfileToScrapeConfig(tenantId, profile.id, tx);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
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
        description: dto.description || '',
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
        ...(dto.description !== undefined && { description: dto.description }),
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

  /**
   * Sintetiza el perfil completo a partir de texto o archivo (.pdf, .txt, .md)
   */
  async synthesizeProfileFromCv(tenantId: string, rawText?: string, file?: { buffer: Buffer; originalname: string }) {
    let textToProcess = rawText || '';

    if (file && file.buffer) {
      const ext = (file.originalname || '').toLowerCase();
      if (ext.endsWith('.pdf')) {
        try {
          const pdfModule = require('pdf-parse');
          if (typeof pdfModule === 'function') {
            const pdfData = await pdfModule(file.buffer);
            textToProcess = pdfData?.text || '';
          } else if (pdfModule.PDFParse) {
            const parser = new pdfModule.PDFParse({ data: file.buffer });
            const res = await parser.getText();
            textToProcess = (res && typeof res === 'object' && res.text) ? res.text : (typeof res === 'string' ? res : '');
          } else if (pdfModule.default && typeof pdfModule.default === 'function') {
            const pdfData = await pdfModule.default(file.buffer);
            textToProcess = pdfData?.text || '';
          } else {
            throw new Error('Módulo de parseo de PDF no expone un método compatible');
          }
        } catch (err: any) {
          throw new BadRequestException(`Error procesando archivo PDF: ${err.message}`);
        }
      } else {
        textToProcess = file.buffer.toString('utf-8');
      }
    }

    if (!textToProcess.trim()) {
      throw new BadRequestException('Se requiere texto de CV o un archivo (.pdf, .txt, .md) válido.');
    }

    const synthesis = await this.claudeProposal.synthesizeProfileFromCv(textToProcess);

    return {
      success: true,
      data: synthesis,
    };
  }

  /**
   * Obtiene el CV maestro (Publications ATS) asociado a un perfil.
   * Si no tiene baseCv guardado, retorna la plantilla por defecto.
   */
  async getProfileCv(tenantId: string, profileId: string): Promise<PublicationsCvDocument> {
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { id: profileId, tenantId },
    });

    if (!profile) {
      throw new NotFoundException(`Perfil no encontrado para el tenant ${tenantId}`);
    }

    if (profile.baseCv && typeof profile.baseCv === 'object') {
      return profile.baseCv as unknown as PublicationsCvDocument;
    }

    const user = await this.prisma.tenantUser.findFirst({ where: { tenantId } });
    return {
      ...DEFAULT_PUBLICATIONS_CV_DOCUMENT,
      ownerEmail: user?.email || DEFAULT_PUBLICATIONS_CV_DOCUMENT.ownerEmail,
    };
  }

  /**
   * Actualiza el CV maestro en formato Publications ATS en la base de datos para un perfil.
   */
  async updateProfileCv(tenantId: string, profileId: string, baseCv: PublicationsCvDocument) {
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { id: profileId, tenantId },
    });

    if (!profile) {
      throw new NotFoundException(`Perfil no encontrado para el tenant ${tenantId}`);
    }

    const updated = await this.prisma.positioningProfile.update({
      where: { id: profileId },
      data: {
        baseCv: baseCv as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      profileId: updated.id,
      baseCv: updated.baseCv,
    };
  }

  /**
   * Ingesta un CV (desde archivo PDF o texto), lo traduce y estructura con Gemini
   * bajo el formato exacto de Publications (ats-cv) y lo guarda directamente en PostgreSQL.
   */
  async parseAndSaveCv(
    tenantId: string,
    profileId?: string,
    rawText?: string,
    file?: { buffer: Buffer; originalname: string },
  ) {
    let textToProcess = rawText || '';

    if (file && file.buffer) {
      const ext = (file.originalname || '').toLowerCase();
      if (ext.endsWith('.pdf')) {
        try {
          const pdfModule = require('pdf-parse');
          if (typeof pdfModule === 'function') {
            const pdfData = await pdfModule(file.buffer);
            textToProcess = pdfData?.text || '';
          } else if (pdfModule.PDFParse) {
            const parser = new pdfModule.PDFParse({ data: file.buffer });
            const res = await parser.getText();
            textToProcess = (res && typeof res === 'object' && res.text) ? res.text : (typeof res === 'string' ? res : '');
          } else if (pdfModule.default && typeof pdfModule.default === 'function') {
            const pdfData = await pdfModule.default(file.buffer);
            textToProcess = pdfData?.text || '';
          } else {
            throw new Error('Módulo de parseo de PDF no expone un método compatible');
          }
        } catch (err: any) {
          throw new BadRequestException(`Error procesando archivo PDF: ${err.message}`);
        }
      } else {
        textToProcess = file.buffer.toString('utf-8');
      }
    }

    if (!textToProcess.trim()) {
      throw new BadRequestException('Se requiere texto de CV o un archivo (.pdf, .txt, .md) válido.');
    }

    let profile = profileId
      ? await this.prisma.positioningProfile.findFirst({ where: { id: profileId, tenantId } })
      : await this.prisma.positioningProfile.findFirst({ where: { tenantId, isActive: true } });

    if (!profile) {
      profile = await this.prisma.positioningProfile.findFirst({ where: { tenantId } });
    }

    if (!profile) {
      throw new NotFoundException('No existe un perfil de posicionamiento para asociar el CV en este tenant.');
    }

    const tenantUser = await this.prisma.tenantUser.findFirst({ where: { tenantId } });
    const ownerEmail = tenantUser?.email || 'leo.jaimes.estevez@gmail.com';

    const structuredCv = await this.claudeProposal.parseCvToPublicationsDocument(textToProcess, ownerEmail);

    const updated = await this.prisma.positioningProfile.update({
      where: { id: profile.id },
      data: {
        baseCv: structuredCv as unknown as Prisma.InputJsonValue,
      },
    });

    return {
      success: true,
      profileId: updated.id,
      baseCv: structuredCv,
    };
  }
}
