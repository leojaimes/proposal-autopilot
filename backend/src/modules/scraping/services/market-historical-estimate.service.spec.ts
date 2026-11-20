import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketHistoricalEstimateService } from './market-historical-estimate.service';

test('calculates monthly demand and share changes against the same platform denominator', async () => {
  const months = ['2025-07', '2025-08', '2025-09', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const make = (segment: string, count: number) => ({
    segment, actor: 'hyperbach/upwork-jobs-history', runId: segment, observedAt: new Date('2026-11-20'), input: {},
    output: { rows_by_month: Object.fromEntries(months.map((month) => [month, count])) },
  });
  const prisma = { marketHistoricalEstimate: { findMany: async () => [make('all-upwork', 100), make('n8n-automation', 10)] } };
  const rows = await new MarketHistoricalEstimateService(prisma as any).list();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].postingsPerMonth, 10);
  assert.equal(rows[0].shareYearOverYearPct, 0);
  assert.equal(rows[0].shareMomentumPct, 0);
});

test('uses posting share rather than raw category growth', async () => {
  const months = ['2025-07', '2025-08', '2025-09', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
  const make = (segment: string, counts: number[]) => ({
    segment, actor: 'hyperbach/upwork-jobs-history', runId: segment, observedAt: new Date('2026-11-20'), input: { skills: ['n8n'] },
    output: { rows_by_month: Object.fromEntries(months.map((month, index) => [month, counts[index]])) },
  });
  const prisma = { marketHistoricalEstimate: { findMany: async () => [
    make('all-upwork', [100, 100, 100, 200, 200, 200, 200, 200, 200]),
    make('n8n-automation', [10, 10, 10, 10, 10, 10, 20, 20, 20]),
  ] } };
  const [row] = await new MarketHistoricalEstimateService(prisma as any).list();
  assert.equal(row.postingsPerMonth, 20);
  assert.equal(row.shareYearOverYearPct, 0);
  assert.equal(row.shareMomentumPct, 100);
  assert.equal(row.filterLabel, 'n8n');
});

test('does not treat absent archive months as zero postings', async () => {
  const prisma = { marketHistoricalEstimate: { findMany: async () => [
    { segment: 'all-upwork', output: { rows_by_month: { '2025-07': 100, '2025-08': 100, '2025-09': 100, '2026-04': 100, '2026-05': 100, '2026-06': 100, '2026-07': 100, '2026-08': 100, '2026-09': 100 } } },
    { segment: 'n8n-automation', actor: 'hyperbach/upwork-jobs-history', runId: 'run-1', observedAt: new Date('2026-11-20'), input: { skills: ['n8n'] }, output: { rows_by_month: { '2025-09': 1, '2026-04': 2, '2026-05': 2, '2026-06': 2, '2026-07': 3, '2026-08': 3, '2026-09': 3 } } },
  ] } };
  const [row] = await new MarketHistoricalEstimateService(prisma as any).list();
  assert.equal(row.postingsPerMonth, 3);
  assert.equal(row.shareYearOverYearPct, null);
  assert.equal(row.shareMomentumPct, 50);
});
