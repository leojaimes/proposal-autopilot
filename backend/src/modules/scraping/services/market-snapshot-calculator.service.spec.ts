import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketSnapshotCalculator } from './market-snapshot-calculator.service';

const calculator = new MarketSnapshotCalculator();
const asOf = new Date('2026-10-22T12:00:00.000Z');

test('uses only observed source fields and never treats unknown proposals as zero', () => {
  const metrics = calculator.calculate([
    {
      id: 'observed-zero', batchRunId: 'batch-1', postedAt: new Date('2026-10-22T09:00:00.000Z'), postedAtKnown: true,
      proposalsCount: 0, proposalsCountKnown: true, budgetFixed: 1000, isPaymentVerified: true, paymentVerificationKnown: true,
    },
    {
      id: 'unknown-proposals', batchRunId: 'batch-1', postedAt: new Date('2026-10-20T09:00:00.000Z'), postedAtKnown: true,
      proposalsCount: 0, proposalsCountKnown: false, budgetFixed: 2000, isPaymentVerified: false, paymentVerificationKnown: false,
    },
    {
      id: 'unknown-date', batchRunId: null, postedAt: new Date('2026-10-22T09:00:00.000Z'), postedAtKnown: false,
      proposalsCount: 2, proposalsCountKnown: true, budgetFixed: 3000, isPaymentVerified: true, paymentVerificationKnown: true,
    },
  ], asOf);

  assert.equal(metrics.demand7d, 2);
  assert.equal(metrics.demand30d, 2);
  assert.equal(metrics.medianProposals, 0);
  assert.equal(metrics.medianBudget, 1500);
  assert.equal(metrics.verifiedClientsPct, 100);
  assert.deepEqual(metrics.metricCoverage, {
    proposalsKnownJobs: 1,
    fixedBudgetJobs: 2,
    paymentVerificationKnownJobs: 1,
  });
  assert.equal(metrics.sourceBatchCount, 1);
  assert.deepEqual(metrics.evidenceJobIds, ['observed-zero', 'unknown-proposals']);
});

test('keeps unavailable measurements null and reports zero confidence without a dated sample', () => {
  const metrics = calculator.calculate([
    {
      id: 'unknown-date', batchRunId: null, postedAt: new Date('2026-10-22T09:00:00.000Z'), postedAtKnown: false,
      proposalsCount: 0, proposalsCountKnown: false, budgetFixed: null, isPaymentVerified: false, paymentVerificationKnown: false,
    },
  ], asOf);

  assert.equal(metrics.demand7d, 0);
  assert.equal(metrics.medianProposals, null);
  assert.equal(metrics.medianBudget, null);
  assert.equal(metrics.verifiedClientsPct, null);
  assert.equal(metrics.sampleConfidence, 0);
});
