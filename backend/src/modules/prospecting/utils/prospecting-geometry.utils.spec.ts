import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import {
  isPointInsidePolygon,
  calculatePolygonBoundingBox,
  calculatePolygonAreaKm2,
  normalizePolygonCoordinates,
} from './prospecting-geometry.utils';

describe('Prospecting Geometry Utils - Unit Tests', () => {
  // Simple square polygon around Querétaro Downtown [20.58 to 20.60 lat, -100.40 to -100.38 lng]
  const samplePolygon: [number, number][] = [
    [20.5800, -100.4000],
    [20.6000, -100.4000],
    [20.6000, -100.3800],
    [20.5800, -100.3800],
  ];

  it('should correctly detect point inside polygon', () => {
    const insidePoint: [number, number] = [20.5900, -100.3900];
    const isInside = isPointInsidePolygon(insidePoint, samplePolygon);
    assert.strictEqual(isInside, true);
  });

  it('should correctly detect point outside polygon', () => {
    const outsidePoint: [number, number] = [20.6500, -100.3500];
    const isInside = isPointInsidePolygon(outsidePoint, samplePolygon);
    assert.strictEqual(isInside, false);
  });

  it('should calculate accurate bounding box and centroid', () => {
    const bbox = calculatePolygonBoundingBox(samplePolygon);
    assert.strictEqual(bbox.minLat, 20.5800);
    assert.strictEqual(bbox.maxLat, 20.6000);
    assert.strictEqual(bbox.minLng, -100.4000);
    assert.strictEqual(bbox.maxLng, -100.3800);
    assert.strictEqual(bbox.centroid.lat, 20.5900);
    assert.strictEqual(bbox.centroid.lng, -100.3900);
  });

  it('should calculate positive non-zero area in km2', () => {
    const area = calculatePolygonAreaKm2(samplePolygon);
    assert.ok(area > 0, `Expected area > 0, got ${area}`);
    // ~2km x ~2km square is ~4.5 km2
    assert.ok(area > 2 && area < 8, `Expected area roughly 4.5km2, got ${area}`);
  });

  it('should normalize coordinates from array and object formats', () => {
    const rawMixed = [
      [20.58, -100.40],
      { lat: 20.60, lng: -100.40 },
      'invalid-entry',
      [999, 999], // out of bounds
    ];
    const normalized = normalizePolygonCoordinates(rawMixed);
    assert.strictEqual(normalized.length, 2);
    assert.deepStrictEqual(normalized[0], [20.58, -100.40]);
    assert.deepStrictEqual(normalized[1], [20.60, -100.40]);
  });
});

