import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { OrionSearchService } from './orion-search.service';

describe('OrionSearchService - Unit Test Suite', () => {
  it('should format search queries and parse results from Orion /search', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async (url: any, init?: any) => {
        if (String(url).includes('/search')) {
          const body = JSON.parse(init?.body || '{}');
          assert.strictEqual(body.query, 'Litera Denver official website');
          return {
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              query: body.query,
              results: [
                {
                  title: 'Litera | Legal Technology Solutions',
                  url: 'https://www.litera.com',
                  content: 'Litera runs legal workflows on one connected platform.',
                },
              ],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      }) as any;

      const service = new OrionSearchService('https://mock-orion.local', 5000);
      const results = await service.search('Litera Denver official website');

      assert.strictEqual(results.length, 1);
      assert.strictEqual(results[0].title, 'Litera | Legal Technology Solutions');
      assert.strictEqual(results[0].url, 'https://www.litera.com');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should extract clean markdown content from Orion /extract', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async (url: any, init?: any) => {
        if (String(url).includes('/extract')) {
          const body = JSON.parse(init?.body || '{}');
          assert.deepStrictEqual(body.urls, ['https://www.litera.com']);
          return {
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({
              results: [
                {
                  url: 'https://www.litera.com',
                  raw_content: '# Litera | Legal Tech\n\nPlatform for law firms.',
                },
              ],
            }),
          } as any;
        }
        return { ok: false, status: 404 } as any;
      }) as any;

      const service = new OrionSearchService('https://mock-orion.local', 5000);
      const extracted = await service.extract(['https://www.litera.com']);

      assert.strictEqual(extracted.length, 1);
      assert.strictEqual(extracted[0].url, 'https://www.litera.com');
      assert.ok(extracted[0].raw_content.includes('Litera | Legal Tech'));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('should handle offline Orion without throwing unhandled exceptions', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () => {
        throw new Error('ECONNREFUSED');
      }) as any;

      const service = new OrionSearchService('https://mock-orion.local', 5000);
      const results = await service.search('Any query');
      assert.deepStrictEqual(results, []);

      const extracted = await service.extract(['https://example.com']);
      assert.deepStrictEqual(extracted, []);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
