import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { MarketTrendCalculator } from './market-trend-calculator.service';

const calculator = new MarketTrendCalculator();

test('compares a category against its immediately previous daily snapshot', () => {
  const trends = calculator.calculate([
    { taxonomyNodeId: 'design-systems', asOf: new Date('2026-10-20T00:00:00.000Z'), demand30d: 10, medianProposals: 8, overallOpportunity: 55 },
    { taxonomyNodeId: 'design-systems', asOf: new Date('2026-10-22T00:00:00.000Z'), demand30d: 14, medianProposals: 6, overallOpportunity: 63 },
  ]);

  assert.deepEqual(trends.get('design-systems'), {
    comparedTo: new Date('2026-10-20T00:00:00.000Z'),
    elapsedDays: 2,
    demand30dDelta: 4,
    medianProposalsDelta: -2,
    overallOpportunityDelta: 8,
  });
});

test('withholds a trend when there is no earlier snapshot or either metric was unknown', () => {
  const trends = calculator.calculate([
    { taxonomyNodeId: 'ux-research', asOf: new Date('2026-10-22T00:00:00.000Z'), demand30d: 4, medianProposals: null, overallOpportunity: null },
    { taxonomyNodeId: 'single-day', asOf: new Date('2026-10-22T00:00:00.000Z'), demand30d: 3, medianProposals: 7, overallOpportunity: 50 },
    { taxonomyNodeId: 'ux-research', asOf: new Date('2026-10-21T00:00:00.000Z'), demand30d: 2, medianProposals: 4, overallOpportunity: 42 },
  ]);

  assert.deepEqual(trends.get('ux-research'), {
    comparedTo: new Date('2026-10-21T00:00:00.000Z'),
    elapsedDays: 1,
    demand30dDelta: 2,
    medianProposalsDelta: null,
    overallOpportunityDelta: null,
  });
  assert.equal(trends.get('single-day'), null);
});
