import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { findOldestApifyJobPostedAt, readApifyDatasetPages } from './apify-dataset-reader';

test('finds the earliest valid job posting date in an Apify dataset', () => {
  const oldest = findOldestApifyJobPostedAt([
    { id: 'newest', date_posted: '2026-11-05T14:00:00.000Z' },
    { id: 'invalid', date_posted: 'not-a-date' },
    { id: 'oldest', date_posted: '2026-10-22T01:00:00.000Z' },
  ]);

  assert.deepEqual(oldest, new Date('2026-10-22T01:00:00.000Z'));
});

test('reads every Apify dataset page in stable offset order', async () => {
  const requestedUrls: string[] = [];
  const items = await readApifyDatasetPages('dataset-1', 'token-1', async (url) => {
    requestedUrls.push(url);
    const offset = new URL(url).searchParams.get('offset');
    const body = offset === '0' ? [{ id: '1' }, { id: '2' }]
      : offset === '2' ? [{ id: '3' }]
        : [];
    return { ok: true, async json() { return body; } };
  }, 2);

  assert.deepEqual(items, [{ id: '1' }, { id: '2' }, { id: '3' }]);
  assert.equal(requestedUrls.length, 2);
  assert.match(requestedUrls[0], /offset=0/);
  assert.match(requestedUrls[1], /offset=2/);
});
