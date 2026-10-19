import { Injectable, Logger } from '@nestjs/common';
import { BudgetType } from '@prisma/client';
import { NormalizedJob, JobDataSourcePort } from '../ports/job-data-source.port';
import { ApifyService } from '../apify.service';

@Injectable()
export class ApifyJobAdapter implements JobDataSourcePort {
  readonly providerName = 'APIFY' as const;
  private readonly logger = new Logger(ApifyJobAdapter.name);

  constructor(private readonly apifyService: ApifyService) {}

  async fetchJobs(keywords: string[], maxResults: number = 15): Promise<NormalizedJob[]> {
    const rawItems = await this.apifyService.runUpworkScraper(keywords, maxResults);
    return rawItems.map(item => this.normalizeRaw(item));
  }

  /**
   * Normalizador Defensivo: Extrae los campos reales de Apify sin importar variaciones de esquema.
   */
  normalizeRaw(raw: Record<string, any>): NormalizedJob {
    const externalId = String(raw.upwork_job_id || raw.id || '');
    const jobUrl = raw.link || raw.url || (externalId ? `https://www.upwork.com/jobs/${externalId}` : 'https://www.upwork.com');

    // 1. Descripción Real: Apify entrega 'job_detail'
    const description = (raw.job_detail || raw.description || '').trim();

    // 2. Parseo de Presupuesto
    let budgetType: BudgetType = BudgetType.NOT_SHOWN;
    let budgetFixed: number | null = null;
    let hourlyMin: number | null = null;
    let hourlyMax: number | null = null;

    const bType = String(raw.budget_type || raw.budget?.type || '').toUpperCase();
    if (bType.includes('FIXED') || typeof raw.budget === 'number' || raw.budget?.amount) {
      budgetType = BudgetType.FIXED;
      budgetFixed = typeof raw.budget === 'number' ? raw.budget : (raw.budget?.amount || null);
    } else if (bType.includes('HOURLY') || raw.budget?.min || raw.budget?.max) {
      budgetType = BudgetType.HOURLY;
      hourlyMin = raw.budget?.min || null;
      hourlyMax = raw.budget?.max || null;
    }

    // 3. Métricas del Comprador (Solvencia y Reputación)
    const buyerStats = raw.buyer?.stats || {};
    const clientRating = Number(buyerStats.score ?? raw.client?.rating ?? 0);
    const clientTotalSpend = Number(buyerStats.totalCharges?.amount ?? raw.client?.totalSpent ?? 0);

    // 4. Ubicación del Cliente
    let clientCountry: string | null = raw.buyer?.location?.country || raw.client?.country || null;
    if (!clientCountry && raw.nation) {
      // Formato típico en Apify: "India/Hyderabad" -> "India"
      clientCountry = String(raw.nation).split('/')[0].trim();
    }

    // 5. Verificación de Pago y Competencia (Propuestas enviadas)
    const isPaymentVerified = Boolean(
      raw.isPaymentMethodVerified || 
      raw.buyer?.isPaymentMethodVerified || 
      raw.isPaymentVerified
    );

    const proposalsCount = Number(
      raw.client_activity?.totalApplicants ?? 
      raw.proposals?.count ?? 
      0
    );

    // 6. Hire Rate Histórico (% de contratación del cliente)
    let clientHireRate: number | null = null;
    if (buyerStats.totalAssignments && buyerStats.totalJobsWithHires) {
      const hires = Number(buyerStats.totalJobsWithHires);
      const total = Number(buyerStats.totalAssignments);
      if (total > 0) {
        clientHireRate = Math.min(100, Math.round((hires / total) * 100));
      }
    }

    // 7. Habilidades Requeridas
    const skills: string[] = [];
    if (Array.isArray(raw.ontologySkills)) {
      skills.push(...raw.ontologySkills.map((s: any) => s.prefLabel || s.name || String(s)));
    } else if (Array.isArray(raw.skills)) {
      skills.push(...raw.skills.map((s: any) => String(s)));
    }

    // 8. Fecha Real de Publicación
    const postedAt = raw.publish_time ? new Date(raw.publish_time) : (raw.postedDate ? new Date(raw.postedDate) : new Date());

    return {
      externalId,
      title: raw.title || raw.job_title || 'Untitled Upwork Job',
      description,
      jobUrl,
      budgetType,
      budgetFixed,
      hourlyMin,
      hourlyMax,
      clientCountry,
      clientRating,
      clientTotalSpend,
      clientHireRate,
      proposalsCount,
      isPaymentVerified,
      skills,
      postedAt,
      rawPayload: raw,
    };
  }
}
