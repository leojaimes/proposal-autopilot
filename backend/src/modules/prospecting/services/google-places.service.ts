import { Injectable, Logger } from '@nestjs/common';

export interface GooglePlacesSearchOptions {
  query: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  city?: string;
  state?: string;
  country?: string;
  limit?: number;
}

export interface GooglePlacesRawCandidate {
  placeId: string;
  name: string;
  category?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  websiteUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  rating?: number;
  reviewsCount?: number;
  priceLevel?: number;
  businessStatus?: string;
  rawGoogleData?: unknown;
}

@Injectable()
export class GooglePlacesOfficialService {
  private readonly logger = new Logger(GooglePlacesOfficialService.name);
  private readonly apiKey: string | undefined;

  constructor() {
    this.apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!this.apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY no est\u00e1 configurado en .env. El fallback de Places API estar\u00e1 deshabilitado.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 10);
  }

  /**
   * Busca negocios reales utilizando la Google Places API (New) oficial.
   */
  async searchBusinesses(options: GooglePlacesSearchOptions): Promise<GooglePlacesRawCandidate[]> {
    if (!this.isConfigured) {
      this.logger.warn('Intento de b\u00fasqueda con Google Places API pero la clave no est\u00e1 configurada.');
      return [];
    }

    const {
      query,
      center,
      radiusKm = 5,
      city = '',
      state = '',
      country = 'Mexico',
      limit = 20,
    } = options;

    const locationText = [city, state, country].filter(Boolean).join(', ');
    const textQuery = locationText ? `${query} en ${locationText}` : query;

    this.logger.log(`[GooglePlacesOfficialService] Consultando Places API (New) para "${textQuery}" (Max: ${limit})`);

    const requestBody: Record<string, any> = {
      textQuery,
      pageSize: Math.min(Math.max(limit, 1), 20),
    };

    if (center?.lat && center?.lng) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: center.lat,
            longitude: center.lng,
          },
          radius: Math.min(radiusKm * 1000, 50000), // Max 50km
        },
      };
    }

    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.apiKey!,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.types',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Error de Places API HTTP ${response.status}: ${errorText}`);
        return [];
      }

      const data = await response.json();
      const places: any[] = Array.isArray(data.places) ? data.places : [];

      this.logger.log(`[GooglePlacesOfficialService] Se encontraron ${places.length} lugares v\u00eda Places API (New).`);

      return places.map((place) => ({
        placeId: place.id,
        name: place.displayName?.text || 'Negocio sin nombre',
        category: place.types?.[0] || query,
        address: place.formattedAddress,
        city,
        state,
        country,
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
        websiteUrl: place.websiteUri || null,
        phone: place.nationalPhoneNumber || null,
        email: null,
        rating: typeof place.rating === 'number' ? place.rating : 0,
        reviewsCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : 0,
        businessStatus: place.businessStatus || 'OPERATIONAL',
        rawGoogleData: place,
      }));
    } catch (err: any) {
      this.logger.error(`Error en petici\u00f3n a Places API: ${err.message}`, err.stack);
      return [];
    }
  }
}

