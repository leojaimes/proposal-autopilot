import { Injectable, Logger, Optional } from '@nestjs/common';
import { BudgetType } from '@prisma/client';
import { NormalizedJob, JobDataSourcePort } from '../ports/job-data-source.port';
import { ApifyService } from '../apify.service';
import { LambdaLinkedInScraperService } from '../services/lambda-linkedin-scraper.service';

@Injectable()
export class LinkedInJobAdapter implements JobDataSourcePort {
  readonly providerName = 'LINKEDIN' as any;
  private readonly logger = new Logger(LinkedInJobAdapter.name);

  constructor(
    private readonly apifyService: ApifyService,
    @Optional() private readonly lambdaScraper?: LambdaLinkedInScraperService,
  ) {}

  async fetchJobs(keywords: string[], maxResults: number = 15, locations?: string[]): Promise<NormalizedJob[]> {
    let rawItems: Record<string, any>[] = [];

    if (this.lambdaScraper && process.env.AWS_LAMBDA_SCRAPER_FUNCTION_NAME) {
      try {
        const location = locations?.[0] || 'United States';
        rawItems = await this.lambdaScraper.scrapeJobs({
          keywords,
          limit: maxResults,
          location,
        });
      } catch (err: any) {
        this.logger.warn(`[LinkedInJobAdapter] Falló AWS Lambda, recurriendo a Apify fallback: ${err.message}`);
        rawItems = await this.apifyService.runLinkedInScraper(keywords, maxResults, locations);
      }
    } else {
      rawItems = await this.apifyService.runLinkedInScraper(keywords, maxResults, locations);
    }

    return rawItems.map((item) => this.normalizeRaw(item));
  }

  /**
   * Normalizador Defensivo para LinkedIn: Mapea esquemas de Apify LinkedIn a la entidad canónica.
   */
  normalizeRaw(raw: Record<string, any>): NormalizedJob {
    const externalId = String(raw.id || raw.jobId || raw.urn || raw.trackingId || '').replace(/^.*:/, '');
    const companyName = raw.companyName || raw.company || raw.company_name || null;

    // Priorizar applyUrl directo (ATS: Greenhouse, Lever, etc.) sobre el enlace de LinkedIn
    const directApplyUrl = raw.applyUrl || raw.applicationUrl || raw.easyApplyUrl;
    const jobUrl = directApplyUrl || raw.jobUrl || raw.link || raw.url || (externalId ? `https://www.linkedin.com/jobs/view/${externalId}` : 'https://www.linkedin.com');

    const companyInfo = raw.companyDescription ? `About ${companyName || 'Company'}:\n${raw.companyDescription}\n\n` : '';
    const jobBody = (
      raw.descriptionText ||
      raw.description ||
      raw.jobDescription ||
      raw.text ||
      raw.snippet ||
      (raw.descriptionHtml ? raw.descriptionHtml.replace(/<[^>]+>/g, ' ') : '')
    ).trim();

    const description = `${companyInfo}${jobBody}`.trim();

    // Parseo de Salario / Presupuesto
    let budgetType: BudgetType = BudgetType.NOT_SHOWN;
    let budgetFixed: number | null = null;
    let hourlyMin: number | null = null;
    let hourlyMax: number | null = null;

    const salaryRaw = String(raw.salaryRange || raw.salary || raw.compensation || '');
    if (salaryRaw) {
      const numbers = salaryRaw.match(/\d[\d,.]*/g)?.map((n) => Number(n.replace(/,/g, ''))) || [];
      const isHourly = /hr|hour|hora/i.test(salaryRaw);
      const isYearly = /yr|year|año|annual/i.test(salaryRaw) || numbers.some((n) => n > 1000);

      if (isHourly && numbers.length >= 1) {
        budgetType = BudgetType.HOURLY;
        hourlyMin = numbers[0] ?? null;
        hourlyMax = numbers[1] ?? numbers[0] ?? null;
      } else if (isYearly && numbers.length >= 1) {
        budgetType = BudgetType.FIXED;
        budgetFixed = numbers[0] ?? null;
      }
    }

    // Normalización de País / Ubicación
    let clientCountry: string | null = null;
    const rawLoc = String(raw.location || raw.place || raw.formattedLocation || '').trim();
    if (rawLoc) {
      if (/mexico|m[eé]xico|cdmx|guadalajara|monterrey/i.test(rawLoc)) {
        clientCountry = 'Mexico';
      } else if (/colombia|bogot[aá]|medell[ií]n|cali|barranquilla/i.test(rawLoc)) {
        clientCountry = 'Colombia';
      } else if (/united states|usa|\bus\b|ny|ca|sf|texas|california|new york/i.test(rawLoc)) {
        clientCountry = 'United States';
      } else if (/canada/i.test(rawLoc)) {
        clientCountry = 'Canada';
      } else if (/united kingdom|uk|london/i.test(rawLoc)) {
        clientCountry = 'United Kingdom';
      } else if (/germany|deutschland|berlin/i.test(rawLoc)) {
        clientCountry = 'Germany';
      } else if (/spain|españa|madrid|barcelona/i.test(rawLoc)) {
        clientCountry = 'Spain';
      } else {
        clientCountry = rawLoc;
      }
    }

    // Skills
    const skills: string[] = [];
    if (Array.isArray(raw.skills)) {
      skills.push(...raw.skills.map((s) => String(s)));
    } else if (Array.isArray(raw.jobRequirements)) {
      skills.push(...raw.jobRequirements.map((s) => String(s)));
    }

    // Fecha de publicación
    let postedAt: Date | null = null;
    const rawDate = raw.postedDate || raw.postedAt || raw.date || raw.publishTime;
    if (rawDate) {
      const parsed = new Date(rawDate);
      if (!isNaN(parsed.getTime())) {
        postedAt = parsed;
      }
    }

    return {
      externalId,
      title: raw.title || raw.jobTitle || 'Untitled LinkedIn Job',
      description,
      jobUrl,
      companyName,
      source: 'LINKEDIN',
      budgetType,
      budgetFixed,
      hourlyMin,
      hourlyMax,
      clientCountry,
      clientRating: 5.0,
      clientTotalSpend: 0,
      clientHireRate: null,
      proposalsCount: null,
      proposalsCountKnown: false,
      isPaymentVerified: false,
      paymentVerificationKnown: false,
      skills,
      postedAt,
      postedAtKnown: postedAt != null,
      rawPayload: raw,
    };
  }
}
