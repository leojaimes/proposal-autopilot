import { Controller, Post, Get, Patch, Body, Param, Logger } from '@nestjs/common';
import { ApifyService } from './apify.service';
import { FitCalculatorService } from '../scoring/services/fit-calculator.service';
import { ClaudeProposalService } from '../proposals/claude-proposal.service';
import { PrismaService } from '../../core/database/prisma.service';
import { TenantContextService } from '../../core/context/tenant-context.service';
import { BudgetType, JobStatus, StrategicLane, FitTier } from '@prisma/client';

export interface TriggerScrapeDto {
  keywords?: string[];
  maxResults?: number;
}

export interface UpdateStatusDto {
  status: 'APPROVED' | 'SKIPPED' | 'APPLIED' | 'NEEDS_REVIEW';
}

@Controller('api/scraping')
export class ScrapingController {
  private readonly logger = new Logger(ScrapingController.name);

  constructor(
    private readonly apifyService: ApifyService,
    private readonly fitCalculator: FitCalculatorService,
    private readonly claudeProposal: ClaudeProposalService,
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Dispara el scraping de Apify, clasifica con taxonomía, calcula Fit 0-100 y genera propuestas
   */
  @Post('trigger')
  async triggerBatch(@Body() body: TriggerScrapeDto) {
    const tenantId = this.tenantContext.getTenantId();
    const keywords = body.keywords && body.keywords.length > 0 
      ? body.keywords 
      : ['UX Designer', 'Product Designer', 'Design Systems', 'AI UX', 'Figma'];
    const maxResults = body.maxResults || 15;

    this.logger.log(`Disparando batch para Tenant ${tenantId} con ${keywords.length} keywords`);

    // 1. Asegurar que exista un Tenant por defecto para pruebas
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

    // 2. Registrar el inicio del BatchRun
    const batchRun = await this.prisma.batchRun.create({
      data: {
        tenantId,
        status: 'RUNNING',
      },
    });

    // 3. Ejecutar Scraper de Apify (flash_mage/upwork)
    const rawJobs = await this.apifyService.runUpworkScraper(keywords, maxResults);
    this.logger.log(`Se recibieron ${rawJobs.length} empleos desde Apify`);

    let highFitCount = 0;
    let mediumFitCount = 0;
    const processedJobs = [];

    // 4. Procesar, puntuar y guardar cada empleo
    for (const raw of rawJobs) {
      if (!raw.id) continue;

      // Parseo de presupuesto
      let budgetType: BudgetType = BudgetType.NOT_SHOWN;
      let budgetFixed: number | null = null;
      let hourlyMin: number | null = null;
      let hourlyMax: number | null = null;

      if (raw.budget?.type?.toUpperCase() === 'FIXED' || raw.budget?.amount) {
        budgetType = BudgetType.FIXED;
        budgetFixed = raw.budget.amount || null;
      } else if (raw.budget?.type?.toUpperCase() === 'HOURLY' || raw.budget?.min || raw.budget?.max) {
        budgetType = BudgetType.HOURLY;
        hourlyMin = raw.budget.min || null;
        hourlyMax = raw.budget.max || null;
      }

      // Upsert JobPost
      const jobPost = await this.prisma.jobPost.upsert({
        where: {
          uq_tenant_external_job: {
            tenantId,
            externalUpworkId: String(raw.id),
          },
        },
        create: {
          tenantId,
          batchRunId: batchRun.id,
          externalUpworkId: String(raw.id),
          title: raw.title || 'Untitled Job',
          description: raw.description || '',
          budgetType,
          budgetFixed,
          hourlyMin,
          hourlyMax,
          clientCountry: raw.client?.country || null,
          clientRating: raw.client?.rating || 0,
          clientTotalSpend: raw.client?.totalSpent || 0,
          proposalsCount: raw.proposals?.count || 0,
          isPaymentVerified: !!raw.isPaymentVerified,
          jobUrl: raw.url || `https://www.upwork.com/jobs/${raw.id}`,
          postedAt: raw.postedDate ? new Date(raw.postedDate) : new Date(),
          status: JobStatus.NEEDS_REVIEW,
          rawApifyPayload: raw as any,
        },
        update: {
          title: raw.title || 'Untitled Job',
          description: raw.description || '',
          budgetType,
          budgetFixed,
          hourlyMin,
          hourlyMax,
          clientCountry: raw.client?.country || null,
          clientRating: raw.client?.rating || 0,
          clientTotalSpend: raw.client?.totalSpent || 0,
          isPaymentVerified: !!raw.isPaymentVerified,
        },
      });

      // 5. Cálculo Matemático del FitScore (40/25/20/15 + CAP en 44)
      const evaluation = this.fitCalculator.calculate({
        title: jobPost.title,
        description: jobPost.description,
        skills: raw.skills,
        clientTotalSpend: Number(jobPost.clientTotalSpend),
        clientRating: Number(jobPost.clientRating),
        proposalsCount: jobPost.proposalsCount,
        isPaymentVerified: jobPost.isPaymentVerified,
        postedDate: jobPost.postedAt,
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

      // 6. Generación Lazy de Propuesta (solo si no es LOW)
      if (evaluation.fitTier !== 'LOW') {
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
      }

      processedJobs.push({
        id: jobPost.id,
        externalUpworkId: jobPost.externalUpworkId,
        title: jobPost.title,
        overallScore: evaluation.overallScore,
        fitTier: evaluation.fitTier,
        strategicLane: evaluation.strategicLane,
        normalizedRole: evaluation.normalizedRole,
        suggestedProofStory: evaluation.suggestedProofStory,
        isCapped: evaluation.isCapped,
      });
    }

    // Actualizar BatchRun
    await this.prisma.batchRun.update({
      where: { id: batchRun.id },
      data: {
        finishedAt: new Date(),
        jobsFound: rawJobs.length,
        highFitCount,
        mediumFitCount,
        status: 'COMPLETED',
      },
    });

    return {
      success: true,
      batchRunId: batchRun.id,
      totalScraped: rawJobs.length,
      highFitCount,
      mediumFitCount,
      lowFitCount: rawJobs.length - (highFitCount + mediumFitCount),
      jobs: processedJobs,
    };
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
   * GET /api/scraping/report
   * Genera el informe plano exacto con las 17 columnas de la tabla diaria de Upwork
   */
  @Get('report')
  async getDailyReport() {
    const tenantId = this.tenantContext.getTenantId();
    const jobs = await this.prisma.jobPost.findMany({
      where: { tenantId },
      include: {
        fitEvaluation: true,
        proposal: true,
      },
      orderBy: [
        { fitEvaluation: { overallScore: 'desc' } },
        { postedAt: 'desc' },
      ],
    });

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

      // 5. Enlace al Documento de Propuesta
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
        id: job.id,
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
    await this.triggerBatch({ maxResults: 15 });
    return { success: true, message: 'Preset restaurado con éxito.' };
  }
}
