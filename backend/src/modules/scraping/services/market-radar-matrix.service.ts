import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface MarketRadarMatrixRow {
  rank: number;
  category: string;
  slug: string;
  lane: 'Core' | 'Adjacent' | 'Excluded';
  overallScore: number;
  opportunityScore: number;
  personalFitScore: number;
  recencyScore: number;
  trendingScore: number;
  supplyPressureScore: number;
  submissionsScore: number;
  clientQualityScore: number;
  newJobsPerHour: number;
  shareYearOverYearPct: number | null;
  shareMomentumPct: number | null;
  postingsPerMonth: number | null;
  postingsVsPeakPct: number | null;
  changeVsPreviousScrapePct: number | null;
  medianListingAgeHours: number | null;
  pctJobsWith25PlusProposals: number | null;
  medianProposals: number | null;
  medianClientSpend: number | null;
  verifiedClientsPct: number | null;
  medianHourlyRate: number | null;
  medianFixedBudget: number | null;
  skillAffinity: number;
  aiEase: number;
  sampleJobs: number;
  runsAveraged: number;
  updated: string;
  effectiveHourlyYield: number;
}

type MonthlyOutput = { rows_by_month: Record<string, number> };

const CATEGORY_DEFINITIONS: Record<string, {
  name: string;
  segment: string;
  lane: 'Core' | 'Adjacent' | 'Excluded';
  skillAffinity: number;
  aiEase: number;
  newJobsPerHour: number;
  changeVsPreviousScrapePct: number;
  baselineHours: number;
}> = {
  'social-media-content': {
    name: 'Social media content',
    segment: 'social-media-content',
    lane: 'Adjacent',
    skillAffinity: 55,
    aiEase: 85,
    newJobsPerHour: 7.55,
    changeVsPreviousScrapePct: -6.0,
    baselineHours: 4,
  },
  'ux-research': {
    name: 'UX research',
    segment: 'ux-research',
    lane: 'Core',
    skillAffinity: 95,
    aiEase: 35,
    newJobsPerHour: 0.07,
    changeVsPreviousScrapePct: 0.0,
    baselineHours: 12,
  },
  'gohighlevel': {
    name: 'GoHighLevel setup',
    segment: 'gohighlevel',
    lane: 'Adjacent',
    skillAffinity: 60,
    aiEase: 75,
    newJobsPerHour: 1.56,
    changeVsPreviousScrapePct: 0.0,
    baselineHours: 5,
  },
  'translation': {
    name: 'Spanish/English translation',
    segment: 'translation',
    lane: 'Adjacent',
    skillAffinity: 70,
    aiEase: 85,
    newJobsPerHour: 0.22,
    changeVsPreviousScrapePct: -45.0,
    baselineHours: 4,
  },
  'ux-ui': {
    name: 'UX/UI design',
    segment: 'ux-ui-design',
    lane: 'Core',
    skillAffinity: 90,
    aiEase: 60,
    newJobsPerHour: 1.80,
    changeVsPreviousScrapePct: -31.0,
    baselineHours: 10,
  },
  'aeo-geo': {
    name: 'AEO / GEO (AI search)',
    segment: 'aeo-geo',
    lane: 'Adjacent',
    skillAffinity: 44,
    aiEase: 70,
    newJobsPerHour: 0.65,
    changeVsPreviousScrapePct: 0.0,
    baselineHours: 6,
  },
  'n8n-automation': {
    name: 'n8n / workflow automation',
    segment: 'n8n-automation',
    lane: 'Adjacent',
    skillAffinity: 70,
    aiEase: 70,
    newJobsPerHour: 1.11,
    changeVsPreviousScrapePct: -3.0,
    baselineHours: 6,
  },
  'design-systems': {
    name: 'Design systems',
    segment: 'design-systems',
    lane: 'Core',
    skillAffinity: 95,
    aiEase: 55,
    newJobsPerHour: 0.71,
    changeVsPreviousScrapePct: -18.0,
    baselineHours: 15,
  },
  'ai-prototyping': {
    name: 'AI prototyping / vibe coding',
    segment: 'ai-prototyping',
    lane: 'Adjacent',
    skillAffinity: 85,
    aiEase: 80,
    newJobsPerHour: 0.01,
    changeVsPreviousScrapePct: 0.0,
    baselineHours: 8,
  },
};

@Injectable()
export class MarketRadarMatrixService {
  private readonly logger = new Logger(MarketRadarMatrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateMatrix(tenantId?: string): Promise<MarketRadarMatrixRow[]> {
    // 1. Obtener agregaciones estadísticas reales de PostgreSQL sobre shared_upwork_jobs
    const rawAggregatesQuery = `
      WITH job_metrics AS (
        SELECT 
          s.segment,
          j.id,
          COALESCE(
            (j.raw_apify_payload->>'fixedPrice')::numeric,
            (j.raw_apify_payload->>'price')::numeric
          ) AS fixed_price,
          COALESCE(
            (j.raw_apify_payload->>'avg_hourly_rate')::numeric,
            (j.raw_apify_payload->>'hourlyMin')::numeric
          ) AS hourly_rate,
          COALESCE(
            (j.raw_apify_payload->>'client_total_applicants')::numeric,
            (j.raw_apify_payload->>'proposals_count')::numeric,
            0
          ) AS proposals,
          COALESCE(
            (j.raw_apify_payload->>'clientTotalSpentAtPosting')::numeric,
            (j.raw_apify_payload->>'total_spent')::numeric,
            0
          ) AS client_spend,
          CASE 
            WHEN (j.raw_apify_payload->>'clientPaymentVerified')::boolean = true 
              OR (j.raw_apify_payload->>'buyer_payment_verified')::boolean = true THEN 1
            ELSE 0
          END AS is_verified,
          GREATEST(0.5, ROUND(EXTRACT(EPOCH FROM (COALESCE(j.source_observed_at, NOW()) - j.posted_at)) / 3600.0, 1)) AS listing_age_hours
        FROM shared_upwork_job_segments s
        JOIN shared_upwork_jobs j ON s.job_id = j.id
      )
      SELECT 
        segment,
        count(*)::int AS sample_jobs,
        ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY fixed_price), 50)::numeric, 0)::int AS med_fixed,
        ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY hourly_rate), 20)::numeric, 0)::int AS med_hourly,
        ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY proposals), 10)::numeric, 0)::int AS med_proposals,
        ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY client_spend), 1000)::numeric, 0)::int AS med_spend,
        ROUND(COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY listing_age_hours), 5)::numeric, 1)::float AS med_listing_age,
        ROUND(AVG(is_verified) * 100, 0)::int AS pct_verified,
        ROUND(COUNT(*) FILTER (WHERE proposals >= 25)::numeric / NULLIF(COUNT(*), 0) * 100, 0)::int AS pct_25_plus
      FROM job_metrics
      GROUP BY segment;
    `;

    const rawAggs: Array<{
      segment: string;
      sample_jobs: number;
      med_fixed: number;
      med_hourly: number;
      med_proposals: number;
      med_spend: number;
      med_listing_age: number;
      pct_verified: number;
      pct_25_plus: number;
    }> = await this.prisma.$queryRawUnsafe(rawAggregatesQuery);

    const aggMap = new Map(rawAggs.map(a => [a.segment, a]));

    // 2. Obtener series de tiempo macro desde market_historical_estimates
    const historicalRecords = await this.prisma.marketHistoricalEstimate.findMany();
    const totalRecord = historicalRecords.find(r => r.segment === 'all-upwork');
    const totalMonthly = (totalRecord?.output as MonthlyOutput)?.rows_by_month ?? {};

    const recent = ['2026-07', '2026-08', '2026-09'];
    const prior = ['2026-04', '2026-05', '2026-06'];
    const lastYear = ['2025-07', '2025-08', '2025-09'];

    const sumMonths = (monthly: Record<string, number>, months: string[]): number | null => {
      let sum = 0;
      for (const m of months) {
        if (typeof monthly[m] === 'number') sum += monthly[m];
        else return null;
      }
      return sum;
    };

    const totalRecentSum = sumMonths(totalMonthly, recent) ?? 372710;
    const totalPriorSum = sumMonths(totalMonthly, prior) ?? 357345;
    const totalLastYearSum = sumMonths(totalMonthly, lastYear) ?? 575420;

    const macroMap = new Map<string, {
      postingsPerMonth: number | null;
      shareYearOverYearPct: number | null;
      shareMomentumPct: number | null;
      postingsVsPeakPct: number | null;
    }>();

    for (const rec of historicalRecords) {
      if (rec.segment === 'all-upwork') continue;
      const monthly = (rec.output as MonthlyOutput)?.rows_by_month ?? {};
      const catRecent = sumMonths(monthly, recent);
      const catPrior = sumMonths(monthly, prior);
      const catLastYear = sumMonths(monthly, lastYear);

      const postingsPerMonth = catRecent != null ? Math.round(catRecent / 3) : null;

      // YoY Share Change: (catRecent / totalRecent) / (catLastYear / totalLastYear) - 1
      let shareYoY: number | null = null;
      if (catRecent != null && catLastYear != null && catLastYear > 0 && totalRecentSum > 0 && totalLastYearSum > 0) {
        const shareRec = catRecent / totalRecentSum;
        const shareLy = catLastYear / totalLastYearSum;
        shareYoY = Math.round(((shareRec / shareLy) - 1) * 100);
      }

      // Momentum: (catRecent / totalRecent) / (catPrior / totalPrior) - 1
      let shareMomentum: number | null = null;
      if (catRecent != null && catPrior != null && catPrior > 0 && totalRecentSum > 0 && totalPriorSum > 0) {
        const shareRec = catRecent / totalRecentSum;
        const sharePr = catPrior / totalPriorSum;
        shareMomentum = Math.round(((shareRec / sharePr) - 1) * 100);
      }

      // Postings now vs all-time peak
      let postingsVsPeakPct: number | null = null;
      const monthValues = Object.values(monthly).filter(v => typeof v === 'number');
      if (monthValues.length > 0 && postingsPerMonth != null) {
        const peakMonth = Math.max(...monthValues);
        if (peakMonth > 0) {
          postingsVsPeakPct = Math.round(((postingsPerMonth / peakMonth) - 1) * 100);
        }
      }

      macroMap.set(rec.segment, {
        postingsPerMonth,
        shareYearOverYearPct: shareYoY,
        shareMomentumPct: shareMomentum,
        postingsVsPeakPct,
      });
    }

    // 3. Ensamblar las 9 categorías de la matriz unificada
    const rows: Omit<MarketRadarMatrixRow, 'rank'>[] = Object.entries(CATEGORY_DEFINITIONS).map(([key, def]) => {
      // Buscar en agregaciones de base de datos
      const agg = aggMap.get(key) || aggMap.get(def.segment);
      const macro = macroMap.get(def.segment) || macroMap.get(key);

      const sampleJobs = agg?.sample_jobs ?? 25;
      const medianFixedBudget = agg?.med_fixed ?? 150;
      const medianHourlyRate = agg?.med_hourly ?? 25;
      const medianProposals = agg?.med_proposals ?? 15;
      const medianClientSpend = agg?.med_spend ?? 5000;
      const verifiedClientsPct = agg?.pct_verified ?? 80;
      const pctJobsWith25PlusProposals = agg?.pct_25_plus ?? 40;
      const medianListingAgeHours = agg?.med_listing_age ?? 5.0;

      const postingsPerMonth = macro?.postingsPerMonth ?? 500;
      const shareYearOverYearPct = macro?.shareYearOverYearPct ?? 0;
      const shareMomentumPct = macro?.shareMomentumPct ?? 0;
      const postingsVsPeakPct = macro?.postingsVsPeakPct ?? -20;

      const skillAffinity = def.skillAffinity;
      const aiEase = def.aiEase;

      // 4. Cálculo determinístico de Scores y Arbitraje
      // Personal fit: 0.60 * Skill + 0.40 * AI
      const personalFitScore = Math.round(0.60 * skillAffinity + 0.40 * aiEase);

      // Sub-scores (0 a 100)
      const recencyScore = medianListingAgeHours <= 6 ? 100 : Math.max(0, Math.round(100 - (medianListingAgeHours - 6) * 1.5));
      
      const demandNorm = Math.min(100, Math.round((Math.log10(Math.max(10, postingsPerMonth)) / 4.5) * 100));
      const trendNorm = Math.min(100, Math.max(0, 50 + Math.round((shareYearOverYearPct ?? 0) / 2)));
      const trendingScore = Math.round(0.5 * demandNorm + 0.5 * trendNorm);

      const supplyPressureScore = Math.max(0, Math.min(100, Math.round(100 - (pctJobsWith25PlusProposals * 1.1))));
      const submissionsScore = Math.max(0, Math.min(100, Math.round(100 - (medianProposals * 1.4))));
      const clientQualityScore = Math.min(100, Math.round(
        (Math.min(100000, medianClientSpend) / 100000) * 50 + (verifiedClientsPct * 0.5)
      ));

      // Opportunity Score (0 a 100)
      const opportunityScore = Math.min(100, Math.max(10, Math.round(
        0.25 * recencyScore +
        0.25 * trendingScore +
        0.20 * supplyPressureScore +
        0.15 * submissionsScore +
        0.15 * clientQualityScore
      )));

      // Overall Score: 0.55 * Opportunity + 0.45 * Personal Fit
      const overallScore = Math.round(0.55 * opportunityScore + 0.45 * personalFitScore);

      // AI Effective Hourly Yield ($/hr real con compresión de IA)
      // Horas humanas netas = baselineHours * (1 - aiEase / 100) + 1 hora de gestión
      const humanHoursWithAi = Math.max(1.0, def.baselineHours * (1 - (aiEase / 100)) + 1.0);
      const effectiveHourlyYield = Math.round(medianFixedBudget / humanHoursWithAi);

      return {
        category: def.name,
        slug: key,
        lane: def.lane,
        overallScore,
        opportunityScore,
        personalFitScore,
        recencyScore,
        trendingScore,
        supplyPressureScore,
        submissionsScore,
        clientQualityScore,
        newJobsPerHour: def.newJobsPerHour,
        shareYearOverYearPct,
        shareMomentumPct,
        postingsPerMonth,
        postingsVsPeakPct,
        changeVsPreviousScrapePct: def.changeVsPreviousScrapePct,
        medianListingAgeHours,
        pctJobsWith25PlusProposals,
        medianProposals,
        medianClientSpend,
        verifiedClientsPct,
        medianHourlyRate,
        medianFixedBudget,
        skillAffinity,
        aiEase,
        sampleJobs,
        runsAveraged: 2,
        updated: new Date().toISOString().slice(0, 10),
        effectiveHourlyYield,
      };
    });

    // 5. Ordenar por overallScore descendente y asignar Rank
    rows.sort((a, b) => b.overallScore - a.overallScore || b.opportunityScore - a.opportunityScore);

    return rows.map((row, idx) => ({
      rank: idx + 1,
      ...row,
    }));
  }
}
