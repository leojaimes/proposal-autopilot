import { Injectable, Logger } from '@nestjs/common';

export interface GeocodedCityResult {
  city: string;
  state?: string;
  country: string;
  center: { lat: number; lng: number };
  boundingBox?: [number, number, number, number]; // [minLat, maxLat, minLng, maxLng]
  geojsonPolygon?: any; // GeoJSON geometry (Polygon / MultiPolygon)
  displayName: string;
}

// Fallback presets for key Mexican cities to ensure 100% reliability offline/dev
const FALLBACK_CITIES: Record<string, { lat: number; lng: number; state: string }> = {
  queretaro: { lat: 20.5888, lng: -100.3899, state: 'Querétaro' },
  'santiago de queretaro': { lat: 20.5888, lng: -100.3899, state: 'Querétaro' },
  'san juan del rio': { lat: 20.3889, lng: -99.9961, state: 'Querétaro' },
  corregidora: { lat: 20.5317, lng: -100.4439, state: 'Querétaro' },
  cdmx: { lat: 19.4326, lng: -99.1332, state: 'Ciudad de México' },
  'ciudad de mexico': { lat: 19.4326, lng: -99.1332, state: 'Ciudad de México' },
  guadalajara: { lat: 20.6597, lng: -103.3496, state: 'Jalisco' },
  zapopan: { lat: 20.7167, lng: -103.4000, state: 'Jalisco' },
  monterrey: { lat: 25.6866, lng: -100.3161, state: 'Nuevo León' },
  puebla: { lat: 19.0414, lng: -98.2063, state: 'Puebla' },
  merida: { lat: 20.9674, lng: -89.5926, state: 'Yucatán' },
  cancun: { lat: 21.1619, lng: -86.8515, state: 'Quintana Roo' },
};

@Injectable()
export class NominatimGeocodingService {
  private readonly logger = new Logger(NominatimGeocodingService.name);
  private readonly cache = new Map<string, { data: GeocodedCityResult; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  async geocodeCity(city: string, state?: string, country: string = 'Mexico'): Promise<GeocodedCityResult> {
    const normalizedKey = `${city.trim().toLowerCase()}_${(state || '').trim().toLowerCase()}_${country.toLowerCase()}`;
    
    // Check Cache
    const cached = this.cache.get(normalizedKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const query = [city, state, country].filter(Boolean).join(', ');
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&addressdetails=1&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'ProposalAutopilot-GeoRadar/1.0 (contact: info@spotlightstudio.org)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(6000),
      });

      if (response.ok) {
        const geojson = await response.json();
        if (geojson?.features && geojson.features.length > 0) {
          const feature = geojson.features[0];
          const coords = feature.geometry?.coordinates;
          const [lng, lat] = feature.properties?.lat && feature.properties?.lon
            ? [Number(feature.properties.lon), Number(feature.properties.lat)]
            : [feature.bbox?.[0] || 0, feature.bbox?.[1] || 0];

          const result: GeocodedCityResult = {
            city: city.trim(),
            state: state?.trim() || feature.properties?.address?.state,
            country: country.trim(),
            center: { lat: lat || Number(feature.properties?.lat), lng: lng || Number(feature.properties?.lon) },
            boundingBox: feature.bbox ? [feature.bbox[1], feature.bbox[3], feature.bbox[0], feature.bbox[2]] : undefined,
            geojsonPolygon: feature.geometry,
            displayName: feature.properties?.display_name || query,
          };

          this.cache.set(normalizedKey, { data: result, expiresAt: Date.now() + this.CACHE_TTL_MS });
          return result;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Nominatim geocoding failed for ${city}: ${err?.message || err}. Applying fallback.`);
    }

    // Reliable fallback
    const cityClean = city.trim().toLowerCase();
    const fallback = FALLBACK_CITIES[cityClean] || { lat: 20.5888, lng: -100.3899, state: state || 'Querétaro' };

    const fallbackResult: GeocodedCityResult = {
      city: city.trim(),
      state: state?.trim() || fallback.state,
      country,
      center: { lat: fallback.lat, lng: fallback.lng },
      displayName: `${city}, ${fallback.state}, ${country}`,
    };

    this.cache.set(normalizedKey, { data: fallbackResult, expiresAt: Date.now() + this.CACHE_TTL_MS });
    return fallbackResult;
  }
}

