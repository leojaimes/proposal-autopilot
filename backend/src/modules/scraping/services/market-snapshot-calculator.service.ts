export interface MarketSnapshotJob {
  id: string;
  batchRunId: string | null;
  postedAt: Date;
  postedAtKnown: boolean;
  proposalsCount: number;
  proposalsCountKnown: boolean;
  budgetFixed: number | null;
  isPaymentVerified: boolean;
  paymentVerificationKnown: boolean;
}

export interface MetricCoverage {
  proposalsKnownJobs: number;
  fixedBudgetJobs: number;
  paymentVerificationKnownJobs: number;
}

export interface MarketSnapshotMetrics {
  demand7d: number;
  demand30d: number;
  medianProposals: number | null;
  medianBudget: number | null;
  verifiedClientsPct: number | null;
  sampleJobs: number;
  sampleConfidence: number;
  sourceBatchCount: number;
  metricCoverage: MetricCoverage;
  evidenceJobIds: string[];
  periodStart: Date;
  periodEnd: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function utcDayStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];

  return Number(value.toFixed(2));
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

/**
 * Computes transparent, source-observed market metrics. It deliberately does
 * not infer a zero for any field that the source did not observe.
 */
export class MarketSnapshotCalculator {
  calculate(jobs: MarketSnapshotJob[], asOf: Date): MarketSnapshotMetrics {
    const asOfStart = utcDayStart(asOf);
    const periodEnd = new Date(asOfStart.getTime() + DAY_MS - 1);
    const periodStart = new Date(asOfStart.getTime() - 29 * DAY_MS);
    const sevenDayStart = new Date(asOfStart.getTime() - 6 * DAY_MS);

    const datedJobs = jobs.filter((job) =>
      job.postedAtKnown && job.postedAt >= periodStart && job.postedAt <= periodEnd,
    );
    const sevenDayJobs = datedJobs.filter((job) => job.postedAt >= sevenDayStart);
    const proposalValues = datedJobs
      .filter((job) => job.proposalsCountKnown)
      .map((job) => job.proposalsCount);
    const fixedBudgetValues = datedJobs
      .flatMap((job) => job.budgetFixed == null ? [] : [job.budgetFixed]);
    const paymentKnownJobs = datedJobs.filter((job) => job.paymentVerificationKnown);
    const verifiedClientCount = paymentKnownJobs.filter((job) => job.isPaymentVerified).length;
    const coverage: MetricCoverage = {
      proposalsKnownJobs: proposalValues.length,
      fixedBudgetJobs: fixedBudgetValues.length,
      paymentVerificationKnownJobs: paymentKnownJobs.length,
    };

    const sampleSizeScore = Math.min(1, datedJobs.length / 30) * 40;
    const proposalCoverageScore = (proposalValues.length / Math.max(1, datedJobs.length)) * 20;
    const budgetCoverageScore = (fixedBudgetValues.length / Math.max(1, datedJobs.length)) * 20;
    const paymentCoverageScore = (paymentKnownJobs.length / Math.max(1, datedJobs.length)) * 20;

    return {
      demand7d: sevenDayJobs.length,
      demand30d: datedJobs.length,
      medianProposals: median(proposalValues),
      // This is intentionally fixed-price only. Hourly rates are a separate unit and must not be mixed.
      medianBudget: median(fixedBudgetValues),
      verifiedClientsPct: percentage(verifiedClientCount, paymentKnownJobs.length),
      sampleJobs: datedJobs.length,
      sampleConfidence: Number((sampleSizeScore + proposalCoverageScore + budgetCoverageScore + paymentCoverageScore).toFixed(2)),
      sourceBatchCount: new Set(datedJobs.flatMap((job) => job.batchRunId ? [job.batchRunId] : [])).size,
      metricCoverage: coverage,
      evidenceJobIds: datedJobs.map((job) => job.id),
      periodStart,
      periodEnd,
    };
  }
}
