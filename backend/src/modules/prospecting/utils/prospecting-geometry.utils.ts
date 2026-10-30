/**
 * Prospecting Geometry Utilities
 * Algoritmos espaciales puros para validación, delimitación y cálculo de polígonos B2B
 */

export interface PolygonBoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centroid: { lat: number; lng: number };
}

/**
 * Determina si un punto [lat, lng] está estrictamente contenido dentro de un polígono
 * utilizando el algoritmo de Ray-Casting (Paridad de intersecciones).
 */
export function isPointInsidePolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  const [x, y] = point; // lat, lng
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calcula el bounding box rectangular y el centroide de un polígono.
 */
export function calculatePolygonBoundingBox(polygon: [number, number][]): PolygonBoundingBox {
  if (!polygon || polygon.length === 0) {
    return {
      minLat: 0,
      maxLat: 0,
      minLng: 0,
      maxLng: 0,
      centroid: { lat: 0, lng: 0 },
    };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  let sumLat = 0;
  let sumLng = 0;

  for (const [lat, lng] of polygon) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    sumLat += lat;
    sumLng += lng;
  }

  return {
    minLat,
    maxLat,
    minLng,
    maxLng,
    centroid: {
      lat: Number((sumLat / polygon.length).toFixed(6)),
      lng: Number((sumLng / polygon.length).toFixed(6)),
    },
  };
}

/**
 * Calcula el área esférica aproximada de un polígono en km² mediante la fórmula Shoelace geodésica.
 */
export function calculatePolygonAreaKm2(polygon: [number, number][]): number {
  if (!polygon || polygon.length < 3) return 0;
  const R = 6378.137; // Radio medio de la Tierra en km
  let total = 0;

  for (let i = 0; i < polygon.length; i++) {
    const j = (i + 1) % polygon.length;
    const p1 = polygon[i];
    const p2 = polygon[j];

    const lat1 = (p1[0] * Math.PI) / 180;
    const lat2 = (p2[0] * Math.PI) / 180;
    const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;

    total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }

  const area = Math.abs((total * R * R) / 2);
  return Number(area.toFixed(2));
}

/**
 * Valida y normaliza una lista arbitraria de coordenadas de polígono.
 */
export function normalizePolygonCoordinates(rawCoords: any[]): [number, number][] {
  if (!Array.isArray(rawCoords)) return [];

  const points: [number, number][] = [];
  for (const item of rawCoords) {
    if (Array.isArray(item) && item.length >= 2) {
      const lat = Number(item[0]);
      const lng = Number(item[1]);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        points.push([lat, lng]);
      }
    } else if (item && typeof item === 'object' && 'lat' in item && 'lng' in item) {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        points.push([lat, lng]);
      }
    }
  }

  return points;
}

