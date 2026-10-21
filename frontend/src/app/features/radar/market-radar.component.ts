import { Component, ChangeDetectionStrategy, inject, signal, computed, output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  LucideSparkles,
  LucideTrendingUp,
  LucideShield,
  LucideSearch,
  LucideCheckCircle2,
  LucideAlertCircle,
  LucideLayers,
  LucideDollarSign,
  LucideInfo,
  LucideArrowUpRight,
  LucideDatabase,
  LucideChevronDown,
  LucideChevronUp,
  LucideZap,
  LucideTarget,
  LucideCompass,
  LucideRefreshCw,
} from '@lucide/angular';

export interface MarketCategoryRow {
  rank: number;
  category: string;
  lane: 'Core' | 'Adjacent' | 'Excluded';
  overallOpportunity: number;
  marketScore: number;
  personalFit: number;
  newJobsPerHour: number;
  medianProposals: number;
  pctUnder10Proposals: number;
  medianHourly: number;
  medianFixed: number;
  pctVerifiedClients: number;
  skillAffinity: number;
  aiEase: number;
  relevantJobsSampled: number;
  runsAveraged: number;
  updated: string;
}

export interface ProvenanceRow {
  field: string;
  table: string;
  columns: string;
  formula: string;
  purpose: string;
}

export interface RadarData {
  kpis: {
    totalJobsSampled: number;
    topCategory: string;
    oceanBlueCount: number;
    medianProposalsAcrossAll: number;
    activeProfileName: string;
  };
  categories: MarketCategoryRow[];
  provenance: ProvenanceRow[];
}

@Component({
  selector: 'app-market-radar',
  standalone: true,
  imports: [
    CommonModule,
    LucideSparkles,
    LucideTrendingUp,
    LucideShield,
    LucideSearch,
    LucideCheckCircle2,
    LucideAlertCircle,
    LucideLayers,
    LucideDollarSign,
    LucideInfo,
    LucideArrowUpRight,
    LucideDatabase,
    LucideChevronDown,
    LucideChevronUp,
    LucideZap,
    LucideTarget,
    LucideCompass,
    LucideRefreshCw,
  ],
  templateUrl: './market-radar.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketRadarComponent implements OnInit {
  private readonly http = inject(HttpClient);

  public readonly drilldownCategory = output<string>();

  public readonly radarData = signal<RadarData | null>(null);
  public readonly isLoading = signal<boolean>(true);
  public readonly errorMessage = signal<string>('');
  public readonly filterLane = signal<'ALL' | 'CORE_ADJACENT'>('ALL');
  public readonly isMethodologyOpen = signal<boolean>(true);
  public readonly selectedQuadrant = signal<string | null>(null);

  private getApiBase(): string {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return isLocalhost ? 'http://localhost:7000/api' : '/api';
  }

  public ngOnInit(): void {
    this.fetchRadarData();
  }

  public fetchRadarData(): void {
    this.isLoading.set(true);
    this.errorMessage.set('');

    this.http.get<any>(`${this.getApiBase()}/scraping/market-radar`)
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
      return data.categories.filter(c => c.lane !== 'Excluded');
    }
    return data.categories;
  });

  // Agrupación en Cuadrantes
  public readonly oceanBlueCategories = computed(() => {
    return (this.radarData()?.categories || []).filter(c => c.medianProposals <= 5 && c.personalFit >= 70 && c.lane !== 'Excluded');
  });

  public readonly fastTurnaroundCategories = computed(() => {
    return (this.radarData()?.categories || []).filter(c => c.aiEase >= 80 && c.medianProposals <= 10 && c.lane !== 'Excluded');
  });

  public readonly highCompetitionCategories = computed(() => {
    return (this.radarData()?.categories || []).filter(c => c.medianProposals > 15 && c.lane !== 'Excluded');
  });

  public readonly excludedCategories = computed(() => {
    return (this.radarData()?.categories || []).filter(c => c.lane === 'Excluded');
  });

  public onDrilldown(categoryName: string): void {
    this.drilldownCategory.emit(categoryName);
  }

  public toggleMethodology(): void {
    this.isMethodologyOpen.update(v => !v);
  }

  public getOppBadgeClass(score: number): string {
    if (score >= 55) return 'bg-emerald-500/20 text-emerald-300';
    if (score >= 40) return 'bg-amber-500/20 text-amber-300';
    return 'bg-red-500/20 text-red-300';
  }

  public getProposalClass(proposals: number): string {
    if (proposals <= 5) return 'text-emerald-400';
    if (proposals <= 15) return 'text-amber-400';
    return 'text-red-400';
  }
}
