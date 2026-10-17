import { Injectable, signal, computed } from '@angular/core';
import { PipelineStep, ProofStory } from '../models/pipeline.model';

@Injectable({ providedIn: 'root' })
export class PipelineStateService {
  // Active step in the 8-step pipeline
  private readonly _activeStepId = signal<number>(6); // Default on Step 6 (Dashboard) as requested
  public readonly activeStepId = this._activeStepId.asReadonly();

  // 8 Pipeline steps matching Bo's UI exactly
  public readonly steps = signal<PipelineStep[]>([
    { id: 0, slug: 'overview', title: 'Overview', subtitle: 'How this works', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 1, slug: 'machine-setup', title: 'Machine setup', subtitle: 'Accounts & keys', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 2, slug: 'positioning', title: 'Positioning', subtitle: 'Offer & voice', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 3, slug: 'job-scraping', title: 'Job scraping', subtitle: 'Keywords & filters', doneCount: 4, totalCount: 4, isCompleted: true },
    { id: 4, slug: 'fit-ranking', title: 'Fit ranking', subtitle: 'Score every job', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 5, slug: 'proposal-skill', title: 'Proposal skill', subtitle: 'Doc + diagram + letter', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 6, slug: 'sheet-dashboard', title: 'Sheet + dashboard', subtitle: 'Track & review', doneCount: 3, totalCount: 3, isCompleted: true },
    { id: 7, slug: 'daily-run', title: 'Daily run', subtitle: 'The actual routine', doneCount: 2, totalCount: 2, isCompleted: true },
  ]);

  // Overall milestone progress: 24 of 24
  public readonly completedCount = computed(() =>
    this.steps().reduce((acc, step) => acc + step.doneCount, 0)
  );

  public readonly totalCount = computed(() =>
    this.steps().reduce((acc, step) => acc + step.totalCount, 0)
  );

  public readonly progressPercentage = computed(() =>
    Math.round((this.completedCount() / this.totalCount()) * 100)
  );

  public readonly activeStep = computed(() =>
    this.steps().find(s => s.id === this._activeStepId()) ?? this.steps()[0]
  );

  // Positioning Data
  public readonly offerText = signal<string>(
    'AI-native UX for product teams: senior design-system, prototyping, and research work delivered at agency speed by pairing 10+ years of Meta/Google/Cisco design craft with AI-assisted workflows.'
  );

  public readonly targetAudience = signal<string>(
    'Seed-to-Series B SaaS founders and product leads who need senior design-system or UX-research work fast, but cannot yet justify a full-time senior hire.'
  );

  public readonly proofStories = signal<ProofStory[]>([
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
      tags: ['AI Trust', 'Research', 'A/B Testing']
    },
    {
      id: 'NAEHAS_COMPLIANCE',
      company: 'Naehas AI',
      metric: 'Bank of America & First National',
      description: 'Built Naehas AI compliance tooling for Bank of America, First National Bank, and Pathward.',
      tags: ['B2B SaaS', 'Compliance', 'AI Tooling']
    },
    {
      id: 'GOOGLE_KENNEDY',
      company: 'Google',
      metric: 'Precursor to Material Design',
      description: 'Contributed to Google Project Kennedy design system, the precursor to Material Design.',
      tags: ['Design Systems', 'Foundational Craft']
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
  ]);

  // Scoring Weights (40 / 25 / 20 / 15)
  public readonly weightSkill = signal<number>(40);
  public readonly weightAi = signal<number>(25);
  public readonly weightClient = signal<number>(20);
  public readonly weightRecency = signal<number>(15);

  public selectStep(stepId: number): void {
    this._activeStepId.set(stepId);
  }

  public updateWeights(skill: number, ai: number, client: number, recency: number): void {
    this.weightSkill.set(skill);
    this.weightAi.set(ai);
    this.weightClient.set(client);
    this.weightRecency.set(recency);
  }
}
