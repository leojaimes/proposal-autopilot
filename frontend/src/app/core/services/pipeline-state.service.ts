import { Injectable, signal, computed, effect } from '@angular/core';
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
  proofStories: ProofStory[];
}

const DEFAULT_PROFILES: CalibrationProfile[] = [
  {
    id: 'BO_PRESET',
    name: 'Bo: Senior AI UX Designer',
    roleTitle: 'AI Interaction & Agentic UX Designer',
    offerText: 'AI-native UX for product teams: senior design-system, prototyping, and research work delivered at agency speed by pairing 10+ years of Meta/Google/Cisco design craft with AI-assisted workflows.',
    targetAudience: 'Seed-to-Series B SaaS founders and product leads who need senior design-system or UX-research work fast, but cannot yet justify a full-time senior hire.',
    keywords: 'UX research, design system, Figma design system, AI product design, usability testing, AI prototyping, vibe coding, agentic workflow design, N8N automation design, GenAI UX',
    minHourlyRate: 40,
    minBudgetFixed: 1000,
    verifiedPaymentOnly: true,
    weightSkill: 40,
    weightAi: 25,
    weightClient: 20,
    weightRecency: 15,
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
  public readonly proofStories = signal<ProofStory[]>(this.activeProfile().proofStories);

  constructor() {}

  private loadProfiles(): CalibrationProfile[] {
    try {
      const stored = localStorage.getItem('proposal_autopilot_profiles');
      return stored ? JSON.parse(stored) : DEFAULT_PROFILES;
    } catch {
      return DEFAULT_PROFILES;
    }
  }

  private loadActiveProfileId(): string {
    try {
      return localStorage.getItem('proposal_autopilot_active_id') || 'BO_PRESET';
    } catch {
      return 'BO_PRESET';
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
    this.proofStories.set(profile.proofStories);
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
}
