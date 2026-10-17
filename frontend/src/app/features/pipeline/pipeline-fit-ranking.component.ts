import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PipelineStateService } from '../../core/services/pipeline-state.service';

@Component({
  selector: 'app-pipeline-fit-ranking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Fit Ranking Engine</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          Deterministic 4-factor scoring model (40/25/20/15) + Hard Safety Guardrail Cap at 44.
        </p>
      </div>

      <!-- Sliders Row -->
      <div class="grid grid-cols-4 gap-4">
        <!-- Skill Match -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="text-content-secondary font-medium">Skill Match</span>
            <span class="font-mono font-bold text-brand-primary text-sm">{{ pipeline.weightSkill() }}%</span>
          </div>
          <input type="range" min="10" max="60"
                 [ngModel]="pipeline.weightSkill()"
                 (ngModelChange)="pipeline.weightSkill.set($event)"
                 class="w-full accent-indigo-500">
          <p class="text-[10px] text-content-muted">Checked against your 16 verified design & research skills.</p>
        </div>

        <!-- AI Feasibility -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="text-content-secondary font-medium">AI Feasibility</span>
            <span class="font-mono font-bold text-brand-primary text-sm">{{ pipeline.weightAi() }}%</span>
          </div>
          <input type="range" min="10" max="40"
                 [ngModel]="pipeline.weightAi()"
                 (ngModelChange)="pipeline.weightAi.set($event)"
                 class="w-full accent-indigo-500">
          <p class="text-[10px] text-content-muted">Feasibility of 1-day delivery with Figma Make/agentic tools.</p>
        </div>

        <!-- Client Quality -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="text-content-secondary font-medium">Client Quality</span>
            <span class="font-mono font-bold text-brand-primary text-sm">{{ pipeline.weightClient() }}%</span>
          </div>
          <input type="range" min="10" max="40"
                 [ngModel]="pipeline.weightClient()"
                 (ngModelChange)="pipeline.weightClient.set($event)"
                 class="w-full accent-indigo-500">
          <p class="text-[10px] text-content-muted">Total spend, payment verified, rating & low bid count.</p>
        </div>

        <!-- Recency -->
        <div class="p-4 rounded-xl bg-surface border border-border-subtle space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="text-content-secondary font-medium">Recency</span>
            <span class="font-mono font-bold text-brand-primary text-sm">{{ pipeline.weightRecency() }}%</span>
          </div>
          <input type="range" min="5" max="30"
                 [ngModel]="pipeline.weightRecency()"
                 (ngModelChange)="pipeline.weightRecency.set($event)"
                 class="w-full accent-indigo-500">
          <p class="text-[10px] text-content-muted">Decay algorithm: first 15 proposals window.</p>
        </div>
      </div>

      <!-- The Cap Rule Visual Card -->
      <div class="p-5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-4">
        <div class="w-8 h-8 rounded-lg bg-rose-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 mt-0.5">
          🛡️
        </div>
        <div>
          <div class="text-sm font-bold text-rose-400">The Hard Guardrail: CAPPED at 44 (Low Fit)</div>
          <p class="text-xs text-content-secondary mt-1 leading-relaxed">
            Even if a client has spent <strong>$448,000 USD</strong> with 5-star rating, if their job requires teaching a course or manual QA (Skill Score &lt; 40), the engine <strong>freezes their score at 44</strong>. This protects your Connects budget and prevents applying to irrelevant noise.
          </p>
        </div>
      </div>
    </div>
  `
})
export class PipelineFitRankingComponent {
  public readonly pipeline = inject(PipelineStateService);
}
