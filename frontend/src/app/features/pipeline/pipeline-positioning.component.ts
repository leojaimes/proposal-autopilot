import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PipelineStateService } from '../../core/services/pipeline-state.service';

@Component({
  selector: 'app-pipeline-positioning',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Positioning & Voice</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          Bo's two rules for standing out: have one specific offer instead of a generic skill list, and tell stories instead of listing features.
        </p>
      </div>

      <!-- Specific Offer Box -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-content-primary uppercase tracking-wider">01. Your Specific Offer (Transformation, not Job Title)</label>
          <span class="text-[11px] font-mono text-content-muted">{{ pipeline.offerText().length }} chars</span>
        </div>
        <textarea [ngModel]="pipeline.offerText()"
                  (ngModelChange)="pipeline.offerText.set($event)"
                  rows="3"
                  class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-3 text-xs text-content-primary focus:outline-none focus:border-brand-primary leading-relaxed"></textarea>
        <p class="text-[11px] text-content-muted">
          Sell the result: <em>"AI-native UX for product teams delivered at agency speed by pairing 10+ years of Meta/Google craft with AI workflows."</em>
        </p>
      </div>

      <!-- Target Audience -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <label class="text-xs font-semibold text-content-primary uppercase tracking-wider">Who You're Targeting</label>
        <input type="text"
               [ngModel]="pipeline.targetAudience()"
               (ngModelChange)="pipeline.targetAudience.set($event)"
               class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-3 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
      </div>

      <!-- The 6 Proof Stories Grid -->
      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <label class="text-xs font-semibold text-content-primary uppercase tracking-wider">02. Verified Proof Stories (Injected Automatically into High Fit Proposals)</label>
          <span class="text-[11px] text-content-muted font-mono">6 of 6 active</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          @for (story of pipeline.proofStories(); track story.id) {
            <div class="p-4 rounded-xl bg-surface border border-border-subtle hover:border-brand-primary/50 transition-all flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between">
                  <span class="font-bold text-xs text-content-primary">{{ story.company }}</span>
                  <span class="text-[10px] font-mono font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{{ story.metric }}</span>
                </div>
                <p class="text-[11px] text-content-secondary mt-2 leading-relaxed">{{ story.description }}</p>
              </div>
              <div class="flex flex-wrap gap-1 mt-3">
                @for (tag of story.tags; track tag) {
                  <span class="text-[9px] font-mono text-content-muted bg-surface-elevated px-1.5 py-0.5 rounded">{{ tag }}</span>
                }
              </div>
            </div>
          }
        </div>
      </div>

      <!-- Voice Rules Fixed Banner -->
      <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
        <div class="text-xs font-semibold text-content-primary">03. Voice Rules (Enforced by Model System Prompt)</div>
        <div class="grid grid-cols-3 gap-3 text-xs text-content-secondary pt-1">
          <div class="p-2.5 rounded-lg bg-surface border border-border-subtle">
            <span class="font-bold text-content-primary block mb-1">1. Peer-to-Peer</span>
            First person, like talking to another operator, not pitching a client.
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-rose-500/20 bg-rose-500/5">
            <span class="font-bold text-rose-400 block mb-1">2. Zero Em Dashes (—)</span>
            Strictly banned everywhere. Single clearest LLM tell there is.
          </div>
          <div class="p-2.5 rounded-lg bg-surface border border-border-subtle">
            <span class="font-bold text-content-primary block mb-1">3. Result Before Tool</span>
            Sell the transformation the client gets before naming the software.
          </div>
        </div>
      </div>
    </div>
  `
})
export class PipelinePositioningComponent {
  public readonly pipeline = inject(PipelineStateService);
}
