import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { formatRelativeTime, getTimestampOrZero } from './date.utils.ts';

describe('DateUtils - formatRelativeTime & getTimestampOrZero', () => {
  it('should return fallback for missing or invalid dates', () => {
    assert.strictEqual(formatRelativeTime(null), 'Reciente');
    assert.strictEqual(formatRelativeTime(undefined), 'Reciente');
    assert.strictEqual(formatRelativeTime('invalid-date'), 'Reciente');
    assert.strictEqual(getTimestampOrZero(null), 0);
    assert.strictEqual(getTimestampOrZero('invalid'), 0);
  });

  it('should format minutes, hours and days correctly', () => {
    const now = Date.now();
    const tenMinAgo = new Date(now - 10 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(now - 3 * 3600 * 1000).toISOString();
    const twoDaysAgo = new Date(now - 2 * 24 * 3600 * 1000).toISOString();

    assert.strictEqual(formatRelativeTime(tenMinAgo), 'Hace 10 min');
    assert.strictEqual(formatRelativeTime(threeHoursAgo), 'Hace 3 h');
    assert.strictEqual(formatRelativeTime(twoDaysAgo), 'Hace 2 d');
  });

  it('should extract correct epoch timestamp for sorting', () => {
    const iso = '2026-10-29T12:00:00.000Z';
    const expected = new Date(iso).getTime();
    assert.strictEqual(getTimestampOrZero(iso), expected);
  });
});
