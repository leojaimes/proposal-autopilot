import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readApifyDatasetPages } from './apify-dataset-reader';

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
