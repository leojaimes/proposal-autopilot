import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { NominatimGeocodingService } from './nominatim-geocoding.service';

describe('NominatimGeocodingService - Unit Test Suite', () => {
  const service = new NominatimGeocodingService();

  it('should return geocoded coordinates for Querétaro (with cache/fallback)', async () => {
    const result = await service.geocodeCity('Querétaro', 'Querétaro', 'Mexico');
    assert.ok(result);
    assert.strictEqual(result.city, 'Querétaro');
    assert.ok(result.center.lat > 20.0 && result.center.lat < 21.5);
    assert.ok(result.center.lng < -99.0 && result.center.lng > -101.5);
  });

  it('should use in-memory cache for consecutive queries of the same city', async () => {
    const start = Date.now();
    const result1 = await service.geocodeCity('San Juan del Río', 'Querétaro');
    const result2 = await service.geocodeCity('San Juan del Río', 'Querétaro');
    const duration = Date.now() - start;
    
    assert.deepStrictEqual(result1.center, result2.center);
    assert.ok(duration < 100, 'Second call should resolve near instantaneously via cache');
  });

  it('should gracefully fallback to default coordinates if city is unknown and API times out', async () => {
    const result = await service.geocodeCity('Ciudad Inexistente XYZ 123');
    assert.ok(result);
    assert.ok(result.center.lat !== 0);
  });
});
