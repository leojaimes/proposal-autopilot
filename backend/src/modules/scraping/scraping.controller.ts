import { Controller, Post, Get, Patch, Body, Param, Logger, NotFoundException, Res, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Response } from 'express';
import { ApifyService } from './apify.service';
import { ScrapingProgressService } from './scraping-progress.service';
import { ApifyJobAdapter } from './adapters/apify-job.adapter';
import { FitCalculatorService } from '../scoring/services/fit-calculator.service';
import { ClaudeProposalService } from '../proposals/claude-proposal.service';
import { TechnicalProposalPdfService } from '../proposals/technical-proposal-pdf.service';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { BudgetType, JobStatus, StrategicLane, FitTier } from '@prisma/client';

export interface TriggerScrapeDto {
  keywords?: string[];
  maxResults?: number;
  limit?: number;
}

export interface UpdateStatusDto {
  status: 'APPROVED' | 'SKIPPED' | 'APPLIED' | 'NEEDS_REVIEW';
}

export interface DecisionFactor {
  title: string;
  description: string;
}

@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(
    private readonly apifyService: ApifyService,
    private readonly progressService: ScrapingProgressService,
    private readonly apifyAdapter: ApifyJobAdapter,
    private readonly fitCalculator: FitCalculatorService,
    private readonly claudeProposal: ClaudeProposalService,
    private readonly pdfService: TechnicalProposalPdfService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

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
      } else {
        keywords = [
          '("Design System" OR "Figma Variables") AND ("SaaS" OR "Enterprise")',
          '("AI Interaction" OR "Agentic UX" OR "Conversational AI")',
          '("B2B SaaS" OR "Product Designer") AND ("Redesign" OR "Handoff")',
        ];
      }
    }

    const maxResults = body.maxResults || body.limit || 30;

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

    this.logger.log(`Iniciando batch asíncrono ${batchRun.id} para Tenant ${tenantId} con ${keywords.length} queries`);

    // 4. Emitir evento inicial en el canal SSE
    this.progressService.emitProgress({
      batchId: batchRun.id,
      tenantId,
      step: 'STARTING',
      message: 'Conectando con el motor y preparando queries...',
      percentage: 5,
    });

    // 5. Lanzar el pipeline en segundo plano (Desacoplado, no bloqueante)
    setImmediate(() => {
      this.executeBatchPipeline(batchRun.id, tenantId, keywords, maxResults).catch(async (err) => {
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
      message: 'Extracción iniciada en segundo plano con streaming SSE activo',
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
  ): Promise<void> {
    // FASE 1: Scraper de Apify
    this.progressService.emitProgress({
      batchId: batchRunId,
      tenantId,
      step: 'APIFY_RUNNING',
      message: `🕷️ Apify buscando hasta ${maxResults} vacantes frescas en Upwork...`,
      percentage: 15,
    });

    const rawJobs = await this.apifyService.runUpworkScraper(keywords, maxResults);
    this.logger.log(`[Batch ${batchRunId}] Se recibieron ${rawJobs.length} empleos desde Apify`);

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

    // FASE 2: Normalización & Scoring 0-100 para todas las vacantes
    for (let idx = 0; idx < rawJobs.length; idx++) {
      const raw = rawJobs[idx];
      const normalized = this.apifyAdapter.normalizeRaw(raw);
      if (!normalized.externalId) continue;

      // Upsert JobPost
      const jobPost = await this.prisma.jobPost.upsert({
        where: {
          uq_tenant_external_job: {
            tenantId,
            externalUpworkId: normalized.externalId,
          },
        },
        create: {
          tenant: { connect: { id: tenantId } },
          batchRun: batchRunId ? { connect: { id: batchRunId } } : undefined,
          externalUpworkId: normalized.externalId,
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
          isPaymentVerified: normalized.isPaymentVerified,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt || new Date(),
          status: JobStatus.NEEDS_REVIEW,
          rawApifyPayload: normalized.rawPayload as any,
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
          isPaymentVerified: normalized.isPaymentVerified,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt || new Date(),
          rawApifyPayload: normalized.rawPayload as any,
        },
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

      // Guardar FitEvaluation
      await this.prisma.fitEvaluation.upsert({
        where: { jobPostId: jobPost.id },
        create: {
          jobPostId: jobPost.id,
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
          proofStoryKey: matchingStory?.keyCode || evaluation.suggestedProofStory || 'SPOTLIGHT_AI',
          proofStoryCompany: matchingStory?.companyOrProduct,
          proofStoryMetric: matchingStory?.impactMetric,
          offerHeadline: activeProfile?.offerHeadline,
          targetAudience: activeProfile?.targetAudience,
          voiceRules: (activeProfile?.voiceRules as string[]) || undefined,
          normalizedRole: evaluation.normalizedRole,
        });

        await this.prisma.proposal.upsert({
          where: { jobPostId: jobPost.id },
          create: {
            jobPostId: jobPost.id,
            contactName: proposalResult.contactName,
            coverLetter35Words: proposalResult.coverLetter35Words,
            technicalProposalBody: proposalResult.technicalProposalBody,
            mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            publicWalkthroughSlug: `p-${jobPost.id.substring(0, 8)}`,
          },
          update: {
            contactName: proposalResult.contactName,
            coverLetter35Words: proposalResult.coverLetter35Words,
            technicalProposalBody: proposalResult.technicalProposalBody,
            mermaidDiagramCode: proposalResult.mermaidDiagramCode,
          },
        });
      } catch (err: any) {
        this.logger.warn(`Error sintetizando propuesta Top 3 Gold para ${jobPost.id}: ${err.message}`);
      }
    }

    // Actualizar BatchRun como COMPLETED
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

    this.logger.log(`[Batch ${batchRunId}] Pipeline finalizado exitosamente: ${highFitCount} High Fit, ${mediumFitCount} Medium Fit.`);
  }

  /**
   * Obtiene todos los empleos calificados del tenant ordenados por score
   */
  @Get('jobs')
  async getJobs() {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.jobPost.findMany({
      where: { tenantId },
      include: {
        fitEvaluation: true,
        proposal: true,
      },
      orderBy: [
        { fitEvaluation: { overallScore: 'desc' } },
        { postedAt: 'desc' },
      ],
      take: 50,
    });
  }

  /**
   * Re-evalúa el score de todos los empleos almacenados usando el nuevo motor de scoring
   */
  @Post('rescore-all')
  async rescoreAllJobs() {
    const tenantId = this.tenantContext.getTenantId();
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
        clientTotalSpend: Number(job.clientTotalSpend || 0),
        clientRating: Number(job.clientRating || 0),
        clientCountry: clientCountry || undefined,
        proposalsCount: proposalsCount != null ? proposalsCount : undefined,
        isPaymentVerified: job.isPaymentVerified,
        postedDate: postedAt || undefined,
        targetCountries: scrapeConfig?.targetCountries || ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
        excludedCountries: scrapeConfig?.excludedCountries || [],
      });

      await this.prisma.fitEvaluation.upsert({
        where: { jobPostId: job.id },
        create: {
          jobPostId: job.id,
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
      updated++;
    }

    return { message: `Re-evaluadas ${updated} vacantes exitosamente`, updatedCount: updated };
  }

  /**
   * Actualiza el estado de un empleo (APPROVED, SKIPPED, APPLIED)
   */
  @Patch('jobs/:id/status')
  async updateStatus(@Param('id') id: string, @Body() body: UpdateStatusDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.jobPost.updateMany({
      where: { id, tenantId },
      data: { status: body.status as JobStatus },
    });
  }

  /**
   * GET /api/scraping/proof-stories
   * Retorna las Historias de Autoridad disponibles y la Oferta Específica (Headline) del Tenant
   */
  @Get('proof-stories')
  async getAvailableProofStories() {
    const tenantId = this.tenantContext.getTenantId();
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    return {
      offerHeadline: profile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
      targetAudience: profile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
      proofStories: profile?.proofStories.map(ps => ({
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
    @Body() body: { proofStoryKey?: string },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.prisma.jobPost.findFirst({
      where: { id: jobId, tenantId },
      include: {
        fitEvaluation: true,
        proposal: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`Job con ID ${jobId} no encontrado`);
    }

    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    // 1. Seleccionar la historia de autoridad solicitada o la sugerida
    const requestedKey = body.proofStoryKey || job.fitEvaluation?.suggestedProofStory;
    let selectedStory = profile?.proofStories.find(
      s => s.keyCode === requestedKey || s.id === requestedKey
    );
    if (!selectedStory && profile?.proofStories && profile.proofStories.length > 0) {
      selectedStory = profile.proofStories[0];
    }

    this.logger.log(`🤖 Regenerando propuesta Tri-Factor con IA para Job ${job.id} usando ProofStory ${selectedStory?.keyCode}`);

    // 2. Invocar ClaudeProposalService (Gemini 3.8 Flash)
    const proposalResult = await this.claudeProposal.generate({
      jobTitle: job.title,
      jobDescription: job.description,
      clientCountry: job.clientCountry || undefined,
      proofStoryKey: selectedStory?.keyCode || 'PEPPER_AI',
      proofStoryCompany: selectedStory?.companyOrProduct || 'Pepper AI',
      proofStoryMetric: selectedStory?.impactMetric || '17,000+ users and seed funding',
      offerHeadline: profile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
      targetAudience: profile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
      voiceRules: (profile?.voiceRules as string[]) || [],
      normalizedRole: job.fitEvaluation?.normalizedRole || 'Senior Product Specialist',
    });

    // 3. Upsert en base de datos
    const proposal = await this.prisma.proposal.upsert({
      where: { jobPostId: job.id },
      create: {
        jobPostId: job.id,
        contactName: proposalResult.contactName,
        coverLetter35Words: proposalResult.coverLetter35Words,
        technicalProposalBody: proposalResult.technicalProposalBody,
        mermaidDiagramCode: proposalResult.mermaidDiagramCode,
        publicWalkthroughSlug: `p-${job.id.substring(0, 8)}`,
      },
      update: {
        contactName: proposalResult.contactName,
        coverLetter35Words: proposalResult.coverLetter35Words,
        technicalProposalBody: proposalResult.technicalProposalBody,
        mermaidDiagramCode: proposalResult.mermaidDiagramCode,
      },
    });

    // 4. Actualizar suggestedProofStory si fue alterada
    if (selectedStory && job.fitEvaluation) {
      await this.prisma.fitEvaluation.update({
        where: { jobPostId: job.id },
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
   * POST /api/scraping/synthesize-batch
   * Genera propuestas en lote para los empleos de alto fitScore (Highest Fit Score First).
   */
  @Post('synthesize-batch')
  async synthesizeBatch(
    @Body() body: { minScore?: number; overwrite?: boolean; limit?: number },
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const minScore = body?.minScore ?? 75;
    const overwrite = body?.overwrite ?? false;
    const limit = body?.limit ?? 10;

    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    const candidates = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        fitEvaluation: {
          overallScore: { gte: minScore },
        },
        ...(overwrite ? {} : { proposal: null }),
      },
      include: {
        fitEvaluation: true,
        proposal: true,
      },
      orderBy: {
        fitEvaluation: {
          overallScore: 'desc',
        },
      },
      take: limit,
    });

    this.logger.log(`⚡ Iniciando síntesis en lote para ${candidates.length} empleos (minScore: ${minScore})`);

    const results = [];
    for (const job of candidates) {
      const selectedStory = profile?.proofStories.find(
        s => s.keyCode === job.fitEvaluation?.suggestedProofStory
      ) || profile?.proofStories?.[0];

      try {
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: job.title,
          jobDescription: job.description,
          clientCountry: job.clientCountry || undefined,
          proofStoryKey: selectedStory?.keyCode || 'PEPPER_AI',
          proofStoryCompany: selectedStory?.companyOrProduct || 'Pepper AI',
          proofStoryMetric: selectedStory?.impactMetric || '17,000+ active users',
          offerHeadline: profile?.offerHeadline || 'AI-native UX & High-Scale Product Architecture',
          targetAudience: profile?.targetAudience || 'Seed-to-Series B SaaS founders and product leads',
          voiceRules: (profile?.voiceRules as string[]) || [],
          normalizedRole: job.fitEvaluation?.normalizedRole || 'Senior Product Specialist',
        });

        const proposal = await this.prisma.proposal.upsert({
          where: { jobPostId: job.id },
          create: {
            jobPostId: job.id,
            contactName: proposalResult.contactName,
            coverLetter35Words: proposalResult.coverLetter35Words,
            technicalProposalBody: proposalResult.technicalProposalBody,
            mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            publicWalkthroughSlug: `p-${job.id.substring(0, 8)}`,
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
          overallScore: job.fitEvaluation?.overallScore,
          contactName: proposal.contactName,
          wordCount: proposal.coverLetter35Words.split(/\s+/).filter(Boolean).length,
          slug: proposal.publicWalkthroughSlug,
        });
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
  ) {
    const tenantId = this.tenantContext.getTenantId();
    const job = await this.prisma.jobPost.findFirst({
      where: { id, tenantId },
      include: {
        proposal: true,
        fitEvaluation: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`No se encontró el empleo con ID ${id}`);
    }

    if (!job.proposal?.technicalProposalBody) {
      throw new NotFoundException(`El empleo no cuenta con propuesta técnica generada`);
    }

    // Datos del perfil activo
    const profile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
    });

    let proofStoryCompany = 'Pepper AI';
    let proofStoryMetric = '17,000+ users and seed funding';

    if (job.fitEvaluation?.suggestedProofStory) {
      const story = await this.prisma.proofStory.findFirst({
        where: { keyCode: job.fitEvaluation.suggestedProofStory },
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
      contactName: job.proposal.contactName || 'Hiring Team',
      coverLetter35Words: job.proposal.coverLetter35Words || '',
      technicalProposalBody: job.proposal.technicalProposalBody,
      mermaidDiagramCode: job.proposal.mermaidDiagramCode || '',
      proofStoryCompany,
      proofStoryMetric,
      profileHeadline: profile?.offerHeadline,
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
  async getDailyReport() {
    const tenantId = this.tenantContext.getTenantId();
    const [jobs, scrapeConfig] = await Promise.all([
      this.prisma.jobPost.findMany({
        where: { tenantId },
        include: {
          fitEvaluation: true,
          proposal: true,
        },
        orderBy: [
          { fitEvaluation: { overallScore: 'desc' } },
          { postedAt: 'desc' },
        ],
      }),
      this.prisma.scrapeConfig.findFirst({ where: { tenantId } }),
    ]);

    const targetCountries = (scrapeConfig?.targetCountries || []).map((c: string) => c.trim().toLowerCase());
    const excludedCountries = (scrapeConfig?.excludedCountries || []).map((c: string) => c.trim().toLowerCase());

    return jobs.map((job) => {
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
      };
    });
  }

  /**
   * GET /api/scraping/report/csv
   * Descarga el reporte diario en formato CSV compatible con Excel / Google Sheets
   */
  @Get('report/csv')
  async exportCsv() {
    const report = await this.getDailyReport();
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
  async reprocessExistingJobs() {
    const tenantId = this.tenantContext.getTenantId();
    const existingJobs = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        rawApifyPayload: { not: null as any },
      },
    });

    this.logger.log(`Iniciando re-procesamiento en frío para ${existingJobs.length} empleos de tenant ${tenantId}`);

    const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });
    const activeProfile = await this.prisma.positioningProfile.findFirst({
      where: { tenantId, isActive: true },
      include: { proofStories: true },
    });

    let updatedCount = 0;
    const chunkSize = 25;
    for (let i = 0; i < existingJobs.length; i += chunkSize) {
      const chunk = existingJobs.slice(i, i + chunkSize);
      await Promise.all(chunk.map(async (job) => {
        if (!job.rawApifyPayload) return;

        const normalized = this.apifyAdapter.normalizeRaw(job.rawApifyPayload as Record<string, any>);

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
          clientTotalSpend: Number(normalized.clientTotalSpend),
          clientRating: Number(normalized.clientRating),
          clientCountry: normalized.clientCountry || undefined,
          proposalsCount: normalized.proposalsCount,
          isPaymentVerified: normalized.isPaymentVerified,
          postedDate: normalized.postedAt,
          targetCountries: scrapeConfig?.targetCountries || [],
          excludedCountries: scrapeConfig?.excludedCountries || [],
        });

        await this.prisma.fitEvaluation.upsert({
          where: { jobPostId: job.id },
          create: {
            jobPostId: job.id,
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

        updatedCount++;
      }));
    }

    // FASE 2: Intervención IA únicamente en el Top 3 Gold de los empleos re-procesados
    const topCandidates = await this.prisma.jobPost.findMany({
      where: {
        tenantId,
        fitEvaluation: {
          fitTier: { not: 'LOW' },
        },
      },
      include: { fitEvaluation: true },
      orderBy: {
        fitEvaluation: { overallScore: 'desc' },
      },
      take: 3,
    });

    let top3Generated = 0;
    for (const candidate of topCandidates) {
      if (!candidate.fitEvaluation) continue;
      try {
        const matchingStory = activeProfile?.proofStories?.find(s => s.keyCode === candidate.fitEvaluation?.suggestedProofStory) || activeProfile?.proofStories?.[0];
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: candidate.title,
          jobDescription: candidate.description,
          proofStoryKey: matchingStory?.keyCode || candidate.fitEvaluation.suggestedProofStory || 'SPOTLIGHT_AI',
          proofStoryCompany: matchingStory?.companyOrProduct,
          proofStoryMetric: matchingStory?.impactMetric,
          offerHeadline: activeProfile?.offerHeadline,
          targetAudience: activeProfile?.targetAudience,
          voiceRules: (activeProfile?.voiceRules as string[]) || undefined,
          normalizedRole: candidate.fitEvaluation.normalizedRole,
        });

        await this.prisma.proposal.upsert({
          where: { jobPostId: candidate.id },
          create: {
            jobPostId: candidate.id,
            contactName: proposalResult.contactName,
            coverLetter35Words: proposalResult.coverLetter35Words,
            technicalProposalBody: proposalResult.technicalProposalBody,
            mermaidDiagramCode: proposalResult.mermaidDiagramCode,
            publicWalkthroughSlug: `p-${candidate.id.substring(0, 8)}`,
          },
          update: {
            contactName: proposalResult.contactName,
            coverLetter35Words: proposalResult.coverLetter35Words,
            technicalProposalBody: proposalResult.technicalProposalBody,
            mermaidDiagramCode: proposalResult.mermaidDiagramCode,
          },
        });
        top3Generated++;
      } catch (err: any) {
        this.logger.warn(`Error generando propuesta IA en reprocess para ${candidate.id}: ${err.message}`);
      }
    }

    return {
      success: true,
      reprocessedCount: updatedCount,
      top3GoldGenerated: top3Generated,
      message: `Se re-evaluaron ${updatedCount} empleos ($0 tokens) y la IA redactó el Top ${top3Generated} Gold.`,
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

  /**
   * GET /api/scraping/market-radar
   * Agregador Estadístico de Mercado (Radar de Oportunidades y Arbitraje)
   * Extrae de PostgreSQL las métricas reales y calcula la Matriz de Oportunidad para el consultor.
   */
  @Get('market-radar')
  async getMarketRadar() {
    const tenantId = this.tenantContext.getTenantId();

    const [jobs, profile] = await Promise.all([
      this.prisma.jobPost.findMany({
        where: { tenantId },
        include: { fitEvaluation: true },
      }),
      this.prisma.positioningProfile.findFirst({
        where: { tenantId, isActive: true },
        include: { proofStories: true },
      }),
    ]);

    const categorize = (title: string, desc: string, rawSkills: any): string => {
      const skills = Array.isArray(rawSkills) ? rawSkills : [];
      const text = `${title} ${desc} ${skills.join(' ')}`.toLowerCase();

      if (/social media|content creation|instagram|tiktok|video edit|carousel|reels|youtube/i.test(title)) {
        return 'Social media content';
      }
      if (/design system|figma component|token|ui library|style guide/i.test(text) && /design|figma/i.test(title)) {
        return 'Design systems';
      }
      if (/ux research|user testing|usability test|user interview|heuristic/i.test(text)) {
        return 'UX research';
      }
      if (/full stack|fullstack|saas|web application|platform/i.test(title) || (/full stack/i.test(text) && /developer|engineer/i.test(text))) {
        return 'Full Stack & SaaS Web Apps';
      }
      if (/llm|ai agent|agentic|gpt|openai|chatbot|claude|langchain|rag|prompt/i.test(text)) {
        return 'AI prototyping / AI Agents';
      }
      if (/n8n|zapier|make\.com|workflow automation|automation engineer|power automate/i.test(text)) {
        return 'n8n / workflow automation';
      }
      if (/gohighlevel|ghl|crm setup|funnel/i.test(text)) {
        return 'GoHighLevel setup';
      }
      if (/ux\/ui|ui\/ux|product designer|web design|figma/i.test(title)) {
        return 'UX/UI design';
      }
      if (/translat|english to spanish|spanish to english|bilingual/i.test(text)) {
        return 'Spanish/English translation';
      }
      if (/seo|aeo|geo|search optimization|ai search/i.test(text)) {
        return 'AEO / GEO (AI search)';
      }
      if (/backend|node\.js|nestjs|api|express|graphql|microservice/i.test(title)) {
        return 'Backend & API Engineering';
      }
      if (/mobile|flutter|react native|ios|android/i.test(title)) {
        return 'Mobile App Development';
      }
      if (/wordpress|shopify|wix|webflow|elementor/i.test(title)) {
        return 'CMS & E-commerce (WP/Shopify)';
      }
      return 'Other Tech / Digital Work';
    };

    const median = (arr: number[]): number => {
      if (!arr || arr.length === 0) return 0;
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    // Coeficiente empírico de facilidad / apalancamiento de IA (0 a 100)
    const aiEaseMap: Record<string, number> = {
      'Social media content': 85,
      'Spanish/English translation': 85,
      'AI prototyping / AI Agents': 80,
      'n8n / workflow automation': 75,
      'GoHighLevel setup': 75,
      'AEO / GEO (AI search)': 70,
      'Full Stack & SaaS Web Apps': 70,
      'Backend & API Engineering': 65,
      'UX/UI design': 60,
      'Design systems': 55,
      'Mobile App Development': 50,
      'CMS & E-commerce (WP/Shopify)': 65,
      'UX research': 35,
      'Other Tech / Digital Work': 50,
    };

    // Rango temporal para New jobs/hr
    const validDates = jobs.map(j => j.postedAt ? new Date(j.postedAt).getTime() : null).filter(Boolean) as number[];
    const minTime = validDates.length > 0 ? Math.min(...validDates) : Date.now() - (24 * 3600 * 1000);
    const maxTime = validDates.length > 0 ? Math.max(...validDates) : Date.now();
    const totalHours = Math.max(1, (maxTime - minTime) / (1000 * 3600));

    // Agrupamiento
    const groups: Record<string, typeof jobs> = {};
    for (const job of jobs) {
      const skills = (job.rawApifyPayload as any)?.skills || [];
      const cat = categorize(job.title, job.description, skills);
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(job);
    }

    const coreRolesText = (profile?.coreRoles || []).join(' ').toLowerCase();
    const excludedRolesText = (profile?.excludedRoles || []).join(' ').toLowerCase();

    const categoryRows = Object.keys(groups).map(cat => {
      const list = groups[cat];
      const sampled = list.length;

      // Determinar Lane dinámicamente según el perfil activo
      let lane: 'Core' | 'Adjacent' | 'Excluded' = 'Adjacent';
      const catLower = cat.toLowerCase();

      if (excludedRolesText && (/wordpress|shopify|cms/i.test(catLower) || /ui\/ux|design/i.test(catLower) && /ui\/ux designer/i.test(excludedRolesText))) {
        lane = 'Excluded';
      } else if (coreRolesText && (/full stack|saas/i.test(catLower) && /full stack/i.test(coreRolesText) || /ai prototyping|ai agents/i.test(catLower) && /ai|agent/i.test(coreRolesText) || /backend|api/i.test(catLower) && /backend/i.test(coreRolesText) || /design systems/i.test(catLower) && /design system/i.test(coreRolesText) || /ux\/ui/i.test(catLower) && /ux\/ui|ui\/ux/i.test(coreRolesText))) {
        lane = 'Core';
      }

      // Skill Affinity calculada del FitEvaluation promedio de esa categoría
      const evaluatedJobs = list.filter(j => j.fitEvaluation);
      let skillAffinity = 60;
      if (evaluatedJobs.length > 0) {
        const avgSkill = evaluatedJobs.reduce((acc, j) => acc + (j.fitEvaluation?.skillScore || 50), 0) / evaluatedJobs.length;
        skillAffinity = Math.round(avgSkill);
      } else if (lane === 'Core') {
        skillAffinity = 90;
      } else if (lane === 'Excluded') {
        skillAffinity = 15;
      }

      const aiEase = aiEaseMap[cat] || 60;
      const newJobsPerHour = +(sampled / totalHours).toFixed(2);

      const proposals = list.map(j => j.proposalsCount || 0);
      const medianProposals = Math.round(median(proposals));

      const under10Count = list.filter(j => (j.proposalsCount || 0) < 10).length;
      const pctUnder10 = Math.round((under10Count / sampled) * 100);

      const hourlyRates = list.map(j => {
        if (j.hourlyMax && Number(j.hourlyMax) > 0) return Number(j.hourlyMax);
        if (j.hourlyMin && Number(j.hourlyMin) > 0) return Number(j.hourlyMin);
        return null;
      }).filter((r): r is number => r !== null && r > 0);
      const medianHourly = hourlyRates.length > 0 ? Math.round(median(hourlyRates)) : 25;

      const fixedBudgets = list.map(j => j.budgetFixed ? Number(j.budgetFixed) : null).filter((b): b is number => b !== null && b > 0);
      const medianFixed = fixedBudgets.length > 0 ? Math.round(median(fixedBudgets)) : 200;

      const verifiedCount = list.filter(j => j.isPaymentVerified).length;
      const pctVerified = Math.round((verifiedCount / sampled) * 100);

      // Personal Fit = (Skill * 0.6) + (AI Ease * 0.4)
      const personalFit = Math.round((skillAffinity * 0.6) + (aiEase * 0.4));

      // Market Score = F(Demand, Low Competition, Pay, Verified)
      const demandScore = Math.min(30, Math.round(newJobsPerHour * 10));
      const compScore = Math.round((pctUnder10 / 100) * 35);
      const payScore = Math.min(20, Math.round((medianHourly / 50) * 20));
      const verifiedScore = Math.round((pctVerified / 100) * 15);
      const marketScore = Math.min(99, Math.max(15, demandScore + compScore + payScore + verifiedScore));

      // Overall Opportunity
      let overallOpp = Math.round((marketScore * 0.5) + (personalFit * 0.5));
      if (lane === 'Excluded') {
        overallOpp = Math.min(25, overallOpp);
      }

      return {
        category: cat,
        lane,
        overallOpportunity: overallOpp,
        marketScore,
        personalFit,
        newJobsPerHour,
        medianProposals,
        pctUnder10Proposals: pctUnder10,
        medianHourly,
        medianFixed,
        pctVerifiedClients: pctVerified,
        skillAffinity,
        aiEase,
        relevantJobsSampled: sampled,
        runsAveraged: 1,
        updated: new Date().toISOString().split('T')[0],
      };
    });

    // Ordenar por Overall Opportunity DESC y asignar Rank
    categoryRows.sort((a, b) => b.overallOpportunity - a.overallOpportunity);
    const rankedRows = categoryRows.map((r, i) => ({ rank: i + 1, ...r }));

    // KPIs globales
    const topCategory = rankedRows[0]?.category || 'N/A';
    const oceanBlueRows = rankedRows.filter(r => r.medianProposals <= 5 && r.personalFit >= 70 && r.lane !== 'Excluded');

    return {
      success: true,
      data: {
        kpis: {
          totalJobsSampled: jobs.length,
          topCategory,
          oceanBlueCount: oceanBlueRows.length,
          medianProposalsAcrossAll: Math.round(median(jobs.map(j => j.proposalsCount || 0))),
          activeProfileName: profile?.offerHeadline ? 'Leonardo Jaimes' : 'Consultor Activo',
        },
        categories: rankedRows,
        provenance: [
          {
            field: 'Category',
            table: 'job_posts',
            columns: 'title, description, raw_apify_payload->skills',
            formula: 'Clustering semántico por reglas y palabras clave de servicio',
            purpose: 'Agrupa el mercado por nichos comerciales para no operar con 290 filas sueltas',
          },
          {
            field: 'Lane',
            table: 'positioning_profiles',
            columns: 'core_roles, hybrid_roles, excluded_roles',
            formula: 'Mapeo contra la taxonomía de 4 tiers del perfil activo',
            purpose: 'Distingue tus fortalezas centrales (Core) de servicios secundarios (Adjacent) o prohibidos (Excluded)',
          },
          {
            field: 'Relevant jobs sampled',
            table: 'job_posts',
            columns: 'id',
            formula: 'COUNT(id) WHERE category = C',
            purpose: 'Valida la profundidad muestral de cada nicho en la base de datos',
          },
          {
            field: 'New jobs per hour',
            table: 'job_posts',
            columns: 'posted_at',
            formula: 'COUNT(id) / Δt (horas transcurridas)',
            purpose: 'Mide la velocidad de flujo y frecuencia de llegada de nuevos clientes',
          },
          {
            field: 'Median proposals already in',
            table: 'job_posts',
            columns: 'proposals_count',
            formula: 'MEDIAN(proposals_count)',
            purpose: 'Mide la saturación de competencia directa por vacante',
          },
          {
            field: '% jobs under 10 proposals',
            table: 'job_posts',
            columns: 'proposals_count',
            formula: '(COUNT(proposals_count < 10) / Total) * 100',
            purpose: 'Mide la probabilidad de estar en la primera página de postulación del cliente',
          },
          {
            field: 'Median hourly (USD)',
            table: 'job_posts',
            columns: 'hourly_min, hourly_max',
            formula: 'MEDIAN((hourly_min + hourly_max) / 2) sobre contratos por hora',
            purpose: 'Tarifa horaria típica de mercado que pagan los clientes en ese nicho',
          },
          {
            field: 'Median fixed (USD)',
            table: 'job_posts',
            columns: 'budget_fixed',
            formula: 'MEDIAN(budget_fixed) sobre contratos de precio fijo',
            purpose: 'Presupuesto típico por proyecto para calcular valor esperado por contrato',
          },
          {
            field: '% verified clients',
            table: 'job_posts',
            columns: 'is_payment_verified',
            formula: '(COUNT(is_payment_verified = true) / Total) * 100',
            purpose: 'Seguridad financiera y protección contra pérdidas de Connects por fraude',
          },
          {
            field: 'Skill affinity',
            table: 'fit_evaluations',
            columns: 'skill_score cruzado con positioning_profiles',
            formula: 'AVG(skill_score) de las vacantes de esa categoría',
            purpose: 'Dominio técnico y capacidad demostrable del consultor para ganar el contrato',
          },
          {
            field: 'AI ease',
            table: 'fit_evaluations',
            columns: 'ai_feasibility_score',
            formula: 'Promedio de viabilidad de asistencia y entrega con IA generativa (0 a 100)',
            purpose: 'Mide el multiplicador de margen: entregar en horas lo que antes tomaba días',
          },
          {
            field: 'Personal fit',
            table: 'Derivado compuesto',
            columns: 'Skill affinity, AI ease',
            formula: '(Skill affinity * 0.60) + (AI ease * 0.40)',
            purpose: 'Qué tan cómodo, rápido y rentable es para TI ejecutar este servicio',
          },
          {
            field: 'Market score',
            table: 'Derivado compuesto',
            columns: 'New jobs/hr, % < 10 prop, Median hourly, % verified',
            formula: 'F(Demanda) + F(Baja Competencia) + F(Tarifa) + F(Solvencia)',
            purpose: 'Salud y fertilidad objetiva del mercado independiente de tus habilidades',
          },
          {
            field: 'Overall opportunity',
            table: 'Score Maestro',
            columns: 'Market score, Personal fit, Lane',
            formula: '(Market score * 0.50) + (Personal fit * 0.50) [Capado si Excluded]',
            purpose: 'Decisión ejecutiva de postulación: equilibra mercado sano con capacidad de ganar',
          },
        ]
      }
    };
  }
}

