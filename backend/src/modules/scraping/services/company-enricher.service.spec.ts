import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { CompanyEnricherService } from './company-enricher.service';

describe('CompanyEnricherService - Unit Test Suite', () => {
  it('should return fallback if companyName is generic or empty', async () => {
    const mockOrion = {
      search: async () => [],
      extract: async () => [],
    };
    const service = new CompanyEnricherService(mockOrion as any);

    const res1 = await service.enrichCompany('Hiring Team');
    assert.strictEqual(res1.enriched, false);
    assert.strictEqual(res1.companyName, 'Hiring Team');

    const res2 = await service.enrichCompany('');
    assert.strictEqual(res2.enriched, false);
  });

  it('should discover domain, extract markdown, and enrich profile', async () => {
    const mockOrion = {
      search: async (query: string) => {
        assert.ok(query.includes('Litera'));
        return [
          {
            title: 'Litera - Legal Technology Solutions',
            url: 'https://www.litera.com',
            content: 'Litera provides document drafting and review software.',
          },
        ];
      },
      extract: async (urls: string[]) => {
        assert.deepStrictEqual(urls, ['https://www.litera.com']);
        return [
          {
            url: 'https://www.litera.com',
            raw_content: '# Litera\nWe build legal technology software for law firms worldwide.',
          },
        ];
      },
    };

    const service = new CompanyEnricherService(mockOrion as any);
    const profile = await service.enrichCompany('Litera', 'Denver, CO');

    assert.strictEqual(profile.enriched, true);
    assert.strictEqual(profile.companyName, 'Litera');
    assert.strictEqual(profile.website, 'https://www.litera.com');
    assert.ok(profile.summary.length > 0);
  });

  it('should filter out aggregator/job board links like LinkedIn and Indeed from official website discovery', async () => {
    const mockOrion = {
      search: async () => [
        {
          title: 'Litera Jobs in Denver | Indeed.com',
          url: 'https://www.indeed.com/cmp/Litera',
          content: 'Jobs at Litera',
        },
        {
          title: 'Litera | LinkedIn',
          url: 'https://www.linkedin.com/company/litera',
          content: 'Litera company profile on LinkedIn',
        },
        {
          title: 'Litera | Legal Tech Solutions',
          url: 'https://www.litera.com',
          content: 'Official homepage of Litera',
        },
      ],
      extract: async (urls: string[]) => [
        {
          url: urls[0],
          raw_content: 'Official Litera homepage content',
        },
      ],
    };

    const service = new CompanyEnricherService(mockOrion as any);
    const profile = await service.enrichCompany('Litera');

    assert.strictEqual(profile.website, 'https://www.litera.com');
    assert.strictEqual(profile.enriched, true);
  });
});
