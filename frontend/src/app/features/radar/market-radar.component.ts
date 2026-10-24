import { Component, ChangeDetectionStrategy, inject, signal, computed, OnInit, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import {
  LucideChevronDown,
  LucideChevronUp,
  LucideCompass,
  LucideRefreshCw,
} from '@lucide/angular';

export interface MarketCategoryRow {
  snapshotId: string;
  rank: number;
  category: string;
  slug: string;
  lane: 'CORE' | 'ADJACENT' | 'EXCLUDED';
  demand7d: number;
  demand30d: number;
  medianProposals: number | null;
  medianBudget: number | null;
  verifiedClientsPct: number | null;
  sampleJobs: number;
  sampleConfidence: number | null;
  metricCoverage: MarketMetricCoverage;
  sourceBatchCount: number;
  evidenceJobs: MarketEvidenceJob[];
  trend: MarketTrend | null;
  profileFit: number | null;
  fitSampleJobs: number;
  overallOpportunity: number | null;
  profileEligibility: 'ELIGIBLE' | 'EXCLUDED' | 'PENDING';
  aiLeverage: MarketAiLeverage;
  asOf: string;
  calculationVersion: string;
  decision: MarketRadarDecision | null;
}

export interface MarketRadarDecision {
  id: string;
  status: 'PRIORITIZED' | 'WATCHED' | 'DISMISSED';
  rationale: string;
  operator: string;
  createdAt: string;
  outcome: MarketRadarDecisionOutcome | null;
}

export interface MarketRadarDecisionOutcome {
  jobPostId: string | null;
  proposalId: string | null;
  submittedAt: string | null;
  qualifiedRepliedAt: string | null;
  interviewedAt: string | null;
  wonAt: string | null;
  realizedValue: number | null;
}

export interface MarketAiLeverage {
  state: 'APPLICABLE' | 'NOT_APPLICABLE';
  capability: string | null;
  task: string | null;
  explanation: string | null;
}

export interface MarketMetricCoverage {
  proposalsKnownJobs: number;
  fixedBudgetJobs: number;
  paymentVerificationKnownJobs: number;
}

export interface MarketEvidenceJob {
  id: string;
  title: string;
  jobUrl: string;
  postedAt: string | null;
  proposalsCount: number | null;
  fixedBudget: number | null;
  paymentVerified: boolean | null;
}

export interface MarketTrend {
  comparedTo: string;
  elapsedDays: number;
  demand30dDelta: number;
  medianProposalsDelta: number | null;
  overallOpportunityDelta: number | null;
}

export interface RadarData {
  kpis: {
    totalJobsSampled: number;
    topCategory: string | null;
    opportunityCount: number;
    medianProposalsAcrossAll: number | null;
    activeProfileName: string | null;
  };
  operationalHealth: MarketRadarOperationalHealth;
  categories: MarketCategoryRow[];
  methodology: Record<string, string>;
}

export interface MarketRadarOperationalHealth {
  state: 'READY' | 'PARTIAL' | 'STALE' | 'NO_SNAPSHOTS';
  latestSnapshotAsOf: string | null;
  latestSnapshotRevision: number | null;
  latestCompletedScrapeAt: string | null;
  ageDays: number | null;
  expectedCategories: number;
  latestSnapshotCategories: number;
  retainedSnapshots: number;
  retentionDays: number;
  staleAfterDays: number;
  pendingClassificationJobs?: number;
  failedClassificationJobs?: number;
}

@Component({
  selector: 'app-market-radar',
  standalone: true,
  imports: [
    CommonModule,
    LucideChevronDown,
    LucideChevronUp,
    LucideCompass,
    LucideRefreshCw,
  ],
  templateUrl: './market-radar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketRadarComponent implements OnInit {
  private readonly http = inject(HttpClient);
  public readonly pipeline = inject(PipelineStateService);
  private readonly report = inject(ReportService);

  public readonly radarData = signal<RadarData | null>(null);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string>('');
  public readonly filterLane = signal<'ALL' | 'CORE_ADJACENT'>('ALL');
  public readonly isMethodologyOpen = signal<boolean>(true);
  public readonly selectedEvidenceSlug = signal<string | null>(null);
  public readonly isSavingDecision = signal<boolean>(false);
  public readonly decisionMessage = signal<string>('');

  constructor() {
    effect(() => {
      // Re-ejecutar el análisis cuando cambia el perfil activo en la cabina
      this.pipeline.activeProfileId();
      // El batch terminado ya persistió un snapshot nuevo; cargarlo sin interacción manual.
      this.report.marketRadarRefreshVersion();
      this.fetchRadarData();
    });
  }

  private getApiBase(): string {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'http://localhost:7000/api' : '/api';
  }

  public ngOnInit(): void {
    // Inicializado reactivamente por el effect
  }

  public fetchRadarData(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = `${this.getApiBase()}/scraping/market-radar?personaName=${encodeURIComponent(personaName)}`;

    this.http.get<any>(url)
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.success && res.data) {
            this.radarData.set(res.data);
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err.error?.message || 'Error cargando datos del radar de mercado.');
        }
      });
  }

  public readonly categories = computed(() => {
    const data = this.radarData();
    if (!data) return [];
    if (this.filterLane() === 'CORE_ADJACENT') {
      return data.categories.filter(c => c.lane !== 'EXCLUDED');
    }
    return data.categories;
  });

  public readonly selectedEvidenceCategory = computed(() => {
    const slug = this.selectedEvidenceSlug();
    return this.radarData()?.categories.find((category) => category.slug === slug) ?? null;
  });

  public readonly observedMovements = computed(() => {
    return (this.radarData()?.categories ?? [])
      .filter((category) => category.trend != null)
      .filter((category) => {
        const trend = category.trend!;
        return trend.demand30dDelta !== 0
          || (trend.medianProposalsDelta != null && trend.medianProposalsDelta !== 0)
          || (trend.overallOpportunityDelta != null && trend.overallOpportunityDelta !== 0);
      })
      .sort((left, right) => this.movementMagnitude(right) - this.movementMagnitude(left));
  });

  public toggleEvidence(categorySlug: string): void {
    this.selectedEvidenceSlug.update((current) => current === categorySlug ? null : categorySlug);
  }

  public toggleMethodology(): void {
    this.isMethodologyOpen.update(v => !v);
  }

  public createDecision(
    category: MarketCategoryRow,
    status: MarketRadarDecision['status'],
    operator: string,
    rationale: string,
  ): void {
    const data = this.radarData();
    if (!data || this.isSavingDecision()) return;
    if (data.operationalHealth.state !== 'READY') {
      this.decisionMessage.set(`Cannot record a decision while Radar health is ${data.operationalHealth.state}.`);
      return;
    }
    if (!operator.trim() || !rationale.trim()) {
      this.decisionMessage.set('Enter your name and rationale before recording a decision.');
      return;
    }

    this.isSavingDecision.set(true);
    this.decisionMessage.set('');
    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = `${this.getApiBase()}/scraping/market-radar/decisions?personaName=${encodeURIComponent(personaName)}`;
    this.http.post<any>(url, { snapshotId: category.snapshotId, status, operator, rationale })
      .subscribe({
        next: () => {
          this.isSavingDecision.set(false);
          this.decisionMessage.set(`${status} recorded for ${category.category}.`);
          this.fetchRadarData();
        },
        error: (err) => {
          this.isSavingDecision.set(false);
          this.decisionMessage.set(err.error?.message || 'Could not record the Radar decision.');
        },
      });
  }

  public recordOutcome(
    decisionId: string,
    jobPostId: string,
    milestone: 'submittedAt' | 'qualifiedRepliedAt' | 'interviewedAt' | 'wonAt',
    proposalId: string,
    realizedValue: string,
  ): void {
    if (this.isSavingDecision()) return;
    const normalizedProposalId = proposalId.trim();
    const normalizedValue = realizedValue.trim();
    const parsedRealizedValue = normalizedValue === '' ? undefined : Number(normalizedValue);
    if (parsedRealizedValue !== undefined && !Number.isFinite(parsedRealizedValue)) {
      this.decisionMessage.set('Enter a valid realized contract value.');
      return;
    }

    this.isSavingDecision.set(true);
    this.decisionMessage.set('');
    const url = `${this.getApiBase()}/scraping/market-radar/decisions/${decisionId}/outcome`;
    this.http.patch<any>(url, {
      jobPostId,
      [milestone]: new Date().toISOString(),
      ...(normalizedProposalId && { proposalId: normalizedProposalId }),
      ...(parsedRealizedValue !== undefined && { realizedValue: parsedRealizedValue }),
    })
      .subscribe({
        next: () => {
          this.isSavingDecision.set(false);
          this.decisionMessage.set('Outcome recorded.');
          this.fetchRadarData();
        },
        error: (err) => {
          this.isSavingDecision.set(false);
          this.decisionMessage.set(err.error?.message || 'Could not record the outcome.');
        },
      });
  }

  public getOppBadgeClass(score: number | null): string {
    if (score == null) return 'bg-slate-500/20 text-slate-300';
    if (score >= 55) return 'bg-emerald-500/20 text-emerald-300';
    if (score >= 40) return 'bg-amber-500/20 text-amber-300';
    return 'bg-red-500/20 text-red-300';
  }

  public getEligibilityLabel(eligibility: MarketCategoryRow['profileEligibility']): string {
    if (eligibility === 'ELIGIBLE') return 'Eligible';
    if (eligibility === 'EXCLUDED') return 'Excluded';
    return 'Pending — not observed';
  }

  public getEligibilityBadgeClass(eligibility: MarketCategoryRow['profileEligibility']): string {
    if (eligibility === 'ELIGIBLE') return 'bg-emerald-500/20 text-emerald-300';
    if (eligibility === 'EXCLUDED') return 'bg-slate-500/20 text-slate-300';
    return 'bg-amber-500/20 text-amber-300';
  }

  public getAiLeverageLabel(aiLeverage: MarketAiLeverage): string {
    return aiLeverage.state === 'APPLICABLE' ? aiLeverage.capability ?? 'Applicable' : 'Not applicable';
  }

  public getAiLeverageDescription(aiLeverage: MarketAiLeverage): string | null {
    if (aiLeverage.state !== 'APPLICABLE') return null;
    return [aiLeverage.task, aiLeverage.explanation].filter((value): value is string => value != null).join(' ');
  }

  public getProposalClass(proposals: number | null): string {
    if (proposals == null) return 'text-content-muted';
    if (proposals <= 5) return 'text-emerald-400';
    if (proposals <= 15) return 'text-amber-400';
    return 'text-red-400';
  }

  public getHealthClass(state: MarketRadarOperationalHealth['state']): string {
    if (state === 'READY') return 'bg-emerald-500/20 text-emerald-300';
    if (state === 'PARTIAL') return 'bg-amber-500/20 text-amber-300';
    return 'bg-red-500/20 text-red-300';
  }

  public formatDelta(value: number | null): string {
    if (value == null) return 'Not observed';
    return `${value > 0 ? '+' : ''}${value}`;
  }

  public describeMovement(category: MarketCategoryRow): string {
    const trend = category.trend;
    if (!trend) return 'Not enough history';
    const parts = [`30d demand ${this.formatDelta(trend.demand30dDelta)}`];
    if (trend.medianProposalsDelta != null) parts.push(`proposals ${this.formatDelta(trend.medianProposalsDelta)}`);
    if (trend.overallOpportunityDelta != null) parts.push(`opportunity ${this.formatDelta(trend.overallOpportunityDelta)}`);
    return `${parts.join(' · ')} vs ${trend.comparedTo}`;
  }

  private movementMagnitude(category: MarketCategoryRow): number {
    const trend = category.trend;
    if (!trend) return 0;
    return Math.abs(trend.overallOpportunityDelta ?? 0) + Math.abs(trend.demand30dDelta) + Math.abs(trend.medianProposalsDelta ?? 0);
  }
}
