import { PrismaService } from '../../../core/database/prisma.service';

const labels: Record<string, string> = {
  'social-media-content': 'Social media content', translation: 'Translation (all languages)',
  'ux-ui-design': 'UX/UI design', 'n8n-automation': 'n8n / automation',
  gohighlevel: 'GoHighLevel', 'ux-research': 'UX research',
  'aeo-geo': 'AEO / GEO', 'ai-prototyping': 'AI prototyping',
  'design-systems': 'Design systems',
};
const recent = ['2026-07', '2026-08', '2026-09'];
const prior = ['2026-04', '2026-05', '2026-06'];
const lastYear = ['2025-07', '2025-08', '2025-09'];
type MonthlyOutput = { rows_by_month: Record<string, number> };
const sum = (months: Record<string, number>, period: string[]): number | null =>
  period.every((month) => Number.isFinite(months[month]))
    ? period.reduce((total, month) => total + months[month], 0)
    : null;
const percentChange = (current: number | null, previous: number | null): number | null =>
  current == null || previous == null || previous === 0 ? null : Math.round((current / previous - 1) * 1000) / 10;
const filterLabel = (input: { skills?: string[]; categories?: string[] }) =>
  input.skills?.join(', ') ?? input.categories?.join(', ') ?? 'All Upwork';

export class MarketHistoricalEstimateService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const records = await this.prisma.marketHistoricalEstimate.findMany();
    const total = records.find((record) => record.segment === 'all-upwork');
    if (!total) return [];
    const all = (total.output as MonthlyOutput).rows_by_month;
    return records.filter((record) => record.segment in labels).map((record) => {
      const monthly = (record.output as MonthlyOutput).rows_by_month;
      const share = (period: string[]) => {
        const count = sum(monthly, period);
        const denominator = sum(all, period);
        return count == null || denominator == null || denominator === 0 ? null : count / denominator;
      };
      const recentCount = sum(monthly, recent);
      return {
        segment: record.segment, category: labels[record.segment],
        postingsPerMonth: recentCount == null ? null : Math.round(recentCount / 3),
        shareYearOverYearPct: percentChange(share(recent), share(lastYear)),
        shareMomentumPct: percentChange(share(recent), share(prior)),
        period: '2026-07 to 2026-09', baselineYear: '2025-07 to 2025-09', priorPeriod: '2026-04 to 2026-06',
        source: record.actor, runId: record.runId, observedAt: record.observedAt.toISOString(),
        filter: record.input, filterLabel: filterLabel(record.input as { skills?: string[]; categories?: string[] }),
      };
    }).sort((a, b) => (b.postingsPerMonth ?? -1) - (a.postingsPerMonth ?? -1));
  }
}
