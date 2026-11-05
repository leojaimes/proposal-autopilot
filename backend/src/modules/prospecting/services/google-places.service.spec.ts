import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { GooglePlacesOfficialService } from './google-places.service';

describe('GooglePlacesOfficialService (node:test)', () => {
  it('should report isConfigured true when API key is set', () => {
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;
    process.env.GOOGLE_PLACES_API_KEY = 'AIzaSyFakeTestKey1234567890';

    const service = new GooglePlacesOfficialService();
    assert.equal(service.isConfigured, true);

    process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });

  it('should report isConfigured false when API key is missing', () => {
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;

    const service = new GooglePlacesOfficialService();
    assert.equal(service.isConfigured, false);

    process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });

  it('should return empty array when not configured without throwing', async () => {
    const originalKey = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;

    const service = new GooglePlacesOfficialService();
    const results = await service.searchBusinesses({ query: 'dentistas' });
    assert.deepEqual(results, []);

    process.env.GOOGLE_PLACES_API_KEY = originalKey;
  });
});

