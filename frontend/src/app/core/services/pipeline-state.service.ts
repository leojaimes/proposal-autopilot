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
  coreRoles?: string[];
  hybridRoles?: string[];
  tangentialRoles?: string[];
  excludedRoles?: string[];
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
  },
  {
    id: 'LEONARDO_PRESET',
    name: 'Leonardo Jaimes: Senior Full Stack & AI Architect',
    roleTitle: 'Senior Full Stack Developer & AI Systems Architect',
    offerText: 'I build AI-driven multi-tenant SaaS platforms that automate content generation, decision-making, and publishing, reducing production time by over 80% and ensuring brand consistency for your business.',
    targetAudience: 'Founders, CTOs, and technical leaders of fast-growing SaaS startups, digital agencies, and media companies seeking to leverage AI for content automation and scalable web/mobile solutions.',
    keywords: 'Full Stack Developer, Backend Engineer, Node.js Developer, NestJS, Vue.js, Nuxt.js, AI Agent Architect, Automation Engineer, SaaS Platform, Multi-Tenant SaaS',
    minHourlyRate: 50,
    minBudgetFixed: 1000,
    verifiedPaymentOnly: true,
    weightSkill: 40,
    weightAi: 25,
    weightClient: 20,
    weightRecency: 15,
    targetCountries: ['United States', 'United Kingdom', 'Canada', 'Australia'],
    targetRegions: ['North America', 'Western Europe'],
    excludedCountries: [],
    geoFilterMode: 'WEIGHTED_PREFERENCE',
    coreRoles: [
      'Full Stack Developer',
      'Backend Engineer',
      'Node.js Developer',
      'Vue.js Developer',
      'Nuxt.js Developer',
      'MongoDB Developer',
      'NestJS Developer'
    ],
    hybridRoles: [
      'AI Agent Architect',
      'Automation Engineer',
      'Multi-Tenant SaaS Architect',
      'Prompt Engineer',
      'Spec-Driven Developer',
      'Workflow Orchestration Specialist'
    ],
    tangentialRoles: [
      'Frontend Lead',
      'Mobile Developer (Flutter)',
      'REST API Designer',
      'Technical Lead'
    ],
    excludedRoles: [
      'UI/UX Designer',
      'Graphic Designer',
      'Manual QA Tester',
      'Data Entry Specialist',
      'Virtual Assistant',
      'Telemarketing',
      'WordPress Developer',
      'Shopify Developer'
    ],
    proofStories: [
      {
        id: 'SPOTLIGHT_AI_PLATFORM',
        company: 'AI Publications Platform (SaaS)',
        metric: '80% Reduction in Content Production Time',
        description: 'Architected and built an autonomous AI multi-tenant publications platform automating content generation and distribution.',
        tags: ['AI Agent Design', 'Multi-Tenant SaaS', 'Content Automation', 'Vue/Nuxt', 'Node.js/NestJS']
      },
      {
        id: 'PEPPERTIX_WEB',
        company: 'PepperTix Web Application',
        metric: 'Increased User Engagement & SEO',
        description: 'Built scalable Vue/Nuxt.js web application with optimized rendering, responsive design and accessibility.',
        tags: ['Frontend Development', 'Vue/Nuxt.js', 'Responsive Design', 'SEO Optimization']
      },
      {
        id: 'PEPPERTIX_BACKEND',
        company: 'PepperTix Backend',
        metric: 'Ensured High-Availability Database Integration',
        description: 'Engineered Node.js/Express REST APIs with MongoDB aggregation pipelines and user session security.',
        tags: ['Backend Development', 'Node.js/Express.js', 'RESTful APIs', 'MongoDB']
      },
      {
        id: 'PEPPER_VIDEOS_MOBILE',
        company: 'Pepper Videos Mobile',
        metric: 'Cross-Platform Clean Architecture',
        description: 'Developed Flutter mobile application using Clean Architecture with real-time video feeds and push notifications.',
        tags: ['Mobile Development', 'Flutter', 'Clean Architecture', 'Video Streaming']
      },
      {
        id: 'PEPPER_BOT',
        company: 'Pepper Bot',
        metric: 'Conversational Event Search Functionality',
        description: 'Engineered Dialogflow & LLM conversational chatbot integrated with Facebook Messenger Graph API.',
        tags: ['Chatbot Development', 'Dialogflow', 'ChatGPT', 'Facebook Messenger']
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
  public readonly coreRoles = signal<string[]>(this.activeProfile().coreRoles || ['UI/UX design', 'UX research', 'design system', 'usability testing']);
  public readonly hybridRoles = signal<string[]>(this.activeProfile().hybridRoles || ['AI product design', 'agentic workflow design', 'AI prototyping']);
  public readonly tangentialRoles = signal<string[]>(this.activeProfile().tangentialRoles || ['Product manager', 'Web designer', 'Graphic designer']);
  public readonly excludedRoles = signal<string[]>(this.activeProfile().excludedRoles || ['Full Stack', 'Backend', 'React Developer', 'Software Engineer', 'Assistant', 'Telemarketing']);
  public readonly isSynthesizingTaxonomy = signal<boolean>(false);
  public readonly taxonomySuccessMessage = signal<string>('');
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
        let list: CalibrationProfile[] = JSON.parse(stored);
        // Migrar cualquier perfil previo a Armando
        list = list.map(p => {
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

        // Asegurar que tanto Armando como Leonardo estén en la lista
        const hasLeonardo = list.some(p => p.id === 'LEONARDO_PRESET' || p.name.toLowerCase().includes('leonardo'));
        if (!hasLeonardo && DEFAULT_PROFILES[1]) {
          list.push(DEFAULT_PROFILES[1]);
        }
        const hasArmando = list.some(p => p.id === 'ARMANDO_PRESET' || p.name.toLowerCase().includes('armando'));
        if (!hasArmando && DEFAULT_PROFILES[0]) {
          list.unshift(DEFAULT_PROFILES[0]);
        }
        return list;
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
    this.coreRoles.set(profile.coreRoles || []);
    this.hybridRoles.set(profile.hybridRoles || []);
    this.tangentialRoles.set(profile.tangentialRoles || []);
    this.excludedRoles.set(profile.excludedRoles || []);
    this.persist();

    // Sincronizar activación con PostgreSQL
    this.activateProfileInBackend(profile.name);
  }

  public activateProfileInBackend(personaName: string): void {
    this.http.post(`${this.getApiBase()}/config/activate-profile`, { personaName }).subscribe({
      next: () => console.log(`✅ Perfil [${personaName}] activado en PostgreSQL`),
      error: (err) => console.warn(`⚠️ Error activando perfil en backend:`, err)
    });
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
          coreRoles: this.coreRoles(),
          hybridRoles: this.hybridRoles(),
          tangentialRoles: this.tangentialRoles(),
          excludedRoles: this.excludedRoles(),
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
      coreRoles: [],
      hybridRoles: [],
      tangentialRoles: [],
      excludedRoles: [],
    };
    this.profiles.update(list => [...list, newProfile]);
    this.selectProfile(newProfile.id);
  }

  /**
   * Crea y activa un perfil completo a partir de la síntesis de IA (CV Ingestor)
   */
  public createFromSynthesis(data: any): CalibrationProfile {
    const name = data.personaName && data.positioningTitle 
      ? `${data.personaName}: ${data.positioningTitle}`
      : (data.personaName || 'Leonardo Jaimes: Full Stack & AI Architect');

    const newProfile: CalibrationProfile = {
      id: 'PROFILE_' + Date.now(),
      name: name,
      roleTitle: data.positioningTitle || 'Senior Full Stack & AI Architect',
      offerText: data.offerHeadline || '',
      targetAudience: data.targetAudience || '',
      keywords: data.scrapingConfig?.searchKeywords?.join(', ') || '',
      minHourlyRate: data.scrapingConfig?.minHourlyRate || 50,
      minBudgetFixed: data.scrapingConfig?.minBudgetFixed || 1000,
      verifiedPaymentOnly: true,
      weightSkill: 40,
      weightAi: 25,
      weightClient: 20,
      weightRecency: 15,
      targetCountries: data.scrapingConfig?.targetCountries || ['United States', 'United Kingdom', 'Canada', 'Australia'],
      coreRoles: data.taxonomy?.coreRoles || [],
      hybridRoles: data.taxonomy?.hybridRoles || [],
      tangentialRoles: data.taxonomy?.tangentialRoles || [],
      excludedRoles: data.taxonomy?.excludedRoles || [],
      proofStories: (data.proofStories || []).map((s: any) => ({
        id: s.keyCode || ('STORY_' + Math.random().toString(36).substring(7)),
        company: s.companyOrProduct,
        metric: s.impactMetric,
        description: s.impactMetric,
        tags: s.domainTags || [],
      })),
    };

    this.profiles.update(list => [...list, newProfile]);
    this.selectProfile(newProfile.id);
    return newProfile;
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
      await this.http.put(`${this.getApiBase()}/config/positioning`, {
        offerHeadline: this.offerText(),
        targetAudience: this.targetAudience(),
        coreRoles: this.coreRoles(),
        hybridRoles: this.hybridRoles(),
        tangentialRoles: this.tangentialRoles(),
        excludedRoles: this.excludedRoles(),
      }).toPromise();

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

