import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { PipelineStep, ProofStory } from '../models/pipeline.model';

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
  proofStories: ProofStory[];
}

const DEFAULT_PROFILES: CalibrationProfile[] = [
  {
    id: 'ARMANDO_PRESET',
    name: 'Armando: Senior AI UX Designer',
    roleTitle: 'AI Interaction & Agentic UX Designer',
    offerText: 'AI-native UX for product teams: senior design-system, prototyping, and research work delivered at agency speed by pairing 10+ years of Meta/Google/Cisco design craft with AI-assisted workflows.',
    targetAudience: 'Seed-to-Series B SaaS founders and product leads who need senior design-system or UX-research work fast, but cannot yet justify a full-time senior hire.',
    keywords: 'UI/UX design, UX/UI designer, UX research, design system, Figma design system, AI product design, usability testing, AI prototyping, vibe coding, agentic workflow design, N8N automation design, GenAI UX',
    minHourlyRate: 40,
    minBudgetFixed: 1000,
    verifiedPaymentOnly: true,
    weightSkill: 40,
    weightAi: 25,
    weightClient: 20,
    weightRecency: 15,
    targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland'],
    targetRegions: ['North America', 'Western Europe'],
    excludedCountries: [],
    geoFilterMode: 'WEIGHTED_PREFERENCE',
    proofStories: [
      {
        id: 'META_FINTECH',
        company: 'Meta Fintech',
        metric: 'Cutting dev cycles 25%',
        description: 'Standardized UX patterns across 3 Meta Fintech engineering teams, cutting design-related dev cycles 25%.',
        tags: ['Design Systems', 'Fintech', 'Enterprise UX']
      },
      {
        id: 'MESSENGER_TRUST',
        company: 'Meta Messenger',
        metric: '+42% User Confidence',
        description: 'Ran the AI-trust research behind Messenger privacy and moderation features, lifting user confidence in AI interactions 42% in A/B testing.',
        tags: ['AI UX', 'Research', 'Trust & Safety']
      },
      {
        id: 'CISCO_COMMERCE',
        company: 'Cisco Systems',
        metric: '$40B Annual Bookings / 15k Users',
        description: 'Built the UI pattern library behind Cisco Commerce Workspace, 15,000+ users and $40B in annual bookings.',
        tags: ['Design Systems', 'High Scale', 'Enterprise']
      },
      {
        id: 'PEPPER_AI',
        company: 'Pepper AI',
        metric: '17,000+ Users & Seed Funding',
        description: 'Founded Pepper AI, a Gen AI entertainment assistant that reached 17,000+ users and secured seed funding.',
        tags: ['0-to-1 Product', 'GenAI', 'Founder']
      }
    ]
  }
];

@Injectable({ providedIn: 'root' })
export class PipelineStateService {
  // Profiles Catalog (with LocalStorage cache)
  public readonly profiles = signal<CalibrationProfile[]>(this.loadProfiles());
  public readonly activeProfileId = signal<string>(this.loadActiveProfileId());

  public readonly activeProfile = computed(() => {
    return this.profiles().find(p => p.id === this.activeProfileId()) ?? this.profiles()[0];
  });

  // Reactive properties linked to the active profile
  public readonly offerText = signal<string>(this.activeProfile().offerText);
  public readonly targetAudience = signal<string>(this.activeProfile().targetAudience);
  public readonly keywordsText = signal<string>(this.activeProfile().keywords);
  public readonly minHourlyRate = signal<number>(this.activeProfile().minHourlyRate);
  public readonly minBudgetFixed = signal<number>(this.activeProfile().minBudgetFixed);
  public readonly verifiedPaymentOnly = signal<boolean>(this.activeProfile().verifiedPaymentOnly);
  public readonly weightSkill = signal<number>(this.activeProfile().weightSkill);
  public readonly weightAi = signal<number>(this.activeProfile().weightAi);
  public readonly weightClient = signal<number>(this.activeProfile().weightClient);
  public readonly weightRecency = signal<number>(this.activeProfile().weightRecency);
  public readonly targetCountries = signal<string[]>(this.activeProfile().targetCountries || ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland']);
  public readonly targetRegions = signal<string[]>(this.activeProfile().targetRegions || ['North America', 'Western Europe']);
  public readonly excludedCountries = signal<string[]>(this.activeProfile().excludedCountries || []);
  public readonly geoFilterMode = signal<'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE'>(this.activeProfile().geoFilterMode || 'WEIGHTED_PREFERENCE');
  public readonly proofStories = signal<ProofStory[]>(this.activeProfile().proofStories);

  // Dynamic Query Synthesis (Tri-Factor Engine)
  private readonly http = inject(HttpClient);
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

  constructor() {}

  private loadProfiles(): CalibrationProfile[] {
    try {
      const stored = localStorage.getItem('proposal_autopilot_profiles');
      if (stored) {
        const list: CalibrationProfile[] = JSON.parse(stored);
        // Migrar cualquier perfil previo a Armando
        return list.map(p => {
          if (p.id === 'BO_PRESET' || p.name.includes('Bo:')) {
            return {
              ...p,
              id: 'ARMANDO_PRESET',
              name: 'Armando: Senior AI UX Designer',
              keywords: p.keywords.includes('UI/UX') ? p.keywords : `UI/UX design, UX/UI designer, ${p.keywords}`,
            };
          }
          return p;
        });
      }
      return DEFAULT_PROFILES;
    } catch {
      return DEFAULT_PROFILES;
    }
  }

  private loadActiveProfileId(): string {
    try {
      const storedId = localStorage.getItem('proposal_autopilot_active_id');
      if (!storedId || storedId === 'BO_PRESET') return 'ARMANDO_PRESET';
      return storedId;
    } catch {
      return 'ARMANDO_PRESET';
    }
  }

  private persist(): void {
    try {
      localStorage.setItem('proposal_autopilot_profiles', JSON.stringify(this.profiles()));
      localStorage.setItem('proposal_autopilot_active_id', this.activeProfileId());
    } catch {}
  }

  public selectProfile(profileId: string): void {
    const profile = this.profiles().find(p => p.id === profileId);
    if (!profile) return;
    this.activeProfileId.set(profileId);
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
    this.targetCountries.set(profile.targetCountries || ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'Ireland']);
    this.targetRegions.set(profile.targetRegions || ['North America', 'Western Europe']);
    this.excludedCountries.set(profile.excludedCountries || []);
    this.geoFilterMode.set(profile.geoFilterMode || 'WEIGHTED_PREFERENCE');
    this.proofStories.set(profile.proofStories);
    this.persist();
  }

  public toggleTargetCountry(country: string): void {
    this.targetCountries.update(list => {
      const exists = list.some(c => c.toLowerCase() === country.toLowerCase());
      const next = exists ? list.filter(c => c.toLowerCase() !== country.toLowerCase()) : [...list, country];
      this.syncActiveProfile();
      return next;
    });
  }

  public toggleTargetRegion(region: string): void {
    this.targetRegions.update(list => {
      const exists = list.includes(region);
      const next = exists ? list.filter(r => r !== region) : [...list, region];
      this.syncActiveProfile();
      return next;
    });
  }

  public addExcludedCountry(country: string): void {
    const trimmed = country.trim();
    if (!trimmed) return;
    this.excludedCountries.update(list => {
      if (list.some(c => c.toLowerCase() === trimmed.toLowerCase())) return list;
      const next = [...list, trimmed];
      this.syncActiveProfile();
      return next;
    });
  }

  public removeExcludedCountry(country: string): void {
    this.excludedCountries.update(list => {
      const next = list.filter(c => c.toLowerCase() !== country.toLowerCase());
      this.syncActiveProfile();
      return next;
    });
  }

  public setGeoFilterMode(mode: 'WEIGHTED_PREFERENCE' | 'STRICT_EXCLUDE'): void {
    this.geoFilterMode.set(mode);
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
          proofStories: this.proofStories(),
        };
      }
      return p;
    }));
    this.persist();
  }

  /**
   * Crea un perfil de calibración COMPLETAMENTE DE CERO (Greenfield)
   */
  public createBlankProfile(name: string, roleTitle: string = 'Consultor'): void {
    const newProfile: CalibrationProfile = {
      id: 'PROFILE_' + Date.now(),
      name: name.trim() || 'Nuevo Perfil',
      roleTitle: roleTitle.trim() || 'Consultor / Especialista',
      offerText: '',
      targetAudience: '',
      keywords: '',
      minHourlyRate: 50,
      minBudgetFixed: 1000,
      verifiedPaymentOnly: true,
      weightSkill: 40,
      weightAi: 25,
      weightClient: 20,
      weightRecency: 15,
      proofStories: [],
    };
    this.profiles.update(list => [...list, newProfile]);
    this.selectProfile(newProfile.id);
  }

  public deleteProfile(profileId: string): void {
    if (this.profiles().length <= 1) return; // Keep at least one profile
    this.profiles.update(list => list.filter(p => p.id !== profileId));
    if (this.activeProfileId() === profileId) {
      this.selectProfile(this.profiles()[0].id);
    }
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
  }

  public updateProofStory(id: string, updated: { company: string; metric: string; description: string; tags: string[] }): void {
    this.proofStories.update(list => list.map(s => s.id === id ? { ...s, ...updated } : s));
  }

  public deleteProofStory(id: string): void {
    this.proofStories.update(list => list.filter(s => s.id !== id));
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
      await this.http.put(`${this.getApiBase()}/config/positioning`, {
        offerHeadline: this.offerText(),
        targetAudience: this.targetAudience(),
        voiceRules: 'First person peer-to-peer. No em dashes anywhere. Sell result before tool.',
      }).toPromise();

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
}

