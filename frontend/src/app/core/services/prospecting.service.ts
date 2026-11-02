import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export type CompanyPainCategory =
  | 'WEBSITE_DOWN_OR_EXPIRED'
  | 'NO_WEBSITE'
  | 'OUTDATED_OR_SLOW_WEB'
  | 'NO_ONLINE_BOOKING'
  | 'UNRESPONSIVE_CUSTOMER_SERVICE'
  | 'MANUAL_INVENTORY_OR_CATALOG'
  | 'LACK_OF_ECOMMERCE'
  | 'GENERAL_REPUTATION_ISSUE';

export type ProspectedLeadStatus = 'DISCOVERED' | 'AUDITED' | 'CONTACTED' | 'DISQUALIFIED';

export type BusinessOwnershipType =
  | 'INDEPENDENT'
  | 'CHAIN_BRANCH'
  | 'CORPORATE_HQ'
  | 'UNKNOWN';

export type BusinessOperationalStatus =
  | 'OPERATIONAL'
  | 'CLOSED_TEMPORARILY'
  | 'CLOSED_PERMANENTLY'
  | 'STALE_OR_INACTIVE';

export type PhoneLineType = 'MOBILE' | 'LANDLINE' | 'TOLL_FREE' | 'VOIP' | 'UNKNOWN';

export type BusinessPainLifecycleStatus =
  | 'DETECTED'
  | 'VERIFIED'
  | 'PITCHED'
  | 'FALSE_POSITIVE'
  | 'DISMISSED'
  | 'RESOLVED_BY_US'
  | 'RESOLVED_EXTERNALLY';

export type ContactChannel =
  | 'WHATSAPP'
  | 'PHONE_CALL'
  | 'EMAIL'
  | 'LINKEDIN'
  | 'IN_PERSON';

export type RecipientRole =
  | 'BUSINESS_OWNER'
  | 'GATEKEEPER_RECEPTION'
  | 'CORPORATE_DECISION_MAKER'
  | 'UNKNOWN';

export type ContactOutcome =
  | 'CONNECTED_PITCHED'
  | 'GATEKEEPER_BLOCKED'
  | 'NO_ANSWER'
  | 'VOICEMAIL'
  | 'EMAIL_SENT'
  | 'NOT_INTERESTED'
  | 'MEETING_SCHEDULED'
  | 'CLOSED_WON'
  | 'OPT_OUT_BLACKLIST';

export type PitchToneKey = 'OWNER' | 'GATEKEEPER' | 'ENTERPRISE';

export interface HighTicketServiceItem {
  category: string;
  summary: string;
  keywordsFound: string[];
}

export interface GoogleKnowledgePanelSummary {
  title?: string;
  subtitle?: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviewsCount?: number;
  hours?: string;
  officialWebsiteUrl?: string;
}

export interface DeepIntelligenceResult {
  businessId: string;
  enrichedAt: string;
  knowledgePanel?: GoogleKnowledgePanelSummary;
  servicesCatalog?: HighTicketServiceItem[];
  foundChannels: {
    whatsappUrl?: string;
    phone?: string;
    phoneType?: PhoneLineType;
    email?: string;
    facebookUrl?: string;
    instagramUrl?: string;
    linkedinUrl?: string;
    websiteUrl?: string;
  };
  decisionMakers: Array<{
    name: string;
    role?: string;
    sourceUrl?: string;
  }>;
  digitalFootprint: {
    organicSnippet?: string;
    verifiedPlatforms: string[];
    hasDigitalPresence: boolean;
  };
  suggestedAngle: string;
}

export interface PainCatalogItem {
  id: string;
  code: string;
  categoryEnum?: CompanyPainCategory | null;
  name: string;
  description?: string | null;
  suggestedOffer: string;
  baseTicketUsd: number;
  monthlyRetainerUsd?: number | null;
  priorityWeight: number;
  pitchTemplateOwner: string;
  pitchTemplateGatekeeper: string;
  pitchTemplateEnterprise: string;
  isActive: boolean;
}

export interface CorporateBrandSummary {
  id: string;
  slug: string;
  name: string;
  rootDomain?: string | null;
  headquartersCity?: string | null;
  totalBranchesTracked: number;
}

export interface ProspectedBusinessPainItem {
  id: string;
  businessId: string;
  painCatalogId: string;
  status: BusinessPainLifecycleStatus;
  isPrimary: boolean;
  confidence: number;
  adjustedTicketUsd?: number | null;
  evidence?: {
    matchedKeywords?: string[];
    websiteHttpStatus?: number | null;
    summary?: string;
  } | null;
  customPitchOwner?: string | null;
  customPitchGatekeeper?: string | null;
  customPitchEnterprise?: string | null;
  dismissReason?: string | null;
  verifiedBy?: string | null;
  detectedAt: string;
  painCatalog: {
    id: string;
    code: string;
    categoryEnum?: CompanyPainCategory | null;
    name: string;
    suggestedOffer: string;
    baseTicketUsd: number;
    monthlyRetainerUsd?: number | null;
  };
}

export interface ProspectedBusinessContactItem {
  id: string;
  businessId: string;
  fullName: string;
  honorific?: string | null;
  titleRole?: string | null;
  email?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
  isPrimary: boolean;
  confidence: number;
  sourceUrl?: string | null;
  sourceProvenance: string;
  isManuallyVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectedBusinessSocialItem {
  id: string;
  businessId: string;
  platform: string;
  url: string;
  username?: string | null;
  isVerified: boolean;
  sourceProvenance: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProspectContactLogItem {
  id: string;
  businessId: string;
  channel: ContactChannel;
  recipientRole: RecipientRole;
  outcome: ContactOutcome;
  pitchToneUsed?: string | null;
  notes?: string | null;
  contactedBy?: string | null;
  contactedAt: string;
  nextFollowupDate?: string | null;
  painCatalog?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface ProspectedBusiness {
  id: string;
  tenantId: string;
  placeId: string;
  name: string;
  branchIdentifier?: string | null;
  rootDomain?: string | null;
  ownershipType?: BusinessOwnershipType;
  operationalStatus?: BusinessOperationalStatus;
  corporateBrandId?: string | null;
  corporateBrand?: CorporateBrandSummary | null;
  category: string;
  address: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  websiteUrl?: string | null;
  websiteHttpStatus?: number | null;
  enrichmentStatus?: string | null;
  phone?: string | null;
  phoneE164?: string | null;
  phoneType?: PhoneLineType;
  email?: string | null;
  emailType?: string | null;
  emailDeliverability?: 'UNVERIFIED' | 'VERIFIED' | 'CATCH_ALL' | 'INVALID_BOUNCE';
  rating: number;
  reviewsCount: number;
  priceLevel?: number | null;
  estimatedTicketUsd?: number | null;
  status: ProspectedLeadStatus;
  primaryPain?: CompanyPainCategory | null;
  painConfidence?: number | null;
  painAnalysis?: {
    summary?: string;
    whatsappDigits?: string | null;
    details?: {
      hasWebsite: boolean;
      negativeReviewsFound: number;
      flaggedKeywords: string[];
      sentimentScore: string;
    };
    sampleReviews?: string[];
  };
  suggestedOffer?: string | null;
  salesPitchDraft?: string | null;
  lastContactedAt?: string | null;
  contactCooldownUntil?: string | null;
  contactAttemptsCount?: number;
  doNotContact?: boolean;
  blacklistReason?: string | null;
  rawGoogleData?: {
    types?: string[];
    userRatingsTotal?: number;
    vicinity?: string;
    deepIntelligence?: DeepIntelligenceResult;
  } | null;
  detectedPains?: ProspectedBusinessPainItem[];
  contacts?: ProspectedBusinessContactItem[];
  socialProfiles?: ProspectedBusinessSocialItem[];
  scannedAt: string;
}

export interface GeocodeCityResponse {
  city: string;
  state?: string;
  country: string;
  center: { lat: number; lng: number };
  boundingBox?: [number, number, number, number];
  geojsonPolygon?: unknown;
  displayName: string;
}

export interface GeoPresetDto {
  id: string;
  slug: string;
  countryCode: string;
  countryName: string;
  flag: string;
  state: string;
  stateCode?: string;
  city: string;
  latitude: number;
  longitude: number;
  zoom: number;
  isTactical: boolean;
  category?: string;
  polygonCoordinates?: [number, number][];
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

export interface LeadQueryFilters {
  city?: string;
  country?: string;
  pain?: CompanyPainCategory;
  painCode?: string;
  phoneType?: PhoneLineType;
  ownershipType?: BusinessOwnershipType;
  status?: ProspectedLeadStatus;
  excludeChains?: boolean;
  excludeCooldown?: boolean;
  includeBlacklisted?: boolean;
  limit?: number;
}

export interface CreateContactLogPayload {
  channel: ContactChannel;
  recipientRole?: RecipientRole;
  painCode?: string;
  pitchToneUsed?: string;
  outcome: ContactOutcome;
  notes?: string;
  nextFollowupDate?: string;
  emailSubject?: string;
  forceOverrideCooldown?: boolean;
}

export interface FunnelAnalyticsOverview {
  totalBusinesses: number;
  independentCount: number;
  chainCount: number;
  contactedCount: number;
  blacklistedCount: number;
  activeCooldownCount: number;
}

export interface FunnelAnalyticsResponse {
  overview: FunnelAnalyticsOverview;
  byPain: Array<{
    code: string;
    name: string;
    detected: number;
    verified: number;
    pitched: number;
    falsePositives: number;
    resolvedByUs: number;
  }>;
  byChannel: Array<{
    channel: string;
    attempts: number;
    connected: number;
    meetingsScheduled: number;
    closedWon: number;
    positiveRatePct: number;
  }>;
}

export interface StreamProgressState {
  isActive: boolean;
  scanId?: string;
  stepMessage: string;
  progressPct: number;
  discoveredCount: number;
  totalPipelineUsd: number;
  fromCache?: boolean;
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
  readonly isLoadingLeads = signal<boolean>(false);
  readonly selectedLead = signal<ProspectedBusiness | null>(null);
  readonly geoPresets = signal<GeoPresetDto[]>([]);
  readonly painCatalog = signal<PainCatalogItem[]>([]);
  readonly selectedLeadPains = signal<ProspectedBusinessPainItem[]>([]);
  readonly selectedLeadContacts = signal<ProspectContactLogItem[]>([]);
  readonly funnelAnalytics = signal<FunnelAnalyticsResponse | null>(null);
  readonly streamState = signal<StreamProgressState>({
    isActive: false,
    stepMessage: '',
    progressPct: 0,
    discoveredCount: 0,
    totalPipelineUsd: 0,
  });

  private activeEventSource: EventSource | null = null;

  geocodeCity(city: string, state?: string, country: string = 'Mexico'): Observable<GeocodeCityResponse> {
    return this.http.post<GeocodeCityResponse>(`${this.baseUrl}/geocode-city`, { city, state, country });
  }

  getGeoPresets(countryCode?: string): Observable<GeoPresetDto[]> {
    const params: Record<string, string> = {};
    if (countryCode) params['country'] = countryCode;
    return this.http.get<GeoPresetDto[]>(`${this.baseUrl}/geo-presets`, { params }).pipe(
      tap((presets) => {
        if (!countryCode) {
          this.geoPresets.set(presets);
        }
      }),
    );
  }

  getPainCatalog(): Observable<PainCatalogItem[]> {
    return this.http.get<PainCatalogItem[]>(`${this.baseUrl}/pains`).pipe(
      tap((items) => this.painCatalog.set(items)),
    );
  }

  scanArea(payload: {
    sector: string;
    center: { lat: number; lng: number };
    radiusKm: number;
    city?: string;
    state?: string;
    country?: string;
    polygon?: [number, number][];
    scanId?: string;
    forceRefresh?: boolean;
  }): Observable<ScanAreaResponse> {
    const scanId = payload.scanId || `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.isScanning.set(true);
    this.startStreamingListener(scanId);

    return this.http
      .post<ScanAreaResponse>(`${this.baseUrl}/scan-area`, { ...payload, scanId })
      .pipe(
        tap({
          next: (res) => {
            this.isScanning.set(false);
            if (res?.leads && res.leads.length > 0) {
              this.leads.set(res.leads);
            }
          },
          error: (err) => {
            this.isScanning.set(false);
            this.closeStreamingListener();
            this.streamState.update((s) => ({
              ...s,
              isActive: false,
              stepMessage: 'Error al escanear el área. Intenta nuevamente.',
            }));
          },
        }),
      );
  }

  startStreamingListener(scanId: string) {
    this.closeStreamingListener();

    this.streamState.set({
      isActive: true,
      scanId,
      stepMessage: '🛰️ Iniciando radar y canal en vivo...',
      progressPct: 5,
      discoveredCount: 0,
      totalPipelineUsd: 0,
    });

    try {
      const eventSource = new EventSource(`${this.baseUrl}/scan-stream/${scanId}`);
      this.activeEventSource = eventSource;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (!data || !data.type) return;

          if (data.type === 'CACHE_BURST') {
            const burstLeads = data.leads || [];
            this.leads.set(burstLeads);
            const totalPipeline = burstLeads.reduce(
              (sum: number, l: any) => sum + (l.estimatedTicketUsd || 450),
              0,
            );
            this.streamState.set({
              isActive: false,
              scanId,
              stepMessage: data.message,
              progressPct: 100,
              discoveredCount: burstLeads.length,
              totalPipelineUsd: totalPipeline,
              fromCache: true,
            });
            this.closeStreamingListener();
          } else if (data.type === 'RADAR_HEARTBEAT') {
            this.streamState.update((s) => ({
              ...s,
              stepMessage: data.message,
              progressPct: data.progressPct || s.progressPct,
            }));
          } else if (data.type === 'LEAD_ARRIVED' && data.lead) {
            const newLead = data.lead;
            this.leads.update((existing) => {
              const withoutNew = existing.filter((l) => l.id !== newLead.id);
              return [newLead, ...withoutNew];
            });
            this.streamState.update((s) => ({
              ...s,
              stepMessage: data.message,
              progressPct: data.progressPct || s.progressPct,
              discoveredCount: data.leadIndex || s.discoveredCount + 1,
              totalPipelineUsd: s.totalPipelineUsd + (newLead.estimatedTicketUsd || 450),
            }));
          } else if (data.type === 'SCAN_FINISHED') {
            if (data.leads && data.leads.length > 0) {
              this.leads.set(data.leads);
            }
            this.streamState.update((s) => ({
              ...s,
              isActive: false,
              stepMessage: data.message,
              progressPct: 100,
              discoveredCount: data.totalLeads || s.discoveredCount,
              totalPipelineUsd: data.pipelineUsd || s.totalPipelineUsd,
            }));
            this.closeStreamingListener();
          } else if (data.type === 'SCAN_ERROR') {
            this.streamState.update((s) => ({
              ...s,
              isActive: false,
              stepMessage: `⚠️ ${data.message}`,
            }));
            this.closeStreamingListener();
          }
        } catch {
          // ignore parsing error
        }
      };

      eventSource.onerror = () => {
        this.closeStreamingListener();
        this.streamState.update((s) => ({
          ...s,
          isActive: false,
        }));
      };
    } catch {
      this.closeStreamingListener();
    }
  }

  closeStreamingListener() {
    if (this.activeEventSource) {
      this.activeEventSource.close();
      this.activeEventSource = null;
    }
  }

  fetchLeads(filters: LeadQueryFilters = {}): Observable<ProspectedBusiness[]> {
    const params: Record<string, string> = {};
    if (filters.city) params['city'] = filters.city;
    if (filters.country) params['country'] = filters.country;
    if (filters.pain) params['pain'] = filters.pain;
    if (filters.painCode) params['painCode'] = filters.painCode;
    if (filters.phoneType) params['phoneType'] = filters.phoneType;
    if (filters.ownershipType) params['ownershipType'] = filters.ownershipType;
    if (filters.status) params['status'] = filters.status;
    if (filters.excludeChains !== undefined) params['excludeChains'] = String(filters.excludeChains);
    if (filters.excludeCooldown !== undefined) params['excludeCooldown'] = String(filters.excludeCooldown);
    if (filters.includeBlacklisted !== undefined) {
      params['includeBlacklisted'] = String(filters.includeBlacklisted);
    }
    if (filters.limit) params['limit'] = String(filters.limit);

    this.isLoadingLeads.set(true);
    return this.http.get<ProspectedBusiness[]>(`${this.baseUrl}/leads`, { params }).pipe(
      tap({
        next: (leads) => {
          this.isLoadingLeads.set(false);
          this.leads.set(leads);
          const currentSelected = this.selectedLead();
          if (currentSelected) {
            const refreshed = leads.find((l) => l.id === currentSelected.id) || null;
            this.selectedLead.set(refreshed);
          }
        },
        error: () => {
          this.isLoadingLeads.set(false);
        },
      }),
    );
  }

  updateStatus(id: string, status: ProspectedLeadStatus): Observable<unknown> {
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

  getLeadPains(businessId: string): Observable<{
    business: { id: string; name: string; ownershipType: BusinessOwnershipType; priceLevel?: number | null };
    pains: ProspectedBusinessPainItem[];
  }> {
    return this.http
      .get<{
        business: { id: string; name: string; ownershipType: BusinessOwnershipType; priceLevel?: number | null };
        pains: ProspectedBusinessPainItem[];
      }>(`${this.baseUrl}/leads/${businessId}/pains`)
      .pipe(tap((res) => this.selectedLeadPains.set(res.pains || [])));
  }

  updateLeadPainStatus(
    businessId: string,
    painIdOrCode: string,
    payload: { status: BusinessPainLifecycleStatus; dismissReason?: string },
  ): Observable<{ updatedPain: ProspectedBusinessPainItem; activePainsRemaining: number }> {
    return this.http.patch<{ updatedPain: ProspectedBusinessPainItem; activePainsRemaining: number }>(
      `${this.baseUrl}/leads/${businessId}/pains/${encodeURIComponent(painIdOrCode)}/status`,
      payload,
    );
  }

  getLeadContacts(businessId: string): Observable<{
    business: Partial<ProspectedBusiness>;
    contacts: ProspectContactLogItem[];
  }> {
    return this.http
      .get<{ business: Partial<ProspectedBusiness>; contacts: ProspectContactLogItem[] }>(
        `${this.baseUrl}/leads/${businessId}/contacts`,
      )
      .pipe(tap((res) => this.selectedLeadContacts.set(res.contacts || [])));
  }

  recordContact(
    businessId: string,
    payload: CreateContactLogPayload,
  ): Observable<{
    contactLog: ProspectContactLogItem;
    cooldownUntil: string | null;
    status: ProspectedLeadStatus;
  }> {
    return this.http.post<{
      contactLog: ProspectContactLogItem;
      cooldownUntil: string | null;
      status: ProspectedLeadStatus;
    }>(`${this.baseUrl}/leads/${businessId}/contacts`, payload);
  }

  blacklistLead(businessId: string, reason: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/leads/${businessId}/blacklist`, { reason }).pipe(
      tap(() => {
        this.leads.update((current) => current.filter((l) => l.id !== businessId));
        if (this.selectedLead()?.id === businessId) {
          this.selectedLead.set(null);
        }
      }),
    );
  }

  getFunnelAnalytics(): Observable<FunnelAnalyticsResponse> {
    return this.http
      .get<FunnelAnalyticsResponse>(`${this.baseUrl}/analytics/funnel`)
      .pipe(tap((res) => this.funnelAnalytics.set(res)));
  }

  enrichLeadDeeply(businessId: string, force = false): Observable<DeepIntelligenceResult> {
    const params = force ? '?force=true' : '';
    return this.http
      .post<DeepIntelligenceResult>(`${this.baseUrl}/leads/${businessId}/enrich-deep${params}`, {})
      .pipe(
        tap((intelligence) => {
          this.leads.update((current) =>
            current.map((l) => {
              if (l.id !== businessId) return l;
              const ch = intelligence.foundChannels;
              return {
                ...l,
                phone: ch.phone || l.phone,
                phoneType: ch.phoneType || l.phoneType,
                email: ch.email || l.email,
                websiteUrl: ch.websiteUrl || l.websiteUrl,
                rawGoogleData: {
                  ...(l.rawGoogleData || {}),
                  deepIntelligence: intelligence,
                },
              };
            }),
          );
          if (this.selectedLead()?.id === businessId) {
            const currentSelected = this.selectedLead()!;
            const ch = intelligence.foundChannels;
            this.selectedLead.set({
              ...currentSelected,
              phone: ch.phone || currentSelected.phone,
              phoneType: ch.phoneType || currentSelected.phoneType,
              email: ch.email || currentSelected.email,
              websiteUrl: ch.websiteUrl || currentSelected.websiteUrl,
              rawGoogleData: {
                ...(currentSelected.rawGoogleData || {}),
                deepIntelligence: intelligence,
              },
            });
          }
        }),
      );
  }
}
