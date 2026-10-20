import { Component, ChangeDetectionStrategy, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideClock,
  LucideGlobe,
  LucideCpu,
  LucideSparkles,
  LucideCheckCircle2,
  LucideCheck,
  LucideArrowRight,
} from '@lucide/angular';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-live-scrape-progress',
  standalone: true,
  imports: [
    CommonModule,
    LucideClock,
    LucideGlobe,
    LucideCpu,
    LucideSparkles,
    LucideCheckCircle2,
    LucideCheck,
    LucideArrowRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (report.isScrapingInProgress()) {
      <div class="px-5 py-3 bg-[#0d1322] border-b border-indigo-500/30 shadow-xl relative overflow-hidden select-none animate-fadeIn">
        <!-- Subtle Glow Background -->
        <div class="absolute -left-10 -top-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div class="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="max-w-7xl mx-auto space-y-2.5">
          <!-- Top Row: Status Badge, Title, Timer, Percentage -->
          <div class="flex items-center justify-between gap-4">
            <div class="flex items-center gap-3 min-w-0">
              <!-- Animated Pulse Icon -->
              <div class="relative flex items-center justify-center">
                <span class="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-indigo-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
              </div>

              <!-- Main Title & Live Message -->
              <div class="flex items-center gap-2.5 min-w-0">
                <span class="text-xs font-mono font-bold text-indigo-400 uppercase tracking-wider whitespace-nowrap bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                  SSE Live Stream
                </span>
                <span class="text-xs font-bold text-content-primary truncate">
                  {{ report.progressMessage() }}
                </span>
              </div>
            </div>

            <!-- Right: Timer & Percentage -->
            <div class="flex items-center gap-3 flex-shrink-0">
              @if (report.progressHighFitCount() > 0) {
                <span class="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {{ report.progressHighFitCount() }} High Fit
                </span>
              }

              <!-- Elapsed Timer -->
              <span class="text-xs font-mono text-content-muted bg-surface px-2.5 py-1 rounded-md border border-border-subtle inline-flex items-center gap-1.5 shadow-sm">
                <svg lucideClock class="w-3.5 h-3.5 text-content-muted"></svg>
                <span>{{ formattedElapsedTime() }}</span>
              </span>

              <!-- Percentage Pill -->
              <span class="text-xs font-mono font-bold text-white bg-indigo-600 px-2.5 py-0.5 rounded-lg shadow-sm">
                {{ report.progressPercentage() }}%
              </span>
            </div>
          </div>

          <!-- Middle Row: High-Precision Progress Bar -->
          <div class="w-full bg-[#161c2e] h-2 rounded-full overflow-hidden border border-border-subtle/50 relative">
            <div class="h-full rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-indigo-600 via-purple-500 to-emerald-400 relative"
                 [style.width.%]="report.progressPercentage()">
              <!-- Shimmer Effect inside progress bar -->
              <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>

          <!-- Bottom Row: Stepper Breadcrumbs -->
          <div class="flex items-center justify-between text-[11px] font-mono text-content-muted pt-0.5">
            <div class="flex items-center gap-1.5"
                 [ngClass]="isStepActive('STARTING', 'APIFY_RUNNING') ? 'text-indigo-400 font-bold' : (isStepPast('APIFY_RUNNING') ? 'text-emerald-400' : '')">
              @if (isStepPast('APIFY_RUNNING')) {
                <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <svg lucideGlobe class="w-3.5 h-3.5"></svg>
              }
              <span>1. Apify Scraper</span>
            </div>
            <svg lucideArrowRight class="w-3 h-3 text-content-muted/40"></svg>

            <div class="flex items-center gap-1.5"
                 [ngClass]="isStepActive('SCORING') ? 'text-indigo-400 font-bold' : (isStepPast('SCORING') ? 'text-emerald-400' : '')">
              @if (isStepPast('SCORING')) {
                <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <svg lucideCpu class="w-3.5 h-3.5"></svg>
              }
              <span>2. FitScore 0-100</span>
            </div>
            <svg lucideArrowRight class="w-3 h-3 text-content-muted/40"></svg>

            <div class="flex items-center gap-1.5"
                 [ngClass]="isStepActive('PROPOSAL_GENERATION') ? 'text-indigo-400 font-bold' : (isStepPast('PROPOSAL_GENERATION') ? 'text-emerald-400' : '')">
              @if (isStepPast('PROPOSAL_GENERATION')) {
                <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <svg lucideSparkles class="w-3.5 h-3.5 text-amber-400"></svg>
              }
              <span>3. Top 3 Gold (IA)</span>
            </div>
            <svg lucideArrowRight class="w-3 h-3 text-content-muted/40"></svg>

            <div class="flex items-center gap-1.5"
                 [ngClass]="report.progressStep() === 'COMPLETED' ? 'text-emerald-400 font-bold' : ''">
              @if (report.progressStep() === 'COMPLETED') {
                <svg lucideCheckCircle2 class="w-3.5 h-3.5 text-emerald-400"></svg>
              } @else {
                <span class="w-2 h-2 rounded-full bg-content-muted/40 inline-block"></span>
              }
              <span>4. Listo para Despacho</span>
            </div>
          </div>
        </div>
      </div>
    }
  `
})
export class LiveScrapeProgressComponent {
  public readonly report = inject(ReportService);

  public readonly formattedElapsedTime = computed(() => {
    const totalSecs = this.report.elapsedTimeSeconds();
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}s`;
  });

  public isStepActive(...steps: string[]): boolean {
    return steps.includes(this.report.progressStep());
  }

  public isStepPast(step: string): boolean {
    const order = ['STARTING', 'APIFY_RUNNING', 'SCORING', 'PROPOSAL_GENERATION', 'COMPLETED'];
    const currentIdx = order.indexOf(this.report.progressStep());
    const stepIdx = order.indexOf(step);
    return currentIdx > stepIdx;
  }
}
