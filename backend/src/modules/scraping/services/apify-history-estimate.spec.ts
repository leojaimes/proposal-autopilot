import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { parseApifyHistoryEstimate } from './apify-history-estimate';

test('parses the available history window and posting count from Apify estimate status', () => {
  const estimate = parseApifyHistoryEstimate(
    'Estimate, nothing delivered or charged: 1,458,069 postings, 2025-11-05 to 2026-10-01, every category. All of them would cost $291.86 on your plan.',
  );

  assert.deepEqual(estimate, {
    postingCount: 1458069,
    from: '2025-11-05',
    to: '2026-10-01',
  });
});
