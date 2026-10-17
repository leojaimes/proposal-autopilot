import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-pipeline-daily-run',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Daily Run: The 10-Minute Morning Routine</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          Your morning coffee workflow: 1 click to ingest, 5 minutes to review High Fit leads, 2 minutes to dispatch proposals.
        </p>
      </div>

      <!-- Execution Hero Card -->
      <div class="p-6 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-surface to-surface border border-indigo-500/30 space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-lg font-bold text-content-primary">Morning Scrape Execution</h2>
            <p class="text-xs text-content-secondary mt-0.5">Scrapes latest 25 listings from Upwork, executes 40/25/20/15 fit ranking, generates 35-word proposals.</p>
          </div>
          <button (click)="report.triggerLiveScrape(25)"
                  [disabled]="report.isScrapingInProgress()"
                  class="px-5 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-hover text-white font-bold text-xs shadow-lg transition-all disabled:opacity-50">
            @if (report.isScrapingInProgress()) {
              <span>Scraping In Progress...</span>
            } @else {
              <span>⚡ Start Morning Run</span>
            }
          </button>
        </div>
      </div>
    </div>
  `
})
export class PipelineDailyRunComponent {
  public readonly report = inject(ReportService);
}
