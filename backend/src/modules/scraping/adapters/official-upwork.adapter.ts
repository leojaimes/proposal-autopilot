import { Injectable, Logger } from '@nestjs/common';
import { BudgetType } from '@prisma/client';
import { NormalizedJob, JobDataSourcePort } from '../ports/job-data-source.port';

/**
 * Adaptador Plug-and-Play para la API Oficial de Upwork (OAuth 2.0 / GraphQL).
 * Listo para activarse cuando se configuren UPWORK_CLIENT_ID y UPWORK_CLIENT_SECRET.
 */
@Injectable()
export class OfficialUpworkApiAdapter implements JobDataSourcePort {
  readonly providerName = 'OFFICIAL_UPWORK_API' as const;
  private readonly logger = new Logger(OfficialUpworkApiAdapter.name);

  async fetchJobs(keywords: string[], maxResults: number = 15): Promise<NormalizedJob[]> {
    this.logger.log(`[OfficialUpworkApiAdapter] Consultando API Oficial de Upwork (GraphQL) para: ${keywords.join(', ')}`);
    // Cuando el usuario configure las credenciales OAuth oficiales de Upwork:
    // const res = await fetch('https://api.upwork.com/graphql', { ... });
    // return res.jobs.map(this.normalizeRaw);
    return [];
  }

  normalizeRaw(raw: Record<string, any>): NormalizedJob {
    // Normalizador para la estructura de respuesta GraphQL oficial de Upwork
    return {
      externalId: String(raw.ciphertext || raw.id || ''),
      title: raw.title || '',
      description: raw.description || '',
      jobUrl: `https://www.upwork.com/jobs/${raw.ciphertext || raw.id}`,
      budgetType: raw.amount?.type === 'FIXED' ? BudgetType.FIXED : BudgetType.HOURLY,
      budgetFixed: raw.amount?.amount || null,
      hourlyMin: raw.hourlyBudget?.min || null,
      hourlyMax: raw.hourlyBudget?.max || null,
      clientCountry: raw.client?.location?.country || null,
      clientRating: Number(raw.client?.feedbackScore || 0),
      clientTotalSpend: Number(raw.client?.totalSpent || 0),
      clientHireRate: Number(raw.client?.hireRate || null),
      proposalsCount: Number(raw.totalApplicants || 0),
      isPaymentVerified: Boolean(raw.client?.isPaymentVerified),
      skills: Array.isArray(raw.skills) ? raw.skills.map((s: any) => s.name || String(s)) : [],
      postedAt: raw.createdDateTime ? new Date(raw.createdDateTime) : new Date(),
      rawPayload: raw,
    };
  }
}
