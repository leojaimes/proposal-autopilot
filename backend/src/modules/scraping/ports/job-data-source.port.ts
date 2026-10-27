import { BudgetType } from '@prisma/client';

/**
 * Contrato unificado e independiente del proveedor para cualquier empleo de Upwork.
 * Ya sea extraído vía Scraper (Apify) o mediante la API Oficial de Upwork (OAuth 2.0 / GraphQL).
 */
export interface NormalizedJob {
  externalId: string;
  title: string;
  description: string;
  jobUrl: string;
  budgetType: BudgetType;
  budgetFixed: number | null;
  hourlyMin: number | null;
  hourlyMax: number | null;
  clientCountry: string | null;
  clientRating: number;
  clientTotalSpend: number;
  clientHireRate: number | null;
  proposalsCount: number | null;
  proposalsCountKnown: boolean;
  isPaymentVerified: boolean;
  paymentVerificationKnown: boolean;
  source?: 'UPWORK' | 'LINKEDIN';
  companyName?: string | null;
  skills: string[];
  postedAt: Date | null;
  postedAtKnown: boolean;
  rawPayload: Record<string, any>;
}

export interface JobDataSourcePort {
  readonly providerName: 'APIFY' | 'OFFICIAL_UPWORK_API' | 'MOCK';
  fetchJobs(keywords: string[], maxResults: number): Promise<NormalizedJob[]>;
  normalizeRaw(raw: Record<string, any>): NormalizedJob;
}
