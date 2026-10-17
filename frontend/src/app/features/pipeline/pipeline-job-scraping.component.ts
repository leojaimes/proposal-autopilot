import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-pipeline-job-scraping',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Job Scraping: Keywords & Filters</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          Keywords in, filtered fresh jobs out in 30 seconds. Targets only high-paying clients ($1,000+ or $40+/hr).
        </p>
      </div>

      <!-- Keywords Cloud -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <label class="text-xs font-semibold text-content-primary uppercase tracking-wider">Search Keywords Cloud</label>
        <div class="flex flex-wrap gap-2">
          @for (keyword of keywords(); track keyword) {
            <span class="px-2.5 py-1 rounded-lg text-xs font-medium bg-brand-primary/10 text-brand-primary border border-brand-primary/20 flex items-center gap-1.5">
              <span>{{ keyword }}</span>
            </span>
          }
        </div>
        <p class="text-[11px] text-content-muted">
          Mix specific tool keywords (Figma, N8N) with results-oriented terms (Design Systems, AI Product Design).
        </p>
      </div>

      <!-- Filters Settings -->
      <div class="grid grid-cols-3 gap-4">
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <span class="text-xs text-content-secondary font-medium">Min Fixed Budget</span>
          <div class="text-lg font-bold font-mono text-content-primary">$1,000 USD</div>
          <p class="text-[10px] text-content-muted">Discards low-tier fixed jobs</p>
        </div>

        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <span class="text-xs text-content-secondary font-medium">Min Hourly Rate</span>
          <div class="text-lg font-bold font-mono text-content-primary">$40.00 / hr</div>
          <p class="text-[10px] text-content-muted">Target rate: $50 - $70/hr</p>
        </div>

        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <span class="text-xs text-content-secondary font-medium">Max Age</span>
          <div class="text-lg font-bold font-mono text-content-primary">3 Days (72h)</div>
          <p class="text-[10px] text-content-muted">Priority to jobs &lt; 3h</p>
        </div>
      </div>
    </div>
  `
})
export class PipelineJobScrapingComponent {
  public readonly report = inject(ReportService);
  public readonly keywords = signal<string[]>([
    'UX research', 'design system', 'Figma design system', 'AI product design',
    'usability testing', 'AI prototyping', 'vibe coding', 'agentic workflow design',
    'N8N automation design', 'GenAI UX'
  ]);
}
