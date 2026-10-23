import { Injectable, signal, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PipelineStep, ProofStory } from '../models/pipeline.model';

export type MarketCategoryLane = 'CORE' | 'ADJACENT' | 'EXCLUDED';

export interface MarketTaxonomyNode {
  id: string;
  slug: string;
  name: string;
  kind: 'SUBCATEGORY' | 'OCCUPATION';
  parentId: string | null;
}

export interface ProfileCategoryPolicy {
  taxonomyNodeId: string;
  lane: MarketCategoryLane;
  includeTerms?: string[];
  excludeTerms?: string[];
  priority?: number;
  taxonomyNode?: MarketTaxonomyNode;
}

export interface CalibrationProfile {
  id: string;
  name: string;
  roleTitle: string;
  offerText: string;
  targetAudience: string;
  keywords: string;
  minHourlyRate: number;
  minBudgetFixed: number;
  verifiedPaymentOnly: boolean;
  weightSkill: number;
  weightAi: number;
  weightClient: number;
  weightRecency: number;
  targetCountries?: string[];
  targetRegions?: string[];
  excludedCountries?: string[];
  geoFilterMode?: 'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE';
  coreRoles?: string[];
  hybridRoles?: string[];
  tangentialRoles?: string[];
  excludedRoles?: string[];
  categoryPolicies?: ProfileCategoryPolicy[];
  proofStories: ProofStory[];
}

interface WorkspaceProfile {
  id: string;
  personaName: string;
  roleTitle?: string;
  offerHeadline: string;
  targetAudience: string;
  searchKeywords?: string[];
  minHourlyRate?: number | string;
  minBudgetFixed?: number | string;
  verifiedPaymentOnly?: boolean;
  weightSkill?: number;
  weightAi?: number;
  weightClient?: number;
  weightRecency?: number;
  targetCountries?: string[];
  targetRegions?: string[];
  excludedCountries?: string[];
  geoFilterMode?: 'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE';
  coreRoles?: string[];
  hybridRoles?: string[];
  tangentialRoles?: string[];
  excludedRoles?: string[];
  categoryPolicies?: ProfileCategoryPolicy[];
  isActive: boolean;
  proofStories?: Array<{
    id: string;
    keyCode: string;
    companyOrProduct: string;
    impactMetric: string;
    description?: string;
    domainTags?: string[];
  }>;
}

interface WorkspaceResponse {
  positioningProfiles: WorkspaceProfile[];
}

interface FullProfilePayload {
  profileId: string;
  personaName: string;
  roleTitle: string;
  offerHeadline: string;
  targetAudience: string;
  coreRoles: string[];
  hybridRoles: string[];
  tangentialRoles: string[];
  excludedRoles: string[];
  searchKeywords: string[];
  minBudgetFixed: number;
  minHourlyRate: number;
  verifiedPaymentOnly: boolean;
  weightSkill: number;
  weightAi: number;
  weightClient: number;
  weightRecency: number;
  targetCountries: string[];
  targetRegions: string[];
  excludedCountries: string[];
  geoFilterMode: 'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE';
  categoryPolicies: Array<{
    taxonomyNodeId: string;
    lane: MarketCategoryLane;
    includeTerms?: string[];
    excludeTerms?: string[];
    priority?: number;
  }>;
  proofStories: Array<{ keyCode: string; companyOrProduct: string; impactMetric: string; description: string; domainTags: string[] }>;
}

@Injectable({ providedIn: 'root' })
export class PipelineStateService {
  private readonly http = inject(HttpClient);

  // The database is the source of truth. Signals only hold the currently loaded UI state.
  public readonly profiles = signal<CalibrationProfile[]>([]);
  public readonly activeProfileId = signal<string>('');
  public readonly isLoadingProfiles = signal<boolean>(true);
  public readonly profilesLoadError = signal<string>('');
  public readonly profileSaveError = signal<string>('');
  private readonly pendingProfileSaves = new Map<string, FullProfilePayload>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight: Promise<void> | null = null;
  private profileMutationQueue: Promise<void> = Promise.resolve();
  private activationRevision = 0;

  public readonly activeProfile = computed(() => {
    return this.profiles().find(p => p.id === this.activeProfileId()) ?? this.profiles()[0] ?? null;
  });

  // Reactive properties linked to the active profile
  public readonly offerText = signal<string>('');
  public readonly targetAudience = signal<string>('');
  public readonly keywordsText = signal<string>('');
  public readonly minHourlyRate = signal<number>(0);
  public readonly minBudgetFixed = signal<number>(0);
  public readonly verifiedPaymentOnly = signal<boolean>(true);
  public readonly weightSkill = signal<number>(40);
  public readonly weightAi = signal<number>(25);
  public readonly weightClient = signal<number>(20);
  public readonly weightRecency = signal<number>(15);
  public readonly targetCountries = signal<string[]>([]);
  public readonly targetRegions = signal<string[]>([]);
  public readonly excludedCountries = signal<string[]>([]);
  public readonly geoFilterMode = signal<'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE'>('WEIGHTED_PREFERENCE');
  public readonly coreRoles = signal<string[]>([]);
  public readonly hybridRoles = signal<string[]>([]);
  public readonly tangentialRoles = signal<string[]>([]);
  public readonly excludedRoles = signal<string[]>([]);
  public readonly marketTaxonomy = signal<MarketTaxonomyNode[]>([]);
  public readonly categoryPolicies = signal<ProfileCategoryPolicy[]>([]);
  public readonly isSynthesizingTaxonomy = signal<boolean>(false);
  public readonly taxonomySuccessMessage = signal<string>('');
  public readonly proofStories = signal<ProofStory[]>([]);

  // Dynamic Query Synthesis (Tri-Factor Engine)
  public readonly isSynthesizingQueries = signal<boolean>(false);
  public readonly synthesisRationale = signal<string>('');
  public readonly synthesisSuccessMessage = signal<string>('');
  public readonly selectedBatchSize = signal<number>(30);

  // Computed list of individual queries for interactive chips
  public readonly activeQueriesList = computed<string[]>(() => {
    const raw = this.keywordsText().trim();
    if (!raw) return [];
    if (raw.includes('\n')) {
      return raw.split('\n').map(q => q.trim()).filter(Boolean);
    }
    return raw.split(',').map(q => q.trim()).filter(Boolean);
  });

  constructor() {
    void this.loadProfilesFromDatabase();
  }

  private mapProfile(profile: WorkspaceProfile): CalibrationProfile {
    return {
      id: profile.id,
      name: profile.personaName,
      roleTitle: profile.roleTitle || '',
      offerText: profile.offerHeadline,
      targetAudience: profile.targetAudience,
      keywords: (profile.searchKeywords || []).join('\n'),
      minHourlyRate: Number(profile.minHourlyRate ?? 0),
      minBudgetFixed: Number(profile.minBudgetFixed ?? 0),
      verifiedPaymentOnly: profile.verifiedPaymentOnly ?? true,
      weightSkill: profile.weightSkill ?? 40,
      weightAi: profile.weightAi ?? 25,
      weightClient: profile.weightClient ?? 20,
      weightRecency: profile.weightRecency ?? 15,
      targetCountries: profile.targetCountries || [],
      targetRegions: profile.targetRegions || [],
      excludedCountries: profile.excludedCountries || [],
      geoFilterMode: profile.geoFilterMode || 'WEIGHTED_PREFERENCE',
      coreRoles: profile.coreRoles || [],
      hybridRoles: profile.hybridRoles || [],
      tangentialRoles: profile.tangentialRoles || [],
      excludedRoles: profile.excludedRoles || [],
      categoryPolicies: profile.categoryPolicies || [],
      proofStories: (profile.proofStories || []).map((story) => ({
        id: story.id,
        company: story.companyOrProduct,
        metric: story.impactMetric,
        description: story.description || '',
        tags: story.domainTags || [],
      })),
    };
  }

  private applyProfile(profile: CalibrationProfile): void {
    this.activeProfileId.set(profile.id);
    this.offerText.set(profile.offerText);
    this.targetAudience.set(profile.targetAudience);
    this.keywordsText.set(profile.keywords);
    this.minHourlyRate.set(profile.minHourlyRate);
    this.minBudgetFixed.set(profile.minBudgetFixed);
    this.verifiedPaymentOnly.set(profile.verifiedPaymentOnly);
    this.weightSkill.set(profile.weightSkill);
    this.weightAi.set(profile.weightAi);
    this.weightClient.set(profile.weightClient);
    this.weightRecency.set(profile.weightRecency);
    this.targetCountries.set(profile.targetCountries || []);
    this.targetRegions.set(profile.targetRegions || []);
    this.excludedCountries.set(profile.excludedCountries || []);
    this.geoFilterMode.set(profile.geoFilterMode || 'WEIGHTED_PREFERENCE');
    this.proofStories.set(profile.proofStories);
    this.coreRoles.set(profile.coreRoles || []);
    this.hybridRoles.set(profile.hybridRoles || []);
    this.tangentialRoles.set(profile.tangentialRoles || []);
    this.excludedRoles.set(profile.excludedRoles || []);
    this.categoryPolicies.set(profile.categoryPolicies || []);
  }

  private applyWorkspace(workspace: WorkspaceResponse): void {
    const profiles = (workspace.positioningProfiles || []).map((profile) => this.mapProfile(profile));
    this.profiles.set(profiles);
    const activeId = workspace.positioningProfiles?.find((profile) => profile.isActive)?.id || profiles[0]?.id;
    const activeProfile = profiles.find((profile) => profile.id === activeId);
    if (activeProfile) this.applyProfile(activeProfile);
  }

  public async loadProfilesFromDatabase(): Promise<void> {
    this.isLoadingProfiles.set(true);
    this.profilesLoadError.set('');
    try {
      const [workspace, taxonomy] = await Promise.all([
        this.http.get<WorkspaceResponse>(`${this.getApiBase()}/config/workspace`).toPromise(),
        this.http.get<MarketTaxonomyNode[]>(`${this.getApiBase()}/config/market-taxonomy`).toPromise(),
      ]);
      if (taxonomy) this.marketTaxonomy.set(taxonomy);
      if (workspace) this.applyWorkspace(workspace);
    } catch (error) {
      console.error('No se pudieron cargar los perfiles desde PostgreSQL:', error);
      this.profilesLoadError.set('No se pudieron cargar los perfiles desde PostgreSQL.');
    } finally {
      this.isLoadingProfiles.set(false);
    }
  }

  public selectProfile(profileId: string): void {
    const profile = this.profiles().find(p => p.id === profileId);
    if (!profile) return;
    const previousProfile = this.activeProfile();
    this.applyProfile(profile);
    const revision = ++this.activationRevision;
    void this.enqueueProfileMutation(() => this.activateProfile(profileId, previousProfile, revision));
  }

  private async activateProfile(
    profileId: string,
    previousProfile: CalibrationProfile | null,
    revision: number,
  ): Promise<void> {
    try {
      await this.flushProfileSaves();
      const workspace = await this.http.post<WorkspaceResponse>(`${this.getApiBase()}/config/activate-profile`, { profileId }).toPromise();
      if (workspace && revision === this.activationRevision) this.applyWorkspace(workspace);
    } catch (error) {
      console.error('No se pudo activar el perfil en PostgreSQL:', error);
      if (previousProfile && revision === this.activationRevision && this.activeProfileId() === profileId) {
        this.applyProfile(previousProfile);
      }
      this.profileSaveError.set('No se pudo activar el perfil. Los cambios locales aún no se guardaron.');
    }
  }

  public toggleTargetCountry(country: string): void {
    this.targetCountries.update((list) => {
      const exists = list.some(c => c.toLowerCase() === country.toLowerCase());
      return exists ? list.filter(c => c.toLowerCase() !== country.toLowerCase()) : [...list, country];
    });
    this.syncActiveProfile();
  }

  public toggleTargetRegion(region: string): void {
    this.targetRegions.update((list) => {
      const exists = list.includes(region);
      return exists ? list.filter(r => r !== region) : [...list, region];
    });
    this.syncActiveProfile();
  }

  public addExcludedCountry(country: string): void {
    const trimmed = country.trim();
    if (!trimmed) return;
    this.excludedCountries.update((list) => {
      if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) return list;
      return [...list, trimmed];
    });
    this.syncActiveProfile();
  }

  public removeExcludedCountry(country: string): void {
    this.excludedCountries.update((list) => list.filter(c => c.toLowerCase() !== country.toLowerCase()));
    this.syncActiveProfile();
  }

  public setGeoFilterMode(mode: 'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE'): void {
    this.geoFilterMode.set(mode);
    this.syncActiveProfile();
  }

  public setWeight(kind: 'SKILL' | 'AI' | 'CLIENT' | 'RECENCY', value: number): void {
    const weight = Number(value);
    if (!Number.isFinite(weight)) return;
    if (kind === 'SKILL') this.weightSkill.set(weight);
    if (kind === 'AI') this.weightAi.set(weight);
    if (kind === 'CLIENT') this.weightClient.set(weight);
    if (kind === 'RECENCY') this.weightRecency.set(weight);
    this.syncActiveProfile();
  }

  public syncActiveProfile(): void {
    this.profiles.update(list => list.map(p => {
      if (p.id === this.activeProfileId()) {
        return {
          ...p,
          offerText: this.offerText(),
          targetAudience: this.targetAudience(),
          keywords: this.keywordsText(),
          minHourlyRate: this.minHourlyRate(),
          minBudgetFixed: this.minBudgetFixed(),
          verifiedPaymentOnly: this.verifiedPaymentOnly(),
          weightSkill: this.weightSkill(),
          weightAi: this.weightAi(),
          weightClient: this.weightClient(),
          weightRecency: this.weightRecency(),
          targetCountries: this.targetCountries(),
          targetRegions: this.targetRegions(),
          excludedCountries: this.excludedCountries(),
          geoFilterMode: this.geoFilterMode(),
          coreRoles: this.coreRoles(),
          hybridRoles: this.hybridRoles(),
          tangentialRoles: this.tangentialRoles(),
          excludedRoles: this.excludedRoles(),
          categoryPolicies: this.categoryPolicies(),
          proofStories: this.proofStories(),
        };
      }
      return p;
    }));
    this.enqueueActiveProfileSave();
  }

  private buildActiveProfilePayload(): FullProfilePayload | null {
    const profile = this.activeProfile();
    if (!profile) return null;
    return {
      profileId: profile.id,
      personaName: profile.name,
      roleTitle: profile.roleTitle,
      offerHeadline: this.offerText(),
      targetAudience: this.targetAudience(),
      coreRoles: this.coreRoles(),
      hybridRoles: this.hybridRoles(),
      tangentialRoles: this.tangentialRoles(),
      excludedRoles: this.excludedRoles(),
      searchKeywords: this.activeQueriesList(),
      minBudgetFixed: this.minBudgetFixed(),
      minHourlyRate: this.minHourlyRate(),
      verifiedPaymentOnly: this.verifiedPaymentOnly(),
      weightSkill: this.weightSkill(),
      weightAi: this.weightAi(),
      weightClient: this.weightClient(),
      weightRecency: this.weightRecency(),
      targetCountries: this.targetCountries(),
      targetRegions: this.targetRegions(),
      excludedCountries: this.excludedCountries(),
      geoFilterMode: this.geoFilterMode(),
      categoryPolicies: this.categoryPolicies().map((policy) => ({
        taxonomyNodeId: policy.taxonomyNodeId,
        lane: policy.lane,
        includeTerms: policy.includeTerms || [],
        excludeTerms: policy.excludeTerms || [],
        priority: policy.priority ?? 0,
      })),
      proofStories: this.proofStories().map((story) => ({
        keyCode: story.id,
        companyOrProduct: story.company,
        impactMetric: story.metric,
        description: story.description,
        domainTags: story.tags,
      })),
    };
  }

  public getCategoryLane(taxonomyNodeId: string): MarketCategoryLane | null {
    return this.categoryPolicies().find((policy) => policy.taxonomyNodeId === taxonomyNodeId)?.lane ?? null;
  }

  public setCategoryLane(taxonomyNodeId: string, lane: MarketCategoryLane): void {
    this.categoryPolicies.update((policies) => [
      ...policies.filter((policy) => policy.taxonomyNodeId !== taxonomyNodeId),
      { taxonomyNodeId, lane },
    ]);
    this.syncActiveProfile();
  }

  private enqueueActiveProfileSave(): void {
    const payload = this.buildActiveProfilePayload();
    if (!payload) return;
    this.pendingProfileSaves.set(payload.profileId, payload);
    this.profileSaveError.set('');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.enqueueProfileMutation(() => this.flushProfileSaves()).catch(() => undefined);
    }, 350);
  }

  public async saveActiveProfile(): Promise<void> {
    const payload = this.buildActiveProfilePayload();
    if (payload) this.pendingProfileSaves.set(payload.profileId, payload);
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.enqueueProfileMutation(() => this.flushProfileSaves());
  }

  private enqueueProfileMutation(operation: () => Promise<void>): Promise<void> {
    const next = this.profileMutationQueue.then(operation, operation);
    this.profileMutationQueue = next.catch(() => undefined);
    return next;
  }

  private async flushProfileSaves(): Promise<void> {
    if (this.saveInFlight) return this.saveInFlight;
    this.saveInFlight = (async () => {
      while (this.pendingProfileSaves.size > 0) {
        const [profileId, payload] = this.pendingProfileSaves.entries().next().value as [string, FullProfilePayload];
        this.pendingProfileSaves.delete(profileId);
        try {
          await this.http.put<WorkspaceResponse>(`${this.getApiBase()}/config/full-profile`, payload).toPromise();
        } catch (error) {
          this.pendingProfileSaves.set(profileId, payload);
          this.profileSaveError.set('No se pudieron guardar los cambios del perfil. Reintentá guardar antes de cambiar de pantalla.');
          throw error;
        }
      }
    })();

    try {
      await this.saveInFlight;
    } finally {
      this.saveInFlight = null;
    }
  }

  /**
   * Crea un perfil de calibración COMPLETAMENTE DE CERO (Greenfield)
   */
  public async createBlankProfile(name: string, roleTitle: string = 'Consultor'): Promise<void> {
    await this.enqueueProfileMutation(async () => {
      await this.flushProfileSaves();
      const workspace = await this.http.post<WorkspaceResponse>(`${this.getApiBase()}/config/profiles`, {
        personaName: name.trim(),
        roleTitle: roleTitle.trim(),
      }).toPromise();
      if (workspace) this.applyWorkspace(workspace);
    });
  }

  /**
   * Crea y activa un perfil completo a partir de la síntesis de IA (CV Ingestor)
   */
  public async createFromSynthesis(data: any): Promise<void> {
    await this.enqueueProfileMutation(async () => {
      await this.flushProfileSaves();
      const name = data.personaName && data.positioningTitle
        ? `${data.personaName}: ${data.positioningTitle}`
        : (data.personaName || 'Perfil sintetizado');

      const workspace = await this.http.put<WorkspaceResponse>(`${this.getApiBase()}/config/full-profile`, {
        createProfileId: crypto.randomUUID(),
        personaName: name,
        roleTitle: data.positioningTitle || 'Consultor',
        offerHeadline: data.offerHeadline || '',
        targetAudience: data.targetAudience || '',
        voiceRules: data.voiceRules || [],
        coreRoles: data.taxonomy?.coreRoles || [],
        hybridRoles: data.taxonomy?.hybridRoles || [],
        tangentialRoles: data.taxonomy?.tangentialRoles || [],
        excludedRoles: data.taxonomy?.excludedRoles || [],
        searchKeywords: data.scrapingConfig?.searchKeywords || [],
        minHourlyRate: data.scrapingConfig?.minHourlyRate,
        minBudgetFixed: data.scrapingConfig?.minBudgetFixed,
        targetCountries: data.scrapingConfig?.targetCountries || [],
        targetRegions: data.scrapingConfig?.targetRegions || [],
        proofStories: (data.proofStories || []).map((story: any) => ({
          keyCode: story.keyCode || story.companyOrProduct,
          companyOrProduct: story.companyOrProduct,
          impactMetric: story.impactMetric,
          description: story.description || '',
          domainTags: story.domainTags || [],
        })),
      }).toPromise();
      if (workspace) this.applyWorkspace(workspace);
    });
  }

  public async deleteProfile(profileId: string): Promise<void> {
    await this.enqueueProfileMutation(async () => {
      await this.flushProfileSaves();
      const workspace = await this.http.delete<WorkspaceResponse>(`${this.getApiBase()}/config/profiles/${profileId}`).toPromise();
      if (workspace) this.applyWorkspace(workspace);
    });
  }

  public addProofStory(story: { company: string; metric: string; description: string; tags: string[] }): void {
    const newStory: ProofStory = {
      id: 'STORY_' + Date.now(),
      company: story.company,
      metric: story.metric,
      description: story.description,
      tags: story.tags,
    };
    this.proofStories.update(list => [newStory, ...list]);
    this.syncActiveProfile();
  }

  public updateProofStory(id: string, updated: { company: string; metric: string; description: string; tags: string[] }): void {
    this.proofStories.update(list => list.map(s => s.id === id ? { ...s, ...updated } : s));
    this.syncActiveProfile();
  }

  public deleteProofStory(id: string): void {
    this.proofStories.update(list => list.filter(s => s.id !== id));
    this.syncActiveProfile();
  }

  public moveProofStory(id: string, direction: 'UP' | 'DOWN'): void {
    this.proofStories.update(list => {
      const idx = list.findIndex(s => s.id === id);
      if (idx === -1) return list;
      const targetIdx = direction === 'UP' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= list.length) return list;

      const copy = [...list];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
    this.syncActiveProfile();
  }

  private getApiBase(): string {
    return (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? '/api'
      : 'http://localhost:7000/api';
  }

  public removeQuery(queryToRemove: string): void {
    const list = this.activeQueriesList().filter(q => q.toLowerCase() !== queryToRemove.toLowerCase());
    this.keywordsText.set(list.join('\n'));
    this.syncActiveProfile();
  }

  public addQuery(newQuery: string): void {
    const trimmed = newQuery.trim();
    if (!trimmed) return;
    const current = this.activeQueriesList();
    if (!current.includes(trimmed)) {
      const updated = [...current, trimmed];
      this.keywordsText.set(updated.join('\n'));
      this.syncActiveProfile();
    }
  }

  /**
   * Invoca el motor de IA (Gemini 3.8 Flash) en el backend para sintetizar
   * consultas booleanas Upwork alineadas con la oferta y las Proof Stories activas.
   */
  public async synthesizeQueriesWithAi(): Promise<{ success: boolean; queries: string[]; rationale?: string }> {
    this.isSynthesizingQueries.set(true);
    this.synthesisSuccessMessage.set('');
    try {
      // 1. Guardar primero el perfil actual para que el backend tenga la versión más fresca
      await this.saveActiveProfile();

      // 2. Invocar la síntesis dinámica en el backend
      const res = await this.http.post<{
        success: boolean;
        queries: string[];
        suggestedMinHourlyRate: number;
        suggestedMinBudgetFixed: number;
        rationale: string;
      }>(`${this.getApiBase()}/config/synthesize-queries`, {}).toPromise();

      if (res && res.queries && res.queries.length > 0) {
        this.keywordsText.set(res.queries.join('\n'));
        if (res.suggestedMinHourlyRate) {
          this.minHourlyRate.set(res.suggestedMinHourlyRate);
        }
        if (res.suggestedMinBudgetFixed) {
          this.minBudgetFixed.set(res.suggestedMinBudgetFixed);
        }
        this.synthesisRationale.set(res.rationale || '');
        this.synthesisSuccessMessage.set(`¡${res.queries.length} queries booleanas sintetizadas desde tus historias!`);
        this.syncActiveProfile();
        return { success: true, queries: res.queries, rationale: res.rationale };
      }
      return { success: false, queries: [] };
    } catch (err: any) {
      console.error('Error al sintetizar queries con IA:', err);
      this.synthesisSuccessMessage.set('Error conectando con el motor de IA.');
      return { success: false, queries: [] };
    } finally {
      this.isSynthesizingQueries.set(false);
    }
  }

  // ── Modificadores de Tags de Taxonomía ──────────────────────────────────────
  public addRole(category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED', role: string): void {
    const clean = role.trim();
    if (!clean) return;
    if (category === 'CORE') {
      if (!this.coreRoles().includes(clean)) {
        this.coreRoles.update(list => [...list, clean]);
      }
    } else if (category === 'HYBRID') {
      if (!this.hybridRoles().includes(clean)) {
        this.hybridRoles.update(list => [...list, clean]);
      }
    } else if (category === 'TANGENTIAL') {
      if (!this.tangentialRoles().includes(clean)) {
        this.tangentialRoles.update(list => [...list, clean]);
      }
    } else if (category === 'EXCLUDED') {
      if (!this.excludedRoles().includes(clean)) {
        this.excludedRoles.update(list => [...list, clean]);
      }
    }
    this.syncActiveProfile();
  }

  public removeRole(category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED', role: string): void {
    if (category === 'CORE') {
      this.coreRoles.update(list => list.filter(r => r !== role));
    } else if (category === 'HYBRID') {
      this.hybridRoles.update(list => list.filter(r => r !== role));
    } else if (category === 'TANGENTIAL') {
      this.tangentialRoles.update(list => list.filter(r => r !== role));
    } else if (category === 'EXCLUDED') {
      this.excludedRoles.update(list => list.filter(r => r !== role));
    }
    this.syncActiveProfile();
  }

  /**
   * Sintetiza la taxonomía de 4 capas de afinidad (Core, Hybrid, Tangential, Excluded) usando IA
   */
  public async synthesizeTaxonomyWithAi(): Promise<{ success: boolean; rationale?: string }> {
    this.isSynthesizingTaxonomy.set(true);
    this.taxonomySuccessMessage.set('');
    try {
      await this.saveActiveProfile();

      const res = await this.http.post<{
        success: boolean;
        coreRoles: string[];
        hybridRoles: string[];
        tangentialRoles: string[];
        excludedRoles: string[];
        rationale: string;
      }>(`${this.getApiBase()}/config/synthesize-taxonomy`, {}).toPromise();

      if (res && res.success) {
        if (res.coreRoles) this.coreRoles.set(res.coreRoles);
        if (res.hybridRoles) this.hybridRoles.set(res.hybridRoles);
        if (res.tangentialRoles) this.tangentialRoles.set(res.tangentialRoles);
        if (res.excludedRoles) this.excludedRoles.set(res.excludedRoles);
        this.taxonomySuccessMessage.set('¡Taxonomía de 4 capas calibrada con IA!');
        this.syncActiveProfile();
        return { success: true, rationale: res.rationale };
      }
      return { success: false };
    } catch (err: any) {
      console.error('Error al sintetizar taxonomía con IA:', err);
      this.taxonomySuccessMessage.set('Error conectando con el motor de IA.');
      return { success: false };
    } finally {
      this.isSynthesizingTaxonomy.set(false);
    }
  }
}

