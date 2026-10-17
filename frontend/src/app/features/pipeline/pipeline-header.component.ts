import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../core/services/theme.service';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-pipeline-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="h-14 border-b border-border-subtle bg-surface px-6 flex items-center justify-between flex-shrink-0 select-none">
      <!-- Brand & Project -->
      <div class="flex items-center gap-3">
        <div class="w-7 h-7 rounded-lg bg-brand-primary flex items-center justify-center text-white font-bold text-sm shadow-md">
          ⚡
        </div>
        <div>
          <span class="font-bold text-sm tracking-tight text-content-primary">Proposal Autopilot</span>
          <span class="text-xs text-content-muted ml-2 font-mono">v1.0 · Upwork Lead Engine</span>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-3">
        <!-- Live Scrape Button -->
        <button (click)="report.triggerLiveScrape(25)"
                [disabled]="report.isScrapingInProgress()"
                class="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-primary hover:bg-brand-hover text-white transition-all shadow-sm disabled:opacity-50">
          @if (report.isScrapingInProgress()) {
            <svg class="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Scraping 25 Jobs...</span>
          } @else {
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span>Run Scrape Now</span>
          }
        </button>

        <!-- Download CSV Button -->
        <button (click)="report.downloadCsv()"
                class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary border border-border-subtle transition-all">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          <span>Export CSV</span>
        </button>

        <!-- Theme Toggle Button -->
        <button (click)="theme.toggleTheme()"
                title="Toggle Light/Dark Theme"
                class="p-2 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary border border-border-subtle transition-all">
          @if (theme.theme() === 'dark') {
            <!-- Sun icon -->
            <svg class="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
            </svg>
          } @else {
            <!-- Moon icon -->
            <svg class="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
            </svg>
          }
        </button>
      </div>
    </header>
  `
})
export class PipelineHeaderComponent {
  public readonly theme = inject(ThemeService);
  public readonly report = inject(ReportService);
}
