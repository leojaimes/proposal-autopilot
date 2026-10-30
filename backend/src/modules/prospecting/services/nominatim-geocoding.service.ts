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

// Fallback presets for key Mexican & USA cities to ensure 100% reliability offline/dev
const FALLBACK_CITIES: Record<string, { lat: number; lng: number; state: string; country: string }> = {
  queretaro: { lat: 20.5888, lng: -100.3899, state: 'Querétaro', country: 'Mexico' },
  'santiago de queretaro': { lat: 20.5888, lng: -100.3899, state: 'Querétaro', country: 'Mexico' },
  'san juan del rio': { lat: 20.3889, lng: -99.9961, state: 'Querétaro', country: 'Mexico' },
  corregidora: { lat: 20.5317, lng: -100.4439, state: 'Querétaro', country: 'Mexico' },
  cdmx: { lat: 19.4326, lng: -99.1332, state: 'Ciudad de México', country: 'Mexico' },
  'ciudad de mexico': { lat: 19.4326, lng: -99.1332, state: 'Ciudad de México', country: 'Mexico' },
  guadalajara: { lat: 20.6597, lng: -103.3496, state: 'Jalisco', country: 'Mexico' },
  zapopan: { lat: 20.7167, lng: -103.4000, state: 'Jalisco', country: 'Mexico' },
  monterrey: { lat: 25.6866, lng: -100.3161, state: 'Nuevo León', country: 'Mexico' },
  puebla: { lat: 19.0414, lng: -98.2063, state: 'Puebla', country: 'Mexico' },
  merida: { lat: 20.9674, lng: -89.5926, state: 'Yucatán', country: 'Mexico' },
  cancun: { lat: 21.1619, lng: -86.8515, state: 'Quintana Roo', country: 'Mexico' },
  // Colombia
  bogota: { lat: 4.7110, lng: -74.0721, state: 'Bogotá D.C.', country: 'Colombia' },
  'bogota d.c.': { lat: 4.7110, lng: -74.0721, state: 'Bogotá D.C.', country: 'Colombia' },
  chia: { lat: 4.8633, lng: -74.0583, state: 'Cundinamarca', country: 'Colombia' },
  soacha: { lat: 4.5794, lng: -74.2169, state: 'Cundinamarca', country: 'Colombia' },
  medellin: { lat: 6.2442, lng: -75.5812, state: 'Antioquia', country: 'Colombia' },
  envigado: { lat: 6.1759, lng: -75.5917, state: 'Antioquia', country: 'Colombia' },
  itagui: { lat: 6.1846, lng: -75.5991, state: 'Antioquia', country: 'Colombia' },
  bello: { lat: 6.3373, lng: -75.5579, state: 'Antioquia', country: 'Colombia' },
  rionegro: { lat: 6.1552, lng: -75.3737, state: 'Antioquia', country: 'Colombia' },
  bucaramanga: { lat: 7.1193, lng: -73.1227, state: 'Santander', country: 'Colombia' },
  floridablanca: { lat: 7.0622, lng: -73.0864, state: 'Santander', country: 'Colombia' },
  giron: { lat: 7.0682, lng: -73.1698, state: 'Santander', country: 'Colombia' },
  piedecuesta: { lat: 6.9880, lng: -73.0498, state: 'Santander', country: 'Colombia' },
  cali: { lat: 3.4516, lng: -76.5320, state: 'Valle del Cauca', country: 'Colombia' },
  barranquilla: { lat: 10.9685, lng: -74.7813, state: 'Atlántico', country: 'Colombia' },
  // USA Cities & California / Bay Area
  austin: { lat: 30.2672, lng: -97.7431, state: 'Texas', country: 'United States' },
  houston: { lat: 29.7604, lng: -95.3698, state: 'Texas', country: 'United States' },
  dallas: { lat: 32.7767, lng: -96.7970, state: 'Texas', country: 'United States' },
  miami: { lat: 25.7617, lng: -80.1918, state: 'Florida', country: 'United States' },
  orlando: { lat: 28.5383, lng: -81.3792, state: 'Florida', country: 'United States' },
  'los angeles': { lat: 34.0522, lng: -118.2437, state: 'California', country: 'United States' },
  'san francisco': { lat: 37.7749, lng: -122.4194, state: 'California', country: 'United States' },
  'san jose': { lat: 37.3382, lng: -121.8863, state: 'California', country: 'United States' },
  'palo alto': { lat: 37.4419, lng: -122.1430, state: 'California', country: 'United States' },
  'mountain view': { lat: 37.3861, lng: -122.0839, state: 'California', country: 'United States' },
  'sunnyvale': { lat: 37.3688, lng: -122.0363, state: 'California', country: 'United States' },
  'santa clara': { lat: 37.3541, lng: -121.9552, state: 'California', country: 'United States' },
  'oakland': { lat: 37.8044, lng: -122.2712, state: 'California', country: 'United States' },
  'berkeley': { lat: 37.8715, lng: -122.2730, state: 'California', country: 'United States' },
  'san mateo': { lat: 37.5630, lng: -122.3255, state: 'California', country: 'United States' },
  'redwood city': { lat: 37.4852, lng: -122.2364, state: 'California', country: 'United States' },
  'san diego': { lat: 32.7157, lng: -117.1611, state: 'California', country: 'United States' },
  'irvine': { lat: 33.6846, lng: -117.8265, state: 'California', country: 'United States' },
  'new york': { lat: 40.7128, lng: -74.0060, state: 'New York', country: 'United States' },
  chicago: { lat: 41.8781, lng: -87.6298, state: 'Illinois', country: 'United States' },
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

