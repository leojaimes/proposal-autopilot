import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type CompanyPainCategory =
  | 'NO_WEBSITE'
  | 'OUTDATED_OR_SLOW_WEB'
  | 'NO_ONLINE_BOOKING'
  | 'UNRESPONSIVE_CUSTOMER_SERVICE'
  | 'MANUAL_INVENTORY_OR_CATALOG'
  | 'LACK_OF_ECOMMERCE'
  | 'GENERAL_REPUTATION_ISSUE';

export type ProspectedLeadStatus = 'DISCOVERED' | 'AUDITED' | 'CONTACTED' | 'DISQUALIFIED';

export interface ProspectedBusiness {
  id: string;
  tenantId: string;
  placeId: string;
  name: string;
  category: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  websiteUrl?: string;
  phone?: string;
  rating: number;
  reviewsCount: number;
  status: ProspectedLeadStatus;
  primaryPain?: CompanyPainCategory;
  painConfidence?: number;
  painAnalysis?: {
    summary?: string;
    details?: {
      hasWebsite: boolean;
      negativeReviewsFound: number;
      flaggedKeywords: string[];
      sentimentScore: string;
    };
    sampleReviews?: string[];
  };
  suggestedOffer?: string;
  salesPitchDraft?: string;
  scannedAt: string;
}

export interface GeocodeCityResponse {
  city: string;
  state?: string;
  country: string;
  center: { lat: number; lng: number };
  boundingBox?: [number, number, number, number];
  geojsonPolygon?: any;
  displayName: string;
}

export interface ScanAreaResponse {
  message: string;
  scannedSector: string;
  center: { lat: number; lng: number };
  radiusKm: number;
  city: string;
  polygon?: [number, number][];
  polygonAreaKm2?: number;
  polygonVertices?: number;
  leads: ProspectedBusiness[];
}

@Injectable({
  providedIn: 'root',
})
export class ProspectingService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/prospecting';

  // Reactive state
  readonly leads = signal<ProspectedBusiness[]>([]);
  readonly isScanning = signal<boolean>(false);
  readonly selectedLead = signal<ProspectedBusiness | null>(null);

  geocodeCity(city: string, state?: string, country: string = 'Mexico'): Observable<GeocodeCityResponse> {
    return this.http.post<GeocodeCityResponse>(`${this.baseUrl}/geocode-city`, { city, state, country });
  }

  scanArea(payload: {
    sector: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    city?: string;
    state?: string;
    country?: string;
    polygon?: [number, number][];
  }): Observable<ScanAreaResponse> {
    this.isScanning.set(true);
    return this.http.post<ScanAreaResponse>(`${this.baseUrl}/scan-area`, payload).pipe(
      tap((res) => {
        this.isScanning.set(false);
        if (res?.leads) {
          this.leads.set(res.leads);
        }
      }),
    );
  }

  fetchLeads(city?: string, pain?: CompanyPainCategory): Observable<ProspectedBusiness[]> {
    let params: Record<string, string> = {};
    if (city) params['city'] = city;
    if (pain) params['pain'] = pain;

    return this.http.get<ProspectedBusiness[]>(`${this.baseUrl}/leads`, { params }).pipe(
      tap((leads) => {
        this.leads.set(leads);
      }),
    );
  }

  updateStatus(id: string, status: ProspectedLeadStatus): Observable<any> {
    return this.http.patch(`${this.baseUrl}/leads/${id}/status`, { status }).pipe(
      tap(() => {
        this.leads.update((current) =>
          current.map((lead) => (lead.id === id ? { ...lead, status } : lead)),
        );
        if (this.selectedLead()?.id === id) {
          this.selectedLead.update((l) => (l ? { ...l, status } : null));
        }
      }),
    );
  }
}

