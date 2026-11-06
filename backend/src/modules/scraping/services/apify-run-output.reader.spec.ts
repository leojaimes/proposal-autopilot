import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ApifyRunOutputReader } from './apify-run-output.reader';

test('reads next page from a completed full page output', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const reader = new ApifyRunOutputReader('test-token', async (url, init) => {
    calls.push({ url, init });
    return { ok: true, json: async () => ({ nextPage: 'continue-here', is_notification_mode: false }) };
  });

  const output = await reader.read('store-1');

  assert.deepEqual(output, { nextPage: 'continue-here', isNotificationMode: false });
  assert.deepEqual(calls, [{
    url: 'https://api.apify.com/v2/key-value-stores/store-1/records/OUTPUT?attachment=true',
    init: { headers: { authorization: 'Bearer test-token' } },
  }]);
});

test('returns a terminal page when next page is absent', async () => {
  const reader = new ApifyRunOutputReader('test-token', async () => ({
    ok: true,
    json: async () => ({ is_notification_mode: false }),
  }));

  assert.deepEqual(await reader.read('store-1'), { nextPage: null, isNotificationMode: false });
});

test('reads the actor OUTPUT fields nested under metadata', async () => {
  const reader = new ApifyRunOutputReader('test-token', async () => ({
    ok: true,
    json: async () => ({ metadata: { next_page: null, is_notification_mode: false } }),
  }));

  assert.deepEqual(await reader.read('store-1'), { nextPage: null, isNotificationMode: false });
});

test('rejects rejected or malformed output records', async () => {
  const rejectedReader = new ApifyRunOutputReader('test-token', async () => ({ ok: false, json: async () => ({}) }));
  const malformedReader = new ApifyRunOutputReader('test-token', async () => ({ ok: true, json: async () => ({ nextPage: 'next' }) }));

  await assert.rejects(rejectedReader.read('store-1'), /could not be read/);
  await assert.rejects(malformedReader.read('store-1'), /is invalid/);
});
