import { BadRequestException, Controller, Post, Get, Patch, Body, Param, Query, Logger, NotFoundException, Res, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { randomUUID } from 'node:crypto';
import { Response } from 'express';
import { ApifyService } from './apify.service';
import { ScrapingProgressService } from './scraping-progress.service';
import { ApifyJobAdapter } from './adapters/apify-job.adapter';
import { LinkedInJobAdapter } from './adapters/linkedin-job.adapter';
import { FitCalculatorService } from '../scoring/services/fit-calculator.service';
import { ClaudeProposalService } from '../proposals/claude-proposal.service';
import { TechnicalProposalPdfService } from '../proposals/technical-proposal-pdf.service';
import { CvTailorService, BaseCvData, CoverLetterData } from '../proposals/cv-tailor.service';
import { MarketTaxonomyAssignmentService } from './services/market-taxonomy-assignment.service';
import { MarketRadarOperationsService } from './services/market-radar-operations.service';
import { MarketRadarDecisionService } from './services/market-radar-decision.service';
import { MarketTrendCalculator } from './services/market-trend-calculator.service';
import { TaxonomyClassificationEventsService } from './services/taxonomy-classification-events.service';
import { TaxonomyClassificationWorkService } from './services/taxonomy-classification-work.service';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { BudgetType, JobStatus, MarketRadarDecisionStatus, StrategicLane, FitTier } from '@prisma/client';

export interface TriggerScrapeDto {
  keywords?: string[];
  maxResults?: number;
  limit?: number;
  platform?: 'UPWORK' | 'LINKEDIN';
  source?: 'UPWORK' | 'LINKEDIN';
}

export interface UpdateStatusDto {
  status: 'APPROVED' | 'SKIPPED' | 'APPLIED' | 'NEEDS_REVIEW';
}

export interface DecisionFactor {
  title: string;
  description: string;
}

export interface CreateMarketRadarDecisionDto {
  snapshotId: string;
  status: MarketRadarDecisionStatus;
  rationale: string;
  operator: string;
}

export interface UpdateMarketRadarDecisionOutcomeDto {
  jobPostId?: string;
  proposalId?: string;
  submittedAt?: string;
  qualifiedRepliedAt?: string;
  interviewedAt?: string;
  wonAt?: string;
  realizedValue?: number;
}

const TAXONOMY_CLASSIFIER_VERSION = 'taxonomy-rules-v1';

export function needsTaxonomyReprocessing(
  primaryAssignment: { classifierVersion: string } | undefined,
): boolean {
  return primaryAssignment?.classifierVersion !== TAXONOMY_CLASSIFIER_VERSION;
}

export function resolveJobPlatform(job: { externalUpworkId: string; rawApifyPayload?: any }): 'UPWORK' | 'LINKEDIN' {
  if (job?.rawApifyPayload?._platform === 'LINKEDIN') return 'LINKEDIN';
  if (job?.externalUpworkId?.startsWith('li:')) return 'LINKEDIN';
  return 'UPWORK';
}

@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);
  private readonly marketTrendCalculator = new MarketTrendCalculator();

  constructor(
    private readonly apifyService: ApifyService,
    private readonly progressService: ScrapingProgressService,
    private readonly apifyAdapter: ApifyJobAdapter,
    private readonly linkedInAdapter: LinkedInJobAdapter,
    private readonly fitCalculator: FitCalculatorService,
    private readonly claudeProposal: ClaudeProposalService,
    private readonly pdfService: TechnicalProposalPdfService,
    private readonly cvTailor: CvTailorService,
    private readonly marketTaxonomyAssignments: MarketTaxonomyAssignmentService,
    private readonly marketRadarOperations: MarketRadarOperationsService,
    private readonly marketRadarDecisions: MarketRadarDecisionService,
    private readonly taxonomyClassificationEvents: TaxonomyClassificationEventsService,
    private readonly taxonomyClassificationWork: TaxonomyClassificationWorkService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Resuelve el PositioningProfile activo (por query parameter o por flag isActive)
   */
  private async resolveActiveProfile(personaNameQuery?: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (personaNameQuery) {
      const clean = personaNameQuery.split(':')[0].trim();
      const profile = await this.prisma.positioningProfile.findFirst({
        where: {
          tenantId,
isActive: true,
          personaName: { contains: clean, mode: 'insensitive' },
        },
        include: { proofStories: true },
      });
      if (profile) return profile;
    }

    let active = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    if (!active) {
      active = await this.prisma.positioningProfile.findFirst({
        where: { tenantId },
        include: { proofStories: true },
      });
    }

    return active;
  }

  /**
   * SSE Endpoint: Stream de progreso en tiempo real para un batch específico
   */
  @Sse('progress/:batchId')
  streamBatchProgress(@Param('batchId') batchId: string): Observable<MessageEvent> {
    return this.progressService.getProgressStream(batchId);
  }

  /**
   * SSE Endpoint: Stream de progreso para el tenant activo
   */
  @Sse('progress')
  streamActiveProgress(): Observable<MessageEvent> {
    const tenantId = this.tenantContext.getTenantId();
    return this.progressService.getTenantProgressStream(tenantId);
  }

  /**
   * Dispara el scraping de Upwork en segundo plano y retorna de inmediato (<100ms).
   * El cliente se conecta al endpoint SSE /api/scraping/progress/:batchId para recibir el progreso en vivo.
   */
  @Post('trigger')
  async triggerBatch(@Body() body: TriggerScrapeDto) {
    const tenantId = this.tenantContext.getTenantId();
    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });

    // 1. Resolver keywords dinámicas (Body > ScrapeConfig > Síntesis IA)
    let keywords = (body.keywords && body.keywords.length > 0) ? body.keywords : scrapeConfig?.searchKeywords;
    if (body.keywords && body.keywords.length > 0 && scrapeConfig) {
      await this.prisma.scrapeConfig.update({
        where: { id: scrapeConfig.id },
        data: { searchKeywords: body.keywords },
      });
      keywords = body.keywords;
    } else if (!keywords || keywords.length === 0) {
      const profile = await this.prisma.positioningProfile.findFirst({
        where: { tenantId, isActive: true },
        include: { proofStories: true },
      });
      if (profile && profile.proofStories.length > 0) {
        const synthesis = await this.claudeProposal.synthesizeQueries({
          offerHeadline: profile.offerHeadline,
          targetAudience: profile.targetAudience,
          proofStories: profile.proofStories.map(ps => ({
            companyOrProduct: ps.companyOrProduct,
            impactMetric: ps.impactMetric,
            domainTags: ps.domainTags,
          })),
        });
        keywords = synthesis.searchQueries;
        if (scrapeConfig) {
          await this.prisma.scrapeConfig.update({
            where: { id: scrapeConfig.id },
            data: { searchKeywords: keywords },
          });
        }
      } else if (profile && (profile.coreRoles?.length || profile.roleTitle || profile.offerHeadline)) {
        // Derivar dinámicamente de los roles y headline del perfil activo
        const candidateQueries = [
          ...(profile.coreRoles || []),
          profile.roleTitle,
          profile.offerHeadline,
        ].filter(Boolean) as string[];
        keywords = Array.from(new Set(candidateQueries)).slice(0, 5);
      } else {
        throw new BadRequestException('No se encontraron términos de búsqueda ni perfil activo configurado. Calibre su perfil de posicionamiento antes de scrapear.');
      }
    }

    const maxResults = body.maxResults || body.limit || 30;
    const platform: 'UPWORK' | 'LINKEDIN' = body.platform || body.source || 'UPWORK';

    const enabledProviders = (process.env.ENABLED_SCRAPING_PROVIDERS || 'UPWORK')
      .split(',')
      .map(p => p.trim().toUpperCase())
      .filter(Boolean);

    if (!enabledProviders.includes(platform)) {
      throw new BadRequestException(`El proveedor de scraping ${platform} no está habilitado en este entorno.`);
    }

    // 2. Asegurar que exista un Tenant por defecto para pruebas
    let tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      tenant = await this.prisma.tenant.create({
        data: {
          id: tenantId,
          name: 'Default Workspace',
          slug: 'default-workspace',
          baseHourlyRate: 65.00,
        },
      });
    }

    // 3. Registrar el inicio del BatchRun en PostgreSQL
    const batchRun = await this.prisma.batchRun.create({
      data: {
        tenantId,
        status: 'RUNNING',
      },
    });

    this.logger.log(`Iniciando batch asíncrono ${batchRun.id} para Tenant ${tenantId} con ${keywords.length} queries (${platform})`);

    // 4. Emitir evento inicial en el canal SSE
    this.progressService.emitProgress({
      batchId: batchRun.id,
      tenantId,
      step: 'STARTING',
      message: `Conectando con el motor y preparando queries (${platform})...`,
      percentage: 5,
    });

    // 5. Lanzar el pipeline en segundo plano (Desacoplado, no bloqueante)
    setImmediate(() => {
      this.executeBatchPipeline(batchRun.id, tenantId, keywords, maxResults, platform).catch(async (err) => {
        this.logger.error(`Error no controlado en background batch ${batchRun.id}:`, err);
        await this.prisma.batchRun.update({
          where: { id: batchRun.id },
          data: {
            finishedAt: new Date(),
            status: 'FAILED',
          },
        }).catch(() => {});

        this.progressService.emitProgress({
          batchId: batchRun.id,
          tenantId,
          step: 'ERROR',
          message: `Error en la extracción: ${err.message || 'Fallo de conexión'}`,
          percentage: 100,
          error: err.message,
        });
      });
    });

    // 6. Respuesta INMEDIATA al navegador (<100ms)
    return {
      success: true,
      batchRunId: batchRun.id,
      batchId: batchRun.id,
      status: 'RUNNING',
      platform,
      message: `Extracción iniciada en segundo plano (${platform}) con streaming SSE activo`,
      totalQueries: keywords.length,
      maxResults,
    };
  }

  /**
   * Ejecuta el pipeline completo de extracción, scoring y síntesis de propuestas en background,
   * emitiendo eventos de progreso continuos mediante SSE.
   */
  private async executeBatchPipeline(
    batchRunId: string,
    tenantId: string,
    keywords: string[],
    maxResults: number,
    platform: 'UPWORK' | 'LINKEDIN' = 'UPWORK',
  ): Promise<void> {
    const isLinkedIn = platform === 'LINKEDIN';

    // FASE 1: Scraper de Apify
    this.progressService.emitProgress({
      batchId: batchRunId,
      tenantId,
      step: 'APIFY_RUNNING',
      message: isLinkedIn
        ? `🕷️ Apify buscando hasta ${maxResults} vacantes frescas en LinkedIn...`
        : `🕷️ Apify buscando hasta ${maxResults} vacantes frescas en Upwork...`,
      percentage: 15,
    });

    // Obtener países objetivo dinámicamente del perfil activo o configuración de scrape
    const activeProfileForScrape = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
    });
    const scrapeConfigForScrape = await this.prisma.scrapeConfig.findFirst({
      where: { tenantId },
    });
    const targetLocations = (
      activeProfileForScrape?.targetCountries?.length ? activeProfileForScrape.targetCountries :
      scrapeConfigForScrape?.targetCountries?.length ? scrapeConfigForScrape.targetCountries :
      []
    );

    const rawJobs = isLinkedIn
      ? await this.apifyService.runLinkedInScraper(keywords, maxResults, targetLocations)
      : await this.apifyService.runUpworkScraper(keywords, maxResults);
    this.logger.log(`[Batch ${batchRunId}] Se recibieron ${rawJobs.length} empleos desde Apify (${platform})`);

    if (!rawJobs || rawJobs.length === 0) {
      await this.prisma.batchRun.update({
        where: { id: batchRunId },
        data: {
          finishedAt: new Date(),
          jobsFound: 0,
          highFitCount: 0,
          mediumFitCount: 0,
          status: 'COMPLETED',
        },
      });

      this.progressService.emitProgress({
        batchId: batchRunId,
        tenantId,
        step: 'COMPLETED',
        message: 'No se encontraron vacantes nuevas con los filtros especificados.',
        percentage: 100,
        totalJobs: 0,
        highFitCount: 0,
      });
      return;
    }

    // FASE 2: Normalización & Scoring 0-100
    this.progressService.emitProgress({
      batchId: batchRunId,
      tenantId,
      step: 'SCORING',
      message: `🧠 ${rawJobs.length} vacantes descargadas. Calculando FitScore 0-100...`,
      percentage: 40,
      totalJobs: rawJobs.length,
    });

    let highFitCount = 0;
    let mediumFitCount = 0;
    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });
    const activeProfile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });
    const scoredCandidates: Array<{ jobPost: any; evaluation: any }> = [];
    const taxonomyRules = await this.marketTaxonomyAssignments.loadActiveRules();
    const taxonomyVersion = Math.max(1, ...taxonomyRules.map((rule) => rule.taxonomyVersion || 1));

    // FASE 2: Normalización & Scoring 0-100 para todas las vacantes
    for (let idx = 0; idx < rawJobs.length; idx++) {
      const raw = rawJobs[idx];
      const normalized = isLinkedIn
        ? this.linkedInAdapter.normalizeRaw(raw)
        : this.apifyAdapter.normalizeRaw(raw);
      if (!normalized.externalId) continue;

      const externalUpworkId = isLinkedIn
        ? (normalized.externalId.startsWith('li:') ? normalized.externalId : `li:${normalized.externalId}`)
        : normalized.externalId;

      const payloadWithMeta = {
        ...(normalized.rawPayload as any),
        _platform: platform,
        companyName: normalized.companyName,
        applyUrl: normalized.jobUrl,
      };

      // Upsert JobPost
      const jobPost = await this.prisma.$transaction(async (tx) => {
        const persistedJob = await tx.jobPost.upsert({
        where: {
          uq_tenant_external_job: {
            tenantId,
            externalUpworkId,
          },
        },
        create: {
          tenant: { connect: { id: tenantId } },
          batchRun: batchRunId ? { connect: { id: batchRunId } } : undefined,
          externalUpworkId,
          title: normalized.title,
          description: normalized.description,
          budgetType: normalized.budgetType,
          budgetFixed: normalized.budgetFixed,
          hourlyMin: normalized.hourlyMin,
          hourlyMax: normalized.hourlyMax,
          clientCountry: normalized.clientCountry,
          clientRating: normalized.clientRating,
          clientTotalSpend: normalized.clientTotalSpend,
          proposalsCount: normalized.proposalsCount != null ? normalized.proposalsCount : 0,
          proposalsCountKnown: normalized.proposalsCountKnown,
          isPaymentVerified: normalized.isPaymentVerified,
          paymentVerificationKnown: normalized.paymentVerificationKnown,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt || new Date(),
          postedAtKnown: normalized.postedAtKnown,
          status: JobStatus.NEEDS_REVIEW,
          rawApifyPayload: payloadWithMeta,
        },
        update: {
          title: normalized.title,
          description: normalized.description,
          budgetType: normalized.budgetType,
          budgetFixed: normalized.budgetFixed,
          hourlyMin: normalized.hourlyMin,
          hourlyMax: normalized.hourlyMax,
          clientCountry: normalized.clientCountry,
          clientRating: normalized.clientRating,
          clientTotalSpend: normalized.clientTotalSpend,
          proposalsCount: normalized.proposalsCount != null ? normalized.proposalsCount : 0,
          proposalsCountKnown: normalized.proposalsCountKnown,
          isPaymentVerified: normalized.isPaymentVerified,
          paymentVerificationKnown: normalized.paymentVerificationKnown,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt || new Date(),
          postedAtKnown: normalized.postedAtKnown,
          rawApifyPayload: payloadWithMeta,
        },
        });
        await this.taxonomyClassificationWork.queue(tx, {
          tenantId,
          jobPostId: persistedJob.id,
          taxonomyVersion,
          batchId: batchRunId,
          input: {
            title: persistedJob.title,
            description: persistedJob.description,
            skills: normalized.skills || [],
          },
        });
        return persistedJob;
      });

      this.taxonomyClassificationEvents.enqueue({
        batchId: batchRunId,
        tenantId,
        jobPostId: jobPost.id,
        totalJobs: rawJobs.length,
      });

      // Cálculo Matemático del FitScore Deductivo
      const evaluation = this.fitCalculator.calculate({
        title: jobPost.title,
        description: jobPost.description,
        skills: normalized.skills,
        activeQueries: (keywords && keywords.length > 0) ? keywords : (scrapeConfig?.searchKeywords || []),
        taxonomy: activeProfile ? {
          coreRoles: activeProfile.coreRoles,
          hybridRoles: activeProfile.hybridRoles,
          tangentialRoles: activeProfile.tangentialRoles,
          excludedRoles: activeProfile.excludedRoles,
        } : undefined,
        weights: activeProfile ? {
          skill: activeProfile.weightSkill,
          ai: activeProfile.weightAi,
          client: activeProfile.weightClient,
          recency: activeProfile.weightRecency,
        } : undefined,
        clientTotalSpend: Number(jobPost.clientTotalSpend),
        clientRating: Number(jobPost.clientRating),
        clientCountry: jobPost.clientCountry || undefined,
        proposalsCount: normalized.proposalsCount != null ? normalized.proposalsCount : undefined,
        isPaymentVerified: jobPost.isPaymentVerified,
        postedDate: normalized.postedAt || undefined,
        targetCountries: scrapeConfig?.targetCountries || [],
        excludedCountries: scrapeConfig?.excludedCountries || [],
      });

      if (evaluation.fitTier === 'HIGH') highFitCount++;
      if (evaluation.fitTier === 'MEDIUM') mediumFitCount++;

      // Guardar FitEvaluation vinculado al activeProfile
      if (activeProfile) {
        await this.prisma.fitEvaluation.upsert({
          where: {
            uq_job_post_profile: {
              jobPostId: jobPost.id,
              positioningProfileId: activeProfile.id,
            },
          },
          create: {
            jobPostId: jobPost.id,
            positioningProfileId: activeProfile.id,
            overallScore: evaluation.overallScore,
            fitTier: evaluation.fitTier as FitTier,
            strategicLane: evaluation.strategicLane as StrategicLane,
            normalizedRole: evaluation.normalizedRole,
            skillScore: evaluation.skillScore,
            aiFeasibilityScore: evaluation.aiFeasibilityScore,
            clientQualityScore: evaluation.clientQualityScore,
            recencyScore: evaluation.recencyScore,
            isCapped: evaluation.isCapped,
            capReason: evaluation.capReason,
            summaryRationale: evaluation.summaryRationale,
            detectedGaps: evaluation.detectedGaps,
            suggestedProofStory: evaluation.suggestedProofStory,
          },
          update: {
            overallScore: evaluation.overallScore,
            fitTier: evaluation.fitTier as FitTier,
            strategicLane: evaluation.strategicLane as StrategicLane,
            normalizedRole: evaluation.normalizedRole,
            skillScore: evaluation.skillScore,
            aiFeasibilityScore: evaluation.aiFeasibilityScore,
            clientQualityScore: evaluation.clientQualityScore,
            recencyScore: evaluation.recencyScore,
            isCapped: evaluation.isCapped,
            capReason: evaluation.capReason,
            summaryRationale: evaluation.summaryRationale,
            detectedGaps: evaluation.detectedGaps,
            suggestedProofStory: evaluation.suggestedProofStory,
          },
        });
      }

      scoredCandidates.push({ jobPost, evaluation });

      // Emisión de progreso durante el scoring
      if ((idx + 1) % 10 === 0 || idx === rawJobs.length - 1) {
        const dynamicPct = 40 + Math.round(((idx + 1) / rawJobs.length) * 25);
        this.progressService.emitProgress({
          batchId: batchRunId,
          tenantId,
          step: 'SCORING',
          message: `🧠 Calculando FitScore (${idx + 1}/${rawJobs.length}) · ${highFitCount} High Fit detectados...`,
          percentage: dynamicPct,
          totalJobs: rawJobs.length,
          highFitCount,
          mediumFitCount,
        });
      }
    }

    // FASE 3: Síntesis Automática del "Top 3 Gold" con Gemini (~3-4s total, el resto bajo demanda)
    const top3Gold = scoredCandidates
      .filter(c => c.evaluation.fitTier !== 'LOW')
      .sort((a, b) => b.evaluation.overallScore - a.evaluation.overallScore)
      .slice(0, 3);

    for (let i = 0; i < top3Gold.length; i++) {
      const { jobPost, evaluation } = top3Gold[i];
      const dynamicPct = 65 + Math.round(((i + 1) / (top3Gold.length || 1)) * 30);

      this.progressService.emitProgress({
        batchId: batchRunId,
        tenantId,
        step: 'PROPOSAL_GENERATION',
        message: `✨ Redactando Top 3 Gold (#${i + 1}/${top3Gold.length}) con Gemini: "${jobPost.title.substring(0, 32)}..."`,
        percentage: dynamicPct,
        currentJobIndex: i + 1,
        totalJobs: top3Gold.length,
        currentJobTitle: jobPost.title,
        highFitCount,
        mediumFitCount,
      });

      try {
        const matchingStory = activeProfile?.proofStories?.find(s => s.keyCode === evaluation.suggestedProofStory) || activeProfile?.proofStories?.[0];
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: jobPost.title,
          jobDescription: jobPost.description,
          clientCountry: jobPost.clientCountry || undefined,
          proofStoryKey: matchingStory?.keyCode || evaluation.suggestedProofStory || 'SPOTLIGHT_AI',
          proofStoryCompany: matchingStory?.companyOrProduct,
          proofStoryMetric: matchingStory?.impactMetric,
          offerHeadline: activeProfile?.offerHeadline,
          targetAudience: activeProfile?.targetAudience,
          voiceRules: (activeProfile?.voiceRules as string[]) || undefined,
          normalizedRole: evaluation.normalizedRole,
          platform: resolveJobPlatform(jobPost),
          companyName: (jobPost.rawApifyPayload as any)?.companyName || undefined,
        });

        if (activeProfile) {
          await this.prisma.proposal.upsert({
            where: {
              uq_proposal_job_profile: {
                jobPostId: jobPost.id,
                positioningProfileId: activeProfile.id,
              },
            },
            create: {
              jobPostId: jobPost.id,
              positioningProfileId: activeProfile.id,
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
              publicWalkthroughSlug: `p-${jobPost.id.substring(0, 8)}-${(activeProfile.personaName || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 4)}`,
            },
            update: {
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            },
          });
        }
      } catch (err: any) {
        this.logger.warn(`Error sintetizando propuesta Top 3 Gold para ${jobPost.id}: ${err.message}`);
      }
    }

    // The Radar snapshot must only include jobs whose taxonomy assignment has settled.
    await this.taxonomyClassificationEvents.drain(batchRunId);
    const snapshotResult = await this.marketRadarOperations.rebuildAfterSuccessfulBatch(tenantId);

    // Actualizar BatchRun como COMPLETED únicamente cuando el radar persistió su snapshot.
    await this.prisma.batchRun.update({
      where: { id: batchRunId },
      data: {
        finishedAt: new Date(),
        jobsFound: rawJobs.length,
        highFitCount,
        mediumFitCount,
        status: 'COMPLETED',
      },
    });

    // FASE 4: Finalización exitosa
    this.progressService.emitProgress({
      batchId: batchRunId,
      tenantId,
      step: 'COMPLETED',
      message: `✅ ¡Lote completado! ${rawJobs.length} vacantes analizadas (${highFitCount} High Fit). Top 3 Gold listas para despacho.`,
      percentage: 100,
      totalJobs: rawJobs.length,
      highFitCount,
    });

    this.logger.log(`[Batch ${batchRunId}] Pipeline finalizado exitosamente: ${highFitCount} High Fit, ${mediumFitCount} Medium Fit. Radar: ${snapshotResult.categories} categorías, ${snapshotResult.deletedSnapshots} snapshots vencidos purgados.`);
  }

  @Get('market-radar/health')
  async getMarketRadarHealth() {
    const health = await this.marketRadarOperations.getHealth(this.tenantContext.getTenantId());
    return {
      success: true,
      data: {
        ...health,
        latestSnapshotAsOf: health.latestSnapshotAsOf?.toISOString().slice(0, 10) ?? null,
        latestCompletedScrapeAt: health.latestCompletedScrapeAt?.toISOString() ?? null,
      },
    };
  }

  @Post('market-radar/decisions')
  async createMarketRadarDecision(
    @Body() body: CreateMarketRadarDecisionDto,
    @Query('personaName') personaNameQuery?: string,
  ) {
    const profile = await this.resolveActiveProfile(personaNameQuery);
    const decision = await this.marketRadarDecisions.createDecision({
      tenantId: this.tenantContext.getTenantId(),
      profile,
      snapshotId: body.snapshotId,
      status: body.status,
      rationale: body.rationale,
      operator: body.operator,
    });
    return { success: true, data: decision };
  }

  @Patch('market-radar/decisions/:id/outcome')
  async updateMarketRadarDecisionOutcome(
    @Param('id') id: string,
    @Body() body: UpdateMarketRadarDecisionOutcomeDto,
  ) {
    const parseDate = (value: string | undefined) => value == null ? undefined : new Date(value);
    const dates = [body.submittedAt, body.qualifiedRepliedAt, body.interviewedAt, body.wonAt];
    if (dates.some((value) => value != null && Number.isNaN(new Date(value).getTime()))) {
      throw new BadRequestException('Las fechas de resultado deben usar un formato ISO válido.');
    }
    const outcome = await this.marketRadarDecisions.updateOutcome({
      tenantId: this.tenantContext.getTenantId(),
      decisionId: id,
      jobPostId: body.jobPostId,
      proposalId: body.proposalId,
      submittedAt: parseDate(body.submittedAt),
      qualifiedRepliedAt: parseDate(body.qualifiedRepliedAt),
      interviewedAt: parseDate(body.interviewedAt),
      wonAt: parseDate(body.wonAt),
      realizedValue: body.realizedValue,
    });
    return { success: true, data: outcome };
  }

  /**
   * GET /api/scraping/market-radar
   * Reads the latest persisted calculation for each taxonomy category. The
   * endpoint never reclassifies jobs or substitutes missing source data.
   */
  @Get('market-radar')
  async getPersistedMarketRadar(@Query('personaName') personaNameQuery?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const profile = await this.resolveActiveProfile(personaNameQuery);
    const [snapshots, operationalHealth, decisions] = await Promise.all([
      this.prisma.marketCategorySnapshot.findMany({
      where: { tenantId, isCurrent: true },
      orderBy: { asOf: 'desc' },
      include: {
        taxonomyNode: { select: { name: true, slug: true } },
        evidenceJobs: {
          select: {
            jobPost: {
              select: {
                id: true,
                title: true,
                jobUrl: true,
                postedAt: true,
                postedAtKnown: true,
                proposalsCount: true,
                proposalsCountKnown: true,
                budgetFixed: true,
                isPaymentVerified: true,
                paymentVerificationKnown: true,
              },
            },
          },
        },
        profileOpportunities: {
          where: { profileId: profile?.id ?? '__no_active_profile__' },
          select: {
            lane: true,
            profileFit: true,
            overallOpportunity: true,
            fitSampleJobs: true,
            profileEligibility: true,
            aiLeverageState: true,
            aiLeverageCapability: true,
            aiLeverageTask: true,
            aiLeverageExplanation: true,
          },
        },
      },
      }),
      this.marketRadarOperations.getHealth(tenantId),
      this.prisma.marketRadarDecision.findMany({
        where: { tenantId, positioningProfileId: profile?.id ?? '__no_active_profile__' },
        orderBy: { createdAt: 'desc' },
        include: { outcome: true },
      }),
    ]);
    const trendByTaxonomyNode = this.marketTrendCalculator.calculate(snapshots.map((snapshot) => ({
      taxonomyNodeId: snapshot.taxonomyNodeId,
      asOf: snapshot.asOf,
      demand30d: snapshot.demand30d,
      medianProposals: snapshot.medianProposals == null ? null : Number(snapshot.medianProposals),
      overallOpportunity: snapshot.profileOpportunities[0]?.overallOpportunity == null
        ? null
        : Number(snapshot.profileOpportunities[0].overallOpportunity),
    })));
    const newestByCategory = new Map<string, typeof snapshots[number]>();
    for (const snapshot of snapshots) {
      if (!newestByCategory.has(snapshot.taxonomyNodeId)) newestByCategory.set(snapshot.taxonomyNodeId, snapshot);
    }
    const latestDecisionBySnapshot = new Map<string, typeof decisions[number]>();
    for (const decision of decisions) {
      if (!latestDecisionBySnapshot.has(decision.marketCategorySnapshotId)) {
        latestDecisionBySnapshot.set(decision.marketCategorySnapshotId, decision);
      }
    }
    const categories = [...newestByCategory.values()]
      .map((snapshot) => {
        const opportunity = snapshot.profileOpportunities[0] ?? null;
        const decision = latestDecisionBySnapshot.get(snapshot.id) ?? null;
        return {
          snapshotId: snapshot.id,
          category: snapshot.taxonomyNode.name,
          slug: snapshot.taxonomyNode.slug,
          lane: opportunity?.lane ?? 'ADJACENT',
          demand7d: snapshot.demand7d,
          demand30d: snapshot.demand30d,
          medianProposals: snapshot.medianProposals == null ? null : Number(snapshot.medianProposals),
          medianBudget: snapshot.medianBudget == null ? null : Number(snapshot.medianBudget),
          verifiedClientsPct: snapshot.verifiedClientsPct == null ? null : Number(snapshot.verifiedClientsPct),
          sampleJobs: snapshot.sampleJobs,
          sampleConfidence: snapshot.sampleConfidence == null ? null : Number(snapshot.sampleConfidence),
          metricCoverage: snapshot.metricCoverage,
          sourceBatchCount: snapshot.sourceBatchCount,
          evidenceJobs: snapshot.evidenceJobs.map(({ jobPost }) => ({
            id: jobPost.id,
            title: jobPost.title,
            jobUrl: jobPost.jobUrl,
            postedAt: jobPost.postedAtKnown ? jobPost.postedAt.toISOString() : null,
            proposalsCount: jobPost.proposalsCountKnown ? jobPost.proposalsCount : null,
            fixedBudget: jobPost.budgetFixed == null ? null : Number(jobPost.budgetFixed),
            paymentVerified: jobPost.paymentVerificationKnown ? jobPost.isPaymentVerified : null,
          })),
          trend: (() => {
            const trend = trendByTaxonomyNode.get(snapshot.taxonomyNodeId) ?? null;
            return trend == null ? null : {
              ...trend,
              comparedTo: trend.comparedTo.toISOString().slice(0, 10),
            };
          })(),
          profileFit: opportunity?.profileFit == null ? null : Number(opportunity.profileFit),
          fitSampleJobs: opportunity?.fitSampleJobs ?? 0,
          overallOpportunity: opportunity?.overallOpportunity == null ? null : Number(opportunity.overallOpportunity),
          profileEligibility: opportunity?.profileEligibility ?? 'PENDING',
          aiLeverage: {
            state: opportunity?.aiLeverageState ?? 'NOT_APPLICABLE',
            capability: opportunity?.aiLeverageCapability ?? null,
            task: opportunity?.aiLeverageTask ?? null,
            explanation: opportunity?.aiLeverageExplanation ?? null,
          },
          asOf: snapshot.asOf.toISOString().slice(0, 10),
          calculationVersion: snapshot.calculationVersion,
          decision: decision == null ? null : {
            id: decision.id,
            status: decision.status,
            rationale: decision.rationale,
            operator: decision.operatorLabel,
            createdAt: decision.createdAt.toISOString(),
            outcome: decision.outcome == null ? null : {
              jobPostId: decision.outcome.jobPostId,
              proposalId: decision.outcome.proposalId,
              submittedAt: decision.outcome.submittedAt?.toISOString() ?? null,
              qualifiedRepliedAt: decision.outcome.qualifiedRepliedAt?.toISOString() ?? null,
              interviewedAt: decision.outcome.interviewedAt?.toISOString() ?? null,
              wonAt: decision.outcome.wonAt?.toISOString() ?? null,
              realizedValue: decision.outcome.realizedValue == null ? null : Number(decision.outcome.realizedValue),
            },
          },
        };
      })
      .sort((left, right) => (right.overallOpportunity ?? -1) - (left.overallOpportunity ?? -1) || right.demand30d - left.demand30d)
      .map((category, index) => ({ rank: index + 1, ...category }));
    const observedProposalMedians = categories.flatMap((category) => category.medianProposals == null ? [] : [category.medianProposals]);
    const sortedMedians = [...observedProposalMedians].sort((left, right) => left - right);
    const midpoint = Math.floor(sortedMedians.length / 2);
    const medianProposalsAcrossAll = sortedMedians.length === 0 ? null : sortedMedians.length % 2 === 0
      ? (sortedMedians[midpoint - 1] + sortedMedians[midpoint]) / 2
      : sortedMedians[midpoint];

    return {
      success: true,
      data: {
        kpis: {
          totalJobsSampled: categories.reduce((total, category) => total + category.sampleJobs, 0),
          topCategory: categories[0]?.category ?? null,
          opportunityCount: categories.filter((category) => category.overallOpportunity != null).length,
          medianProposalsAcrossAll,
          activeProfileName: profile?.personaName ?? null,
        },
        operationalHealth: {
          ...operationalHealth,
          latestSnapshotAsOf: operationalHealth.latestSnapshotAsOf?.toISOString().slice(0, 10) ?? null,
          latestCompletedScrapeAt: operationalHealth.latestCompletedScrapeAt?.toISOString() ?? null,
        },
        categories,
        methodology: {
          demand: 'Unique classified jobs with an observed posting date in the trailing 7 and 30 days.',
          competition: 'Median observed applicant count. Missing counts are excluded, never converted to zero.',
          budget: 'Median fixed-price budget only. Hourly and fixed-price units are not mixed.',
          confidence: 'Sample size plus coverage of applicant counts, fixed budgets, and payment-verification fields.',
          opportunity: 'Relative 30-day demand, inverse observed competition, profile fit, and verified-client share when observed.',
        },
      },
    };
  }

  /**
   * Obtiene todos los empleos calificados del tenant ordenados por score para el perfil activo
   */
  @Get('jobs')
  async getJobs(@Query('personaName') personaNameQuery?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);

    const jobs = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        ...(activeProfile ? {
          fitEvaluations: {
            some: { positioningProfileId: activeProfile.id },
          },
        } : {}),
      },
      include: {
        fitEvaluations: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
        proposals: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
      },
      orderBy: [
        { postedAt: 'desc' },
      ],
      take: 50,
    });

    const mapped = jobs.map((job) => {
      const fitEval = job.fitEvaluations[0] || null;
      const prop = job.proposals[0] || null;
      return {
        ...job,
        status: fitEval?.status || job.status,
        fitEvaluation: fitEval,
        proposal: prop,
      };
    });

    return mapped.sort((a, b) => (b.fitEvaluation?.overallScore || 0) - (a.fitEvaluation?.overallScore || 0));
  }

  /**
   * Re-evalúa el score de todos los empleos almacenados usando el nuevo motor de scoring para el perfil activo
   */
  @Post('rescore-all')
  async rescoreAllJobs(@Query('personaName') personaNameQuery?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);

    const jobs = await this.prisma.jobPost.findMany({
      where: { tenantId },
    });

    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });
    let updated = 0;
    for (const job of jobs) {
      const raw = (job.rawApifyPayload as any) || {};

      let proposalsCount: number | null = null;
      if (raw.client_activity?.totalApplicants != null) {
        proposalsCount = Number(raw.client_activity.totalApplicants);
      } else if (raw.proposals?.count != null) {
        proposalsCount = Number(raw.proposals.count);
      }

      let postedAt: Date | null = null;
      if (raw.publish_time) {
        postedAt = new Date(raw.publish_time);
      } else if (raw.postedDate) {
        postedAt = new Date(raw.postedDate);
      } else if (job.postedAt) {
        postedAt = new Date(job.postedAt);
      }

      let clientCountry: string | null = job.clientCountry || raw.buyer?.location?.country || raw.client?.country || null;
      if (!clientCountry && raw.nation) {
        clientCountry = String(raw.nation).split('/')[0].trim();
      }
      if (clientCountry) {
        const lower = clientCountry.toLowerCase().trim();
        if (lower === 'us' || lower === 'usa' || lower.includes('united states')) {
          clientCountry = 'United States';
        }
      }

      const skills: string[] = [];
      if (Array.isArray(raw.ontologySkills)) {
        skills.push(...raw.ontologySkills.map((s: any) => s.prefLabel || s.name || String(s)));
      } else if (Array.isArray(raw.skills)) {
        skills.push(...raw.skills.map((s: any) => String(s)));
      }

      const evaluation = this.fitCalculator.calculate({
        title: job.title,
        description: job.description || '',
        skills,
        activeQueries: scrapeConfig?.searchKeywords || [],
        taxonomy: activeProfile ? {
          coreRoles: activeProfile.coreRoles,
          hybridRoles: activeProfile.hybridRoles,
          tangentialRoles: activeProfile.tangentialRoles,
          excludedRoles: activeProfile.excludedRoles,
        } : undefined,
        weights: activeProfile ? {
          skill: activeProfile.weightSkill,
          ai: activeProfile.weightAi,
          client: activeProfile.weightClient,
          recency: activeProfile.weightRecency,
        } : undefined,
        clientTotalSpend: Number(job.clientTotalSpend || 0),
        clientRating: Number(job.clientRating || 0),
        clientCountry: clientCountry || undefined,
        proposalsCount: proposalsCount != null ? proposalsCount : undefined,
        isPaymentVerified: job.isPaymentVerified,
        postedDate: postedAt || undefined,
        targetCountries: scrapeConfig?.targetCountries || ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
        excludedCountries: scrapeConfig?.excludedCountries || [],
      });

      if (activeProfile) {
        await this.prisma.fitEvaluation.upsert({
          where: {
            uq_job_post_profile: {
              jobPostId: job.id,
              positioningProfileId: activeProfile.id,
            },
          },
          create: {
            jobPostId: job.id,
            positioningProfileId: activeProfile.id,
            overallScore: evaluation.overallScore,
            fitTier: evaluation.fitTier as FitTier,
            strategicLane: evaluation.strategicLane as StrategicLane,
            normalizedRole: evaluation.normalizedRole,
            skillScore: evaluation.skillScore,
            aiFeasibilityScore: evaluation.aiFeasibilityScore,
            clientQualityScore: evaluation.clientQualityScore,
            recencyScore: evaluation.recencyScore,
            isCapped: evaluation.isCapped,
            capReason: evaluation.capReason,
            summaryRationale: evaluation.summaryRationale,
            detectedGaps: evaluation.detectedGaps,
            suggestedProofStory: evaluation.suggestedProofStory,
          },
          update: {
            overallScore: evaluation.overallScore,
            fitTier: evaluation.fitTier as FitTier,
            strategicLane: evaluation.strategicLane as StrategicLane,
            normalizedRole: evaluation.normalizedRole,
            skillScore: evaluation.skillScore,
            aiFeasibilityScore: evaluation.aiFeasibilityScore,
            clientQualityScore: evaluation.clientQualityScore,
            recencyScore: evaluation.recencyScore,
            isCapped: evaluation.isCapped,
            capReason: evaluation.capReason,
            summaryRationale: evaluation.summaryRationale,
            detectedGaps: evaluation.detectedGaps,
            suggestedProofStory: evaluation.suggestedProofStory,
          },
        });
      }
      updated++;
    }

    return { message: `Re-evaluadas ${updated} vacantes exitosamente para ${activeProfile?.personaName || 'perfil activo'}`, updatedCount: updated };
  }

  /**
   * Actualiza el estado de un empleo (APPROVED, SKIPPED, APPLIED) para el perfil activo
   */
  @Patch('jobs/:id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusDto,
    @Query('personaName') personaNameQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);

    if (activeProfile) {
      await this.prisma.fitEvaluation.updateMany({
        where: {
          jobPostId: id,
          positioningProfileId: activeProfile.id,
        },
        data: { status: body.status as JobStatus },
      });
    }

    return this.prisma.jobPost.updateMany({
      where: { id, tenantId },
      data: { status: body.status as JobStatus },
    });
  }

  /**
   * GET /api/scraping/proof-stories
   * Retorna las Historias de Autoridad disponibles y la Oferta Específica (Headline) del Perfil Activo
   */
  @Get('proof-stories')
  async getAvailableProofStories(@Query('personaName') personaNameQuery?: string) {
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);

    return {
      offerHeadline: activeProfile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
      targetAudience: activeProfile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
      proofStories: activeProfile?.proofStories.map(ps => ({
        id: ps.id,
        keyCode: ps.keyCode,
        companyOrProduct: ps.companyOrProduct,
        impactMetric: ps.impactMetric,
        domainTags: ps.domainTags,
      })) || [],
    };
  }

  /**
   * POST /api/scraping/jobs/:id/regenerate-proposal
   * Cruce Tri-Factor: Vacante (Job) + Historia de Autoridad (ProofStory) + Oferta Específica (Transformación)
   * Genera en tiempo real con IA (Google Gemini 3.8 Flash) aplicando Humanizer (0 guiones largos, 30-35 palabras).
   */
  @Post('jobs/:id/regenerate-proposal')
  async regenerateProposal(
    @Param('id') jobId: string,
    @Body() body: { proofStoryKey?: string; personaName?: string },
    @Query('personaName') personaNameQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(body?.personaName || personaNameQuery);

    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobId, tenantId },
      include: {
        fitEvaluations: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
        proposals: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`Job con ID ${jobId} no encontrado`);
    }

    const fitEval = job.fitEvaluations[0] || null;

    // 1. Seleccionar la historia de autoridad solicitada o la sugerida
    const requestedKey = body?.proofStoryKey || fitEval?.suggestedProofStory;
    let selectedStory = activeProfile?.proofStories?.find(
      s => s.keyCode === requestedKey || s.id === requestedKey,
    );
    if (!selectedStory && activeProfile?.proofStories && activeProfile.proofStories.length > 0) {
      selectedStory = activeProfile.proofStories[0];
    }

    this.logger.log(`🤖 Regenerando propuesta Tri-Factor con IA para Job ${job.id} (Perfil: ${activeProfile?.personaName}) usando ProofStory ${selectedStory?.keyCode}`);

    // 2. Invocar ClaudeProposalService (Gemini 3.8 Flash)
    const proposalResult = await this.claudeProposal.generate({
      jobTitle: job.title,
      jobDescription: job.description,
      clientCountry: job.clientCountry || undefined,
      proofStoryKey: selectedStory?.keyCode || 'PEPPER_AI',
      proofStoryCompany: selectedStory?.companyOrProduct || 'Pepper AI',
      proofStoryMetric: selectedStory?.impactMetric || '17,000+ users and seed funding',
      offerHeadline: activeProfile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
      targetAudience: activeProfile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
      voiceRules: (activeProfile?.voiceRules as string[]) || [],
      normalizedRole: fitEval?.normalizedRole || 'Senior Product Specialist',
      platform: resolveJobPlatform(job),
      companyName: (job.rawApifyPayload as any)?.companyName || undefined,
    });

    if (!activeProfile) {
      throw new NotFoundException('Perfil de posicionamiento no encontrado');
    }

    // 3. Upsert en base de datos con uq_proposal_job_profile
    const proposal = await this.prisma.proposal.upsert({
      where: {
        uq_proposal_job_profile: {
          jobPostId: job.id,
          positioningProfileId: activeProfile.id,
        },
      },
      create: {
        jobPostId: job.id,
        positioningProfileId: activeProfile.id,
        contactName: proposalResult.contactName,
        coverLetter35Words: proposalResult.coverLetter35Words,
        technicalProposalBody: proposalResult.technicalProposalBody,
        mermaidDiagramCode: proposalResult.mermaidDiagramCode,
        publicWalkthroughSlug: `p-${job.id.substring(0, 8)}-${(activeProfile.personaName || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 4)}`,
      },
      update: {
        contactName: proposalResult.contactName,
        coverLetter35Words: proposalResult.coverLetter35Words,
        technicalProposalBody: proposalResult.technicalProposalBody,
        mermaidDiagramCode: proposalResult.mermaidDiagramCode,
      },
    });

    // 4. Actualizar suggestedProofStory si fue alterada
    if (selectedStory && fitEval) {
      await this.prisma.fitEvaluation.update({
        where: {
          uq_job_post_profile: {
            jobPostId: job.id,
            positioningProfileId: activeProfile.id,
          },
        },
        data: { suggestedProofStory: selectedStory.keyCode },
      });
    }

    return {
      success: true,
      jobId: job.id,
      contactNameFound: proposal.contactName,
      coverLetter: proposal.coverLetter35Words,
      technicalProposal: proposal.technicalProposalBody,
      mermaidCode: proposal.mermaidDiagramCode,
      suggestedProofStory: selectedStory?.keyCode,
      proposalDocLink: `http://localhost:7001/walkthrough/${proposal.publicWalkthroughSlug}`,
    };
  }

  /**
   * POST /api/scraping/jobs/:id/tailor-application
   * Adapta el CV ATS y genera la Cover Letter gemela empalmada con la vacante (Paridad con Publications).
   */
  @Post('jobs/:id/tailor-application')
  async tailorApplication(
    @Param('id') jobId: string,
    @Body() body: { lang?: 'en' | 'es'; personaName?: string; customCvData?: BaseCvData },
    @Query('personaName') personaNameQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    await this.resolveActiveProfile(body?.personaName || personaNameQuery);

    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException(`Job con ID ${jobId} no encontrado`);
    }

    const companyName = (job.rawApifyPayload as any)?.companyName || undefined;
    const lang = body?.lang || 'en';

    let baseCvData = body?.customCvData;
    if (!baseCvData) {
      const activeProfile = await this.prisma.positioningProfile.findFirst({
        where: { tenantId, isActive: true },
      });
      const storedCv = activeProfile?.baseCv as any;
      if (storedCv?.translations?.[lang]) {
        baseCvData = storedCv.translations[lang];
      }
    }

    const result = await this.cvTailor.adaptCvAndCoverLetter({
      jobDescription: job.description,
      companyName,
      lang,
      baseCv: baseCvData,
    });

    return {
      success: true,
      jobId: job.id,
      detectedCompany: result.detectedCompany,
      changesMade: result.changesMade,
      interviewQuestions: result.interviewQuestions,
      coverLetter: result.coverLetter,
      adaptedCv: result.adaptedCv,
    };
  }

  /**
   * GET /api/scraping/jobs/:id/cv-pdf
   * Renderiza y descarga el PDF vectorial del CV ATS adaptado vía Gotenberg Chromium.
   */
  @Get('jobs/:id/cv-pdf')
  async downloadCvPdf(
    @Param('id') jobId: string,
    @Query('lang') langQuery: string,
    @Query('personaName') personaNameQuery: string,
    @Res() res: Response,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException(`Job con ID ${jobId} no encontrado`);
    }

    const companyName = (job.rawApifyPayload as any)?.companyName || 'empresa';
    const lang = (langQuery === 'es' ? 'es' : 'en') as 'en' | 'es';

    const activeProfile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
    });
    const storedCv = activeProfile?.baseCv as any;
    const baseCvData = storedCv?.translations?.[lang];

    const result = await this.cvTailor.adaptCvAndCoverLetter({
      jobDescription: job.description,
      companyName,
      lang,
      baseCv: baseCvData,
    });

    const pdfBuffer = await this.cvTailor.generateCvPdf(result.adaptedCv);
    const dateFormatted = new Date().toISOString().split('T')[0];
    const safeCompany = result.detectedCompany.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `leonardo_jaimes_cv_${safeCompany}_${dateFormatted}_${lang}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.end(pdfBuffer);
  }

  /**
   * GET /api/scraping/jobs/:id/cover-letter-pdf
   * Renderiza y descarga el PDF vectorial de la Cover Letter ATS gemela vía Gotenberg Chromium.
   */
  @Get('jobs/:id/cover-letter-pdf')
  async downloadCoverLetterPdf(
    @Param('id') jobId: string,
    @Query('lang') langQuery: string,
    @Query('personaName') personaNameQuery: string,
    @Res() res: Response,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobId, tenantId },
    });
    if (!job) {
      throw new NotFoundException(`Job con ID ${jobId} no encontrado`);
    }

    const companyName = (job.rawApifyPayload as any)?.companyName || 'empresa';
    const lang = (langQuery === 'es' ? 'es' : 'en') as 'en' | 'es';

    const activeProfile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
    });
    const storedCv = activeProfile?.baseCv as any;
    const baseCvData = storedCv?.translations?.[lang];

    const result = await this.cvTailor.adaptCvAndCoverLetter({
      jobDescription: job.description,
      companyName,
      lang,
      baseCv: baseCvData,
    });

    const pdfBuffer = await this.cvTailor.generateCoverLetterPdf(
      result.adaptedCv.profile,
      result.coverLetter,
      result.detectedCompany,
    );
    const dateFormatted = new Date().toISOString().split('T')[0];
    const safeCompany = result.detectedCompany.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const filename = `leonardo_jaimes_cover_letter_${safeCompany}_${dateFormatted}_${lang}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    });
    res.end(pdfBuffer);
  }

  /**
   * POST /api/scraping/synthesize-batch
   * Genera propuestas en lote para los empleos de alto fitScore (Highest Fit Score First).
   */
  @Post('synthesize-batch')
  async synthesizeBatch(
    @Body() body: { minScore?: number; overwrite?: boolean; limit?: number; personaName?: string },
    @Query('personaName') personaNameQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const minScore = body?.minScore ?? 75;
    const overwrite = body?.overwrite ?? false;
    const limit = body?.limit ?? 10;
    const activeProfile = await this.resolveActiveProfile(body?.personaName || personaNameQuery);

    const candidates = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        fitEvaluations: {
          some: {
            positioningProfileId: activeProfile?.id,
            overallScore: { gte: minScore },
          },
        },
        ...(overwrite || !activeProfile ? {} : {
          proposals: {
            none: { positioningProfileId: activeProfile.id },
          },
        }),
      },
      include: {
        fitEvaluations: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
        proposals: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
      },
      take: limit,
    });

    // Ordenar en memoria por fitScore desc
    candidates.sort((a, b) => ((b.fitEvaluations[0]?.overallScore || 0) - (a.fitEvaluations[0]?.overallScore || 0)));

    this.logger.log(`⚡ Iniciando síntesis en lote para ${candidates.length} empleos (minScore: ${minScore}, Perfil: ${activeProfile?.personaName})`);

    const results = [];
    for (const job of candidates) {
      const fitEval = job.fitEvaluations[0];
      const selectedStory = activeProfile?.proofStories?.find(
        s => s.keyCode === fitEval?.suggestedProofStory,
      ) || activeProfile?.proofStories?.[0];

      try {
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: job.title,
          jobDescription: job.description,
          clientCountry: job.clientCountry || undefined,
          proofStoryKey: selectedStory?.keyCode || 'PEPPER_AI',
          proofStoryCompany: selectedStory?.companyOrProduct || 'Pepper AI',
          proofStoryMetric: selectedStory?.impactMetric || '17,000+ active users',
          offerHeadline: activeProfile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
          targetAudience: activeProfile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
          voiceRules: (activeProfile?.voiceRules as string[]) || [],
          normalizedRole: fitEval?.normalizedRole || 'Senior Product Specialist',
          platform: resolveJobPlatform(job),
          companyName: (job.rawApifyPayload as any)?.companyName || undefined,
        });

        if (activeProfile) {
          const proposal = await this.prisma.proposal.upsert({
            where: {
              uq_proposal_job_profile: {
                jobPostId: job.id,
                positioningProfileId: activeProfile.id,
              },
            },
            create: {
              jobPostId: job.id,
              positioningProfileId: activeProfile.id,
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
              publicWalkthroughSlug: `p-${job.id.substring(0, 8)}-${(activeProfile.personaName || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 4)}`,
            },
            update: {
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            },
          });

          results.push({
            jobId: job.id,
            title: job.title,
            overallScore: fitEval?.overallScore,
            contactName: proposal.contactName,
            wordCount: proposal.coverLetter35Words.split(/\s+/).filter(Boolean).length,
            slug: proposal.publicWalkthroughSlug,
          });
        }
      } catch (err) {
        this.logger.error(`Error sintetizando propuesta para job ${job.id}:`, err);
      }
    }

    return {
      success: true,
      processed: results.length,
      candidatesFound: candidates.length,
      results,
    };
  }

  /**
   * GET /api/scraping/jobs/:id/technical-proposal-pdf
   * Genera y descarga la propuesta técnica ejecutiva completa en PDF vía Gotenberg con diagramas Mermaid vectoriales.
   */
  @Get('jobs/:id/technical-proposal-pdf')
  async downloadTechnicalProposalPdf(
    @Param('id') id: string,
    @Res() res: Response,
    @Query('personaName') personaNameQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);

    const job = await this.prisma.jobPost.findFirst({
      where: { id, tenantId },
      include: {
        proposals: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
        fitEvaluations: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
      },
    });

    if (!job) {
      throw new NotFoundException(`No se encontró el empleo con ID ${id}`);
    }

    const proposal = job.proposals[0];
    const fitEvaluation = job.fitEvaluations[0];

    if (!proposal?.technicalProposalBody) {
      throw new NotFoundException(`El empleo no cuenta con propuesta técnica generada`);
    }

    let proofStoryCompany = 'Pepper AI';
    let proofStoryMetric = '17,000+ users and seed funding';

    if (fitEvaluation?.suggestedProofStory) {
      const story = await this.prisma.proofStory.findFirst({
        where: { keyCode: fitEvaluation.suggestedProofStory },
      });
      if (story) {
        proofStoryCompany = story.companyOrProduct;
        proofStoryMetric = story.impactMetric;
      }
    }

    let budgetStr = 'Not Specified';
    if (job.budgetType === BudgetType.HOURLY) {
      budgetStr = `Hourly $${job.hourlyMin || 0} - $${job.hourlyMax || 0}/hr`;
    } else if (job.budgetType === BudgetType.FIXED) {
      budgetStr = `Fixed Price: $${job.budgetFixed || 0}`;
    }

    const pdfBuffer = await this.pdfService.generateTechnicalProposalPdf({
      jobTitle: job.title,
      clientCountry: job.clientCountry || undefined,
      budget: budgetStr,
      clientRating: Number(job.clientRating || 0),
      clientTotalSpend: Number(job.clientTotalSpend || 0),
      contactName: proposal.contactName || 'Hiring Team',
      coverLetter35Words: proposal.coverLetter35Words || '',
      technicalProposalBody: proposal.technicalProposalBody,
      mermaidDiagramCode: proposal.mermaidDiagramCode || '',
      proofStoryCompany,
      proofStoryMetric,
      profileHeadline: activeProfile?.offerHeadline,
    });

    const sanitizedFilename = (job.title || 'Technical_Proposal')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .substring(0, 45);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Strategic_Proposal_${sanitizedFilename}.pdf"`,
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);
  }

  /**
   * GET /api/scraping/report
   * Genera el informe plano exacto con las 17 columnas de la tabla diaria de Upwork
   */
  @Get('report')
  async getDailyReport(
    @Query('personaName') personaNameQuery?: string,
    @Query('platform') platformQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);
    const [jobs, scrapeConfig] = await Promise.all([
      this.prisma.jobPost.findMany({
        where: {
          tenantId,
          ...(activeProfile ? {
            fitEvaluations: {
              some: { positioningProfileId: activeProfile.id },
            },
          } : {}),
        },
        include: {
          fitEvaluations: {
            where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
            take: 1,
          },
          proposals: {
            where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
            take: 1,
          },
        },
        orderBy: [
          { postedAt: 'desc' },
        ],
      }),
      this.prisma.scrapeConfig.findFirst({ where: { tenantId } }),
    ]);

    const targetCountries = (scrapeConfig?.targetCountries || []).map((c: string) => c.trim().toLowerCase());
    const excludedCountries = (scrapeConfig?.excludedCountries || []).map((c: string) => c.trim().toLowerCase());

    const mapped = jobs.map((rawJob) => {
      const fitEvaluation = rawJob.fitEvaluations[0] || null;
      const proposal = rawJob.proposals[0] || null;
      const job = {
        ...rawJob,
        status: fitEvaluation?.status || rawJob.status,
        fitEvaluation,
        proposal,
      };
      // 1. Formateo de Presupuesto
      let budgetStr = 'NOT_SHOWN';
      if (job.budgetType === BudgetType.HOURLY) {
        budgetStr = `HOURLY ${job.hourlyMin || 0}-${job.hourlyMax || 0}`;
      } else if (job.budgetType === BudgetType.FIXED) {
        budgetStr = `FIXED ${job.budgetFixed || 0}`;
      }

      // 2. Formateo de Fit Label
      const fitLabel = job.fitEvaluation?.fitTier === 'HIGH' ? 'High' 
                     : job.fitEvaluation?.fitTier === 'MEDIUM' ? 'Medium' 
                     : 'Low';

      // 3. Formateo de Status
      const statusMap: Record<string, string> = {
        NEEDS_REVIEW: 'Needs Review',
        APPROVED: 'Approved',
        SKIPPED: 'Skipped',
        APPLIED: 'Applied',
      };
      const statusStr = statusMap[job.status] || 'Needs Review';

      // 4. Notas del Score (Métricas + Gaps + Capped)
      const ev = job.fitEvaluation;
      let scoreNotes = ev ? `skill ${ev.skillScore} / AI ${ev.aiFeasibilityScore} / client ${ev.clientQualityScore} / recency ${ev.recencyScore}.` : '';
      if (ev?.isCapped) {
        scoreNotes += ` ${ev.capReason}.`;
      }
      if (ev?.detectedGaps) {
        scoreNotes += ` Gaps: ${ev.detectedGaps}.`;
      }

      // 5. Drivers & Drags Decisionales Estructurados (Stitch Cockpit Specification)
      const drivers: DecisionFactor[] = [];
      const drags: DecisionFactor[] = [];
      const cCountry = (job.clientCountry || '').trim().toLowerCase();
      const isTargetCountry = cCountry && targetCountries.some((t: string) => cCountry.includes(t) || t.includes(cCountry));
      const isExcludedCountry = cCountry && excludedCountries.some((e: string) => cCountry.includes(e) || e.includes(cCountry));
      const clientSpendNum = Number(job.clientTotalSpend || 0);
      const clientRatingNum = Number(job.clientRating || 0);
      const hourlyMaxNum = Number(job.hourlyMax || 0);
      const hourlyMinNum = Number(job.hourlyMin || 0);
      const budgetFixedNum = Number(job.budgetFixed || 0);

      if (ev) {
        // Gasto Histórico del Cliente
        if (clientSpendNum >= 20000) {
          drivers.push({
            title: 'Cliente con alto gasto histórico',
            description: `+$${Math.round(clientSpendNum).toLocaleString()} USD invertidos en Upwork con historial de pago verificado y contratos exitosos.`,
          });
        } else if (clientSpendNum >= 5000) {
          drivers.push({
            title: 'Cliente con inversión probada',
            description: `$${Math.round(clientSpendNum).toLocaleString()} USD gastados en la plataforma, indicando seriedad de contratación.`,
          });
        } else if (clientSpendNum < 500) {
          drags.push({
            title: 'Historial en blanco',
            description: `Cliente nuevo en plataforma ($${Math.round(clientSpendNum)} USD gastados, 0 contrataciones previas registradas).`,
          });
        }

        // Competencia / Ventana de Postulación
        if (job.proposalsCount <= 5) {
          drivers.push({
            title: 'Ventana dorada de postulación',
            description: `Solo ${job.proposalsCount} propuestas enviadas. Ser de los primeros 5 dispara radicalmente la tasa de apertura y entrevista.`,
          });
        } else if (job.proposalsCount > 20) {
          drags.push({
            title: 'Alta competencia saturada',
            description: `Más de ${job.proposalsCount} freelancers han postulado. Requiere un ángulo de diferenciación inmediato en las primeras 2 líneas.`,
          });
        }

        // Coincidencia de Stack / Rol
        if (ev.skillScore >= 75) {
          drivers.push({
            title: 'Coincidencia exacta de stack',
            description: `Rol clasificado como ${ev.normalizedRole} con afinidad técnica del ${ev.skillScore}% respecto a tus keywords y casos de estudio.`,
          });
        } else if (ev.skillScore <= 35) {
          drags.push({
            title: 'Desalineación temática (Off-Niche)',
            description: `Afinidad baja (${ev.skillScore}%). El cliente solicita habilidades comisionistas o fuera de tu stack de valor principal.`,
          });
        }

        // Tarifa / Presupuesto
        if (job.budgetType === BudgetType.HOURLY && hourlyMaxNum >= 40) {
          drivers.push({
            title: 'Tarifa alineada a tu valor',
            description: `Rango $${hourlyMinNum}-$${hourlyMaxNum}/h cumple o supera holgadamente tu tarifa base ($40/h), ofreciendo alto margen.`,
          });
        } else if (job.budgetType === BudgetType.FIXED && budgetFixedNum >= 1000) {
          drivers.push({
            title: 'Presupuesto Fixed-Price saludable',
            description: `Presupuesto asignado de $${budgetFixedNum.toLocaleString()} USD con margen viable para entregables de calidad.`,
          });
        } else if (job.budgetType === BudgetType.HOURLY && hourlyMaxNum < 30 && hourlyMaxNum > 0) {
          drags.push({
            title: 'Tarifa por debajo de umbral',
            description: `Tarifa máxima declarada de $${hourlyMaxNum}/h inferior a tu tarifa base ($40/h).`,
          });
        }

        // Reputación
        if (clientRatingNum >= 4.8) {
          drivers.push({
            title: 'Excelente reputación del cliente',
            description: `${clientRatingNum.toFixed(2)} estrellas promedio otorgadas por freelancers anteriores, confirmando un trato profesional.`,
          });
        } else if (clientRatingNum > 0 && clientRatingNum < 4.0) {
          drags.push({
            title: 'Calificaciones mixtas o bajas',
            description: `Promedio de ${clientRatingNum.toFixed(1)}/5.0 estrellas, alertando sobre posibles fricciones en contratos previos.`,
          });
        }

        // Método de pago
        if (job.isPaymentVerified) {
          drivers.push({
            title: 'Método de pago verificado',
            description: 'Fondo financiero verificado en Upwork; liquidez de cobro garantizada sin riesgo de disputa.',
          });
        } else {
          drags.push({
            title: 'Método de pago no verificado',
            description: 'El cliente aún no valida un método de pago oficial (-20 pts de penalización por riesgo de impago).',
          });
        }

        // Mercado Geográfico
        if (isTargetCountry) {
          drivers.push({
            title: 'Mercado geográfico prioritario',
            description: `Cliente radicado en ${job.clientCountry}, mercado objetivo de alta inversión y afinidad cultural (+15 pts).`,
          });
        } else if (isExcludedCountry) {
          drags.push({
            title: 'País en lista de exclusión',
            description: `Cliente ubicado en ${job.clientCountry}, mercado catalogado con alta fricción o bajo ratio de contratación.`,
          });
        }

        // Frescura
        if (ev.recencyScore >= 85) {
          drivers.push({
            title: 'Vacante ultra fresca (<6h)',
            description: 'Publicada recientemente; el cliente está activo en plataforma revisando propuestas en tiempo real.',
          });
        } else if (ev.recencyScore <= 50) {
          drags.push({
            title: 'Vacante con antigüedad (>24h)',
            description: 'Publicada hace más de 24 horas; ventana inicial de postulación superada.',
          });
        }

        // Techo de seguridad
        if (ev.isCapped && ev.capReason) {
          drags.push({
            title: 'Techo de seguridad activado',
            description: `${ev.capReason}. Postulación bloqueada para proteger tus Connects mensuales.`,
          });
        }
      }

      // 6. Enlace al Documento de Propuesta
      const proposalDocLink = job.proposal?.googleDocUrl 
        || (job.proposal?.publicWalkthroughSlug ? `http://localhost:7001/walkthrough/${job.proposal.publicWalkthroughSlug}` : '');

      return {
        fitScore: ev?.overallScore ?? 0,
        fitLabel,
        jobTitle: job.title,
        jobDescription: job.description,
        budget: budgetStr,
        clientCountry: job.clientCountry || 'Unknown',
        clientRating: Number(job.clientRating || 0),
        clientTotalSpent: Number(job.clientTotalSpend || 0),
        verifiedPayment: job.isPaymentVerified ? 'Yes' : 'No',
        proposalsAlreadyIn: job.proposalsCount,
        postedAt: job.postedAt ? job.postedAt.toISOString() : null,
        contactNameFound: job.proposal?.contactName || 'Hiring Team',
        coverLetter: job.proposal?.coverLetter35Words || '',
        proposalDocLink,
        applyLink: job.jobUrl,
        status: statusStr,
        dateScraped: job.createdAt.toISOString().split('T')[0],
        scoreNotes,
        laneCategory: ev?.strategicLane || 'DISQUALIFIED_NOISE',
        normalizedRole: ev?.normalizedRole || '',
        suggestedProofStory: ev?.suggestedProofStory || '',
        mermaidCode: job.proposal?.mermaidDiagramCode || 'flowchart TD\n  A[Auditoría de Requerimientos] --> B[Figma Tokens & Sistema de Diseño]\n  B --> C[Librería de Componentes Autolayout & Variantes]\n  C --> D[Zero-Friction Developer Handoff]',
        technicalProposal: job.proposal?.technicalProposalBody || '',
        id: job.id,
        // Scorecard Desglosado & Decisional
        skillScore: ev?.skillScore ?? 0,
        aiFeasibilityScore: ev?.aiFeasibilityScore ?? 0,
        clientQualityScore: ev?.clientQualityScore ?? 0,
        recencyScore: ev?.recencyScore ?? 0,
        isCapped: ev?.isCapped ?? false,
        capReason: ev?.capReason ?? null,
        drivers,
        drags,
        platform: resolveJobPlatform(job),
        companyName: (job.rawApifyPayload as any)?.companyName || null,
        directApplyUrl: (job.rawApifyPayload as any)?.applyUrl || job.jobUrl,
      };
    });

    let result = mapped.sort((a, b) => (b.fitScore || 0) - (a.fitScore || 0));
    if (platformQuery && platformQuery !== 'ALL') {
      result = result.filter((j) => j.platform === platformQuery);
    }
    return result;
  }

  /**
   * GET /api/scraping/report/csv
   * Descarga el reporte diario en formato CSV compatible con Excel / Google Sheets
   */
  @Get('report/csv')
  async exportCsv(
    @Query('personaName') personaNameQuery?: string,
    @Query('platform') platformQuery?: string,
  ) {
    const report = await this.getDailyReport(personaNameQuery, platformQuery);
    if (report.length === 0) return 'No data available';

    const headers = [
      'Fit Score', 'Fit Label', 'Job Title', 'Budget', 'Client Country', 
      'Client Rating', 'Client Total Spent', 'Verified Payment', 'Proposals Already In', 
      'Contact Name Found', 'Cover Letter', 'Proposal Doc Link', 'Apply Link', 
      'Status', 'Date Scraped', 'Score Notes', 'Lane / Category'
    ];

    const escapeCsv = (str: any) => {
      const val = String(str ?? '').replace(/"/g, '""');
      return `"${val}"`;
    };

    const rows = report.map(r => [
      r.fitScore,
      escapeCsv(r.fitLabel),
      escapeCsv(r.jobTitle),
      escapeCsv(r.budget),
      escapeCsv(r.clientCountry),
      r.clientRating,
      r.clientTotalSpent,
      escapeCsv(r.verifiedPayment),
      r.proposalsAlreadyIn,
      escapeCsv(r.contactNameFound),
      escapeCsv(r.coverLetter),
      escapeCsv(r.proposalDocLink),
      escapeCsv(r.applyLink),
      escapeCsv(r.status),
      escapeCsv(r.dateScraped),
      escapeCsv(r.scoreNotes),
      escapeCsv(r.laneCategory),
    ].join(','));

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * POST /api/scraping/reprocess
   * Re-procesa todas las vacantes existentes en la base de datos a costo $0 USD,
   * extrayendo sus descripciones reales y métricas completas desde el JSON guardado.
   */
  @Post('reprocess')
  async reprocessExistingJobs(
    @Query('personaName') personaNameQuery?: string,
    @Query('platform') platformQuery?: string,
  ) {
    const tenantId = this.tenantContext.getTenantId();
    let existingJobs = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        rawApifyPayload: { not: null as any },
      },
    });

    if (platformQuery && platformQuery !== 'ALL') {
      existingJobs = existingJobs.filter(job => resolveJobPlatform(job) === platformQuery);
    }

    this.logger.log(`Iniciando re-procesamiento en frío para ${existingJobs.length} empleos de tenant ${tenantId}`);

    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });
    const activeProfile = await this.resolveActiveProfile(personaNameQuery);
    const taxonomyRules = await this.marketTaxonomyAssignments.loadActiveRules();
    const taxonomyVersion = Math.max(1, ...taxonomyRules.map((rule) => rule.taxonomyVersion || 1));
    const reprocessBatchId = `reprocess-${randomUUID()}`;
    const primaryAssignments = await this.prisma.jobCategoryAssignment.findMany({
      where: {
        tenantId,
        jobPostId: { in: existingJobs.map((job) => job.id) },
        isPrimary: true,
      },
      select: { jobPostId: true, classifierVersion: true },
    });
    const primaryAssignmentByJobId = new Map(
      primaryAssignments.map((assignment) => [assignment.jobPostId, assignment]),
    );

    this.progressService.emitProgress({
      batchId: reprocessBatchId,
      tenantId,
      step: 'SCORING',
      message: `Reprocesando ${existingJobs.length} empleos y preparando la clasificación de taxonomía...`,
      percentage: 40,
      totalJobs: existingJobs.length,
    });

    let updatedCount = 0;
    let classificationQueued = 0;
    const chunkSize = 25;
    for (let i = 0; i < existingJobs.length; i += chunkSize) {
      const chunk = existingJobs.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (job) => {
        if (!job.rawApifyPayload) return;

        const normalized = this.apifyAdapter.normalizeRaw(job.rawApifyPayload as Record<string, any>);

        if (
          needsTaxonomyReprocessing(primaryAssignmentByJobId.get(job.id))
          || job.taxonomyClassificationState === 'PENDING'
          || job.taxonomyClassificationState === 'FAILED'
        ) {
          await this.taxonomyClassificationWork.queueForJob({
            tenantId,
            jobPostId: job.id,
            taxonomyVersion,
            batchId: reprocessBatchId,
            input: {
              title: normalized.title,
              description: normalized.description,
              skills: normalized.skills || [],
            },
            force: true,
          });
          this.taxonomyClassificationEvents.enqueue({
            batchId: reprocessBatchId,
            tenantId,
            jobPostId: job.id,
            totalJobs: existingJobs.length,
          });
          classificationQueued++;
        }

        // Re-calcular Fit con datos reales y preferencias geográficas
        const evaluation = this.fitCalculator.calculate({
          title: normalized.title,
          description: normalized.description,
          skills: normalized.skills,
          activeQueries: scrapeConfig?.searchKeywords || [],
          taxonomy: activeProfile ? {
            coreRoles: activeProfile.coreRoles,
            hybridRoles: activeProfile.hybridRoles,
            tangentialRoles: activeProfile.tangentialRoles,
            excludedRoles: activeProfile.excludedRoles,
          } : undefined,
        weights: activeProfile ? {
          skill: activeProfile.weightSkill,
          ai: activeProfile.weightAi,
          client: activeProfile.weightClient,
          recency: activeProfile.weightRecency,
        } : undefined,
          clientTotalSpend: Number(normalized.clientTotalSpend),
          clientRating: Number(normalized.clientRating),
          clientCountry: normalized.clientCountry || undefined,
          proposalsCount: normalized.proposalsCount,
          isPaymentVerified: normalized.isPaymentVerified,
          postedDate: normalized.postedAt,
          targetCountries: scrapeConfig?.targetCountries || [],
          excludedCountries: scrapeConfig?.excludedCountries || [],
        });

        if (activeProfile) {
          await this.prisma.fitEvaluation.upsert({
            where: {
              uq_job_post_profile: {
                jobPostId: job.id,
                positioningProfileId: activeProfile.id,
              },
            },
            create: {
              jobPostId: job.id,
              positioningProfileId: activeProfile.id,
              overallScore: evaluation.overallScore,
              fitTier: evaluation.fitTier as FitTier,
              strategicLane: evaluation.strategicLane as StrategicLane,
              normalizedRole: evaluation.normalizedRole,
              skillScore: evaluation.skillScore,
              aiFeasibilityScore: evaluation.aiFeasibilityScore,
              clientQualityScore: evaluation.clientQualityScore,
              recencyScore: evaluation.recencyScore,
              isCapped: evaluation.isCapped,
              capReason: evaluation.capReason,
              summaryRationale: evaluation.summaryRationale,
              detectedGaps: evaluation.detectedGaps,
              suggestedProofStory: evaluation.suggestedProofStory,
            },
            update: {
              overallScore: evaluation.overallScore,
              fitTier: evaluation.fitTier as FitTier,
              strategicLane: evaluation.strategicLane as StrategicLane,
              normalizedRole: evaluation.normalizedRole,
              skillScore: evaluation.skillScore,
              aiFeasibilityScore: evaluation.aiFeasibilityScore,
              clientQualityScore: evaluation.clientQualityScore,
              recencyScore: evaluation.recencyScore,
              isCapped: evaluation.isCapped,
              capReason: evaluation.capReason,
              summaryRationale: evaluation.summaryRationale,
              detectedGaps: evaluation.detectedGaps,
              suggestedProofStory: evaluation.suggestedProofStory,
            },
          });
        }

        updatedCount++;
      }));
    }

    // FASE 2: Intervención IA únicamente en el Top 3 Gold de los empleos re-procesados
    const topCandidates = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        fitEvaluations: {
          some: {
            positioningProfileId: activeProfile?.id,
            fitTier: { not: 'LOW' },
          },
        },
      },
      include: {
        fitEvaluations: {
          where: activeProfile ? { positioningProfileId: activeProfile.id } : undefined,
          take: 1,
        },
      },
      take: 20,
    });

    topCandidates.sort((a, b) => (b.fitEvaluations[0]?.overallScore || 0) - (a.fitEvaluations[0]?.overallScore || 0));
    const finalTop3 = topCandidates.slice(0, 3);

    let top3Generated = 0;
    for (const candidate of finalTop3) {
      const fitEval = candidate.fitEvaluations[0];
      if (!fitEval) continue;
      try {
        const matchingStory = activeProfile?.proofStories?.find(s => s.keyCode === fitEval.suggestedProofStory) || activeProfile?.proofStories?.[0];
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: candidate.title,
          jobDescription: candidate.description,
          clientCountry: candidate.clientCountry || undefined,
          proofStoryKey: matchingStory?.keyCode || fitEval.suggestedProofStory || 'SPOTLIGHT_AI',
          proofStoryCompany: matchingStory?.companyOrProduct,
          proofStoryMetric: matchingStory?.impactMetric,
          offerHeadline: activeProfile?.offerHeadline,
          targetAudience: activeProfile?.targetAudience,
          voiceRules: (activeProfile?.voiceRules as string[]) || undefined,
          normalizedRole: fitEval.normalizedRole,
          platform: resolveJobPlatform(candidate),
          companyName: (candidate.rawApifyPayload as any)?.companyName || undefined,
        });

        if (activeProfile) {
          await this.prisma.proposal.upsert({
            where: {
              uq_proposal_job_profile: {
                jobPostId: candidate.id,
                positioningProfileId: activeProfile.id,
              },
            },
            create: {
              jobPostId: candidate.id,
              positioningProfileId: activeProfile.id,
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
              publicWalkthroughSlug: `p-${candidate.id.substring(0, 8)}-${(activeProfile.personaName || 'lead').toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 4)}`,
            },
            update: {
              contactName: proposalResult.contactName,
              coverLetter35Words: proposalResult.coverLetter35Words,
              technicalProposalBody: proposalResult.technicalProposalBody,
              mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            },
          });
          top3Generated++;
        }
      } catch (err: any) {
        this.logger.warn(`Error generando propuesta IA en reprocess para ${candidate.id}: ${err.message}`);
      }
    }

    this.progressService.emitProgress({
      batchId: reprocessBatchId,
      tenantId,
      step: 'SCORING',
      message: `Clasificación de taxonomía: ${classificationQueued} empleos requieren backfill; esperando resultados...`,
      percentage: 85,
      totalJobs: existingJobs.length,
      classificationStatus: classificationQueued > 0 ? 'QUEUED' : 'COMPLETED',
      classificationQueued,
      classificationCompleted: 0,
      classificationFailed: 0,
    });

    try {
      await this.taxonomyClassificationEvents.drain(reprocessBatchId);
    } catch (error: any) {
      const classificationFailureEvent = this.progressService.getLatestEvent(reprocessBatchId);
      this.progressService.emitProgress({
        batchId: reprocessBatchId,
        tenantId,
        step: 'ERROR',
        message: `Falló el backfill de clasificación de taxonomía: ${error.message || 'error desconocido'}`,
        percentage: 100,
        totalJobs: existingJobs.length,
        classificationQueued,
        classificationCompleted: classificationFailureEvent?.classificationCompleted,
        classificationFailed: classificationFailureEvent?.classificationFailed ?? classificationQueued,
        error: error.message,
      });
      throw error;
    }

    const classificationEvent = this.progressService.getLatestEvent(reprocessBatchId);
    this.progressService.emitProgress({
      batchId: reprocessBatchId,
      tenantId,
      step: 'SCORING',
      message: `Clasificación de taxonomía completada (${classificationQueued} empleos). Reconstruyendo Market Radar...`,
      percentage: 90,
      totalJobs: existingJobs.length,
      classificationStatus: 'COMPLETED',
      classificationQueued,
      classificationCompleted: classificationQueued,
      classificationFailed: classificationEvent?.classificationFailed ?? 0,
    });

    const snapshotResult = await this.marketRadarOperations.rebuildAfterSuccessfulBatch(tenantId);

    this.progressService.emitProgress({
      batchId: reprocessBatchId,
      tenantId,
      step: 'COMPLETED',
      message: `Reprocesamiento completado: ${updatedCount} empleos, ${classificationQueued} clasificaciones y ${snapshotResult.categories} categorías de Radar actualizadas.`,
      percentage: 100,
      totalJobs: existingJobs.length,
      classificationStatus: 'COMPLETED',
      classificationQueued,
      classificationCompleted: classificationQueued,
      classificationFailed: classificationEvent?.classificationFailed ?? 0,
    });

    return {
      success: true,
      batchId: reprocessBatchId,
      reprocessedCount: updatedCount,
      top3GoldGenerated: top3Generated,
      taxonomyClassificationsQueued: classificationQueued,
      radarSnapshot: snapshotResult,
      message: `Se re-evaluaron ${updatedCount} empleos ($0 tokens) para ${activeProfile?.personaName || 'perfil activo'} y la IA redactó el Top ${top3Generated} Gold.`,
    };
  }

  /**
   * Endpoint de pruebas para reiniciar la base de datos a Estado Cero
   */
  @Post('reset')
  async resetDatabase() {
    await this.prisma.$executeRawUnsafe('TRUNCATE TABLE proposals, fit_evaluations, job_posts, batch_runs CASCADE;');
    this.logger.log('Base de datos reseteada a Estado Cero para pruebas E2E');
    return { success: true, message: 'Base de datos limpia: 0 empleos.' };
  }

  /**
   * Endpoint de pruebas para restaurar el Preset de Demostración de Bo
   */
  @Post('restore-preset')
  async restorePreset() {
    const tenantId = this.tenantContext.getTenantId();
    await this.triggerBatch({ maxResults: 30 });
    return { success: true, message: 'Preset restaurado con éxito.' };
  }

}

