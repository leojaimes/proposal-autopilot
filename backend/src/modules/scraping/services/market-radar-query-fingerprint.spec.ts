import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { createMarketRadarQueryFingerprint } from './market-radar-query-fingerprint';

test('produces the same coverage identity for equivalent actor filters with different key order', () => {
  const first = createMarketRadarQueryFingerprint({
    from: '2026-10-01',
    skills: ['n8n'],
    to: '2026-10-31',
  });
  const reordered = createMarketRadarQueryFingerprint({
    to: '2026-10-31',
    from: '2026-10-01',
    skills: ['n8n'],
  });

  assert.equal(first, reordered);
});
