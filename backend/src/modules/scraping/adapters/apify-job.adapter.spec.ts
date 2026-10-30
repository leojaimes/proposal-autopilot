import test, { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { ApifyJobAdapter } from './apify-job.adapter';

describe('ApifyJobAdapter - Unit Test Suite', () => {
  const mockApifyService: any = {
    runUpworkScraper: async () => [],
  };

  const adapter = new ApifyJobAdapter(mockApifyService);

  it('should extract and normalize both city and country from Upwork raw buyer/client/nation payload', () => {
    const rawWithBuyerLocation = {
      upwork_job_id: '~01982734',
      title: 'Full Stack Engineer (NestJS / Angular)',
      job_detail: 'Need an engineer for long-term project in LatAm.',
      buyer: {
        location: {
          city: 'Bogota',
          country: 'Colombia',
        },
      },
    };

    const normalized1 = adapter.normalizeRaw(rawWithBuyerLocation);
    assert.strictEqual(normalized1.clientCountry, 'Bogota, Colombia');

    const rawWithNation = {
      id: '~01982735',
      title: 'AI Solutions Architect',
      description: 'Looking for architect.',
      nation: 'Mexico/Guadalajara',
    };

    const normalized2 = adapter.normalizeRaw(rawWithNation);
    assert.strictEqual(normalized2.clientCountry, 'Guadalajara, Mexico');
  });
});

