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
    if (!keywords || keywords.length === 0) {
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
          tenantId,
          batchRunId,
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
          proposalsCount: normalized.proposalsCount,
          isPaymentVerified: normalized.isPaymentVerified,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt,
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
          proposalsCount: normalized.proposalsCount,
          isPaymentVerified: normalized.isPaymentVerified,
          jobUrl: normalized.jobUrl,
          postedAt: normalized.postedAt,
          rawApifyPayload: normalized.rawPayload as any,
        },
      });

      // Cálculo Matemático del FitScore
      const evaluation = this.fitCalculator.calculate({
        title: jobPost.title,
        description: jobPost.description,
        skills: normalized.skills,
        clientTotalSpend: Number(jobPost.clientTotalSpend),
        clientRating: Number(jobPost.clientRating),
        clientCountry: jobPost.clientCountry || undefined,
        proposalsCount: normalized.proposalsCount != null ? normalized.proposalsCount : undefined,
        isPaymentVerified: jobPost.isPaymentVerified,
        postedDate: normalized.postedAt || undefined,
        targetCountries: scrapeConfig?.targetCountries || [],
        targetRegions: scrapeConfig?.targetRegions || [],
        excludedCountries: scrapeConfig?.excludedCountries || [],
        geoFilterMode: scrapeConfig?.geoFilterMode || 'WEIGHTED_PREFERENCE',
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
        const proposalResult = await this.claudeProposal.generate({
          jobTitle: jobPost.title,
          jobDescription: jobPost.description,
          proofStoryKey: evaluation.suggestedProofStory,
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
        clientTotalSpend: Number(job.clientTotalSpend || 0),
        clientRating: Number(job.clientRating || 0),
        clientCountry: clientCountry || undefined,
        proposalsCount: proposalsCount != null ? proposalsCount : undefined,
        isPaymentVerified: job.isPaymentVerified,
        postedDate: postedAt || undefined,
        targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
        geoFilterMode: 'WEIGHTED_PREFERENCE',
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

      // 5. Drivers & Drags Decisionales
      const drivers: string[] = [];
      const drags: string[] = [];
      const cCountry = (job.clientCountry || '').trim().toLowerCase();
      const isTargetCountry = cCountry && targetCountries.some((t: string) => cCountry.includes(t) || t.includes(cCountry));
      const isExcludedCountry = cCountry && excludedCountries.some((e: string) => cCountry.includes(e) || e.includes(cCountry));

      if (ev) {
        if (ev.skillScore >= 80) {
          drivers.push(`Rol alineado: ${ev.normalizedRole} (${ev.skillScore} pts)`);
        } else if (ev.skillScore <= 35) {
          drags.push(`Rol fuera de nicho o baja afinidad (${ev.skillScore} pts)`);
        }

        if (Number(job.clientTotalSpend || 0) >= 20000) {
          drivers.push(`Cliente High-Ticket ($${Math.round(Number(job.clientTotalSpend)).toLocaleString()} USD gastados)`);
        } else if (Number(job.clientTotalSpend || 0) < 500) {
          drags.push(`Cliente nuevo con baja inversión ($${Math.round(Number(job.clientTotalSpend))} USD)`);
        }

        if (Number(job.clientRating || 0) >= 4.8) {
          drivers.push(`Excelente reputación (${Number(job.clientRating).toFixed(1)}/5.0)`);
        }

        if (job.isPaymentVerified) {
          drivers.push(`Método de pago verificado`);
        } else {
          drags.push(`Método de pago no verificado (-20 pts)`);
        }

        if (isTargetCountry) {
          drivers.push(`Mercado prioritario: ${job.clientCountry} (+15 pts)`);
        }
        if (isExcludedCountry) {
          drags.push(`País en lista de exclusión: ${job.clientCountry}`);
        }

        if (job.proposalsCount <= 5) {
          drivers.push(`Ventaja primer postor: Solo ${job.proposalsCount} propuestas`);
        } else if (job.proposalsCount > 20) {
          drags.push(`Alta competencia: ${job.proposalsCount} propuestas ya enviadas`);
        }

        if (ev.recencyScore >= 85) {
          drivers.push(`Vacante ultra fresca (<6h)`);
        } else if (ev.recencyScore <= 50) {
          drags.push(`Vacante antigua (>24h)`);
        }

        if (ev.isCapped && ev.capReason) {
          drags.push(`Techo de seguridad: ${ev.capReason}`);
        }
      }

      // 6. Enlace al Documento de Propuesta
      const proposalDocLink = job.proposal?.googleDocUrl 
        || (job.proposal?.publicWalkthroughSlug ? `http://localhost:7001/walkthrough/${job.proposal.publicWalkthroughSlug}` : '');

      return {
        fitScore: ev?.overallScore ?? 0,
        fitLabel,
        jobTitle: job.title,
        budget: budgetStr,
        clientCountry: job.clientCountry || 'Unknown',
        clientRating: Number(job.clientRating || 0),
        clientTotalSpent: Number(job.clientTotalSpend || 0),
        verifiedPayment: job.isPaymentVerified ? 'Yes' : 'No',
        proposalsAlreadyIn: job.proposalsCount,
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

    let updatedCount = 0;
    for (const job of existingJobs) {
      if (!job.rawApifyPayload) continue;

      const normalized = this.apifyAdapter.normalizeRaw(job.rawApifyPayload as Record<string, any>);

      // 1. Actualizar JobPost con los datos reales completos
      await this.prisma.jobPost.update({
        where: { id: job.id },
        data: {
          title: normalized.title,
          description: normalized.description,
          budgetType: normalized.budgetType,
          budgetFixed: normalized.budgetFixed,
          hourlyMin: normalized.hourlyMin,
          hourlyMax: normalized.hourlyMax,
          clientCountry: normalized.clientCountry,
          clientRating: normalized.clientRating,
          clientTotalSpend: normalized.clientTotalSpend,
          proposalsCount: normalized.proposalsCount,
          isPaymentVerified: normalized.isPaymentVerified,
          postedAt: normalized.postedAt,
        },
      });

      // 2. Re-calcular Fit con datos reales y preferencias geográficas
      const scrapeConfig = await this.prisma.scrapeConfig.findFirst({ where: { tenantId } });
      const evaluation = this.fitCalculator.calculate({
        title: normalized.title,
        description: normalized.description,
        skills: normalized.skills,
        clientTotalSpend: Number(normalized.clientTotalSpend),
        clientRating: Number(normalized.clientRating),
        clientCountry: normalized.clientCountry || undefined,
        proposalsCount: normalized.proposalsCount,
        isPaymentVerified: normalized.isPaymentVerified,
        postedDate: normalized.postedAt,
        targetCountries: scrapeConfig?.targetCountries || [],
        targetRegions: scrapeConfig?.targetRegions || [],
        excludedCountries: scrapeConfig?.excludedCountries || [],
        geoFilterMode: scrapeConfig?.geoFilterMode || 'WEIGHTED_PREFERENCE',
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
    }

    return {
      success: true,
      reprocessedCount: updatedCount,
      message: `Se re-procesaron ${updatedCount} empleos con sus descripciones y métricas reales a costo $0.`,
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
