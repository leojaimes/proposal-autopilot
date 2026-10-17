import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PipelineStateService } from '../../core/services/pipeline-state.service';

@Component({
  selector: 'app-pipeline-overview',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6 max-w-4xl space-y-6">
      <div>
        <h1 class="text-xl font-bold tracking-tight text-content-primary">Overview: The Conversion Engine</h1>
        <p class="text-xs text-content-secondary mt-0.5">
          How this system inverts the traditional Upwork dynamic: from 2% cold spray-and-pray to 40% peer-to-peer close rate.
        </p>
      </div>

      <!-- Comparison Cards -->
      <div class="grid grid-cols-2 gap-4">
        <!-- Generic Freelancer -->
        <div class="p-5 rounded-xl bg-surface border border-rose-500/20 bg-rose-500/5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-rose-400">The 2% Trap: Generic Bidding</span>
            <span class="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded">Typical Flaw</span>
          </div>
          <ul class="text-xs text-content-secondary space-y-2 leading-relaxed">
            <li>❌ 300+ word generic cover letter listing 25 different tools.</li>
            <li>❌ "Dear Hiring Manager, I am writing to express my interest..."</li>
            <li>❌ Bids on any job matching keywords, burning Connects on $15 tasks.</li>
            <li>❌ Arrives 18 hours late on page 3 of client bids.</li>
          </ul>
        </div>

        <!-- Proposal Autopilot -->
        <div class="p-5 rounded-xl bg-surface border border-emerald-500/20 bg-emerald-500/5 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-emerald-400">The 40% Engine: Proposal Autopilot</span>
            <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Our System</span>
          </div>
          <ul class="text-xs text-content-secondary space-y-2 leading-relaxed">
            <li>✅ <strong>35-word peer-to-peer letter</strong> focused on client transformation.</li>
            <li>✅ Injects a verified <strong>Proof Story</strong> (Cisco $40B, Meta 25% dev cut).</li>
            <li>✅ <strong>Hard Cap at 44</strong>: eliminates 60% of noise with zero Connects wasted.</li>
            <li>✅ Arrives within 15 minutes of posting (Top 3 proposals).</li>
          </ul>
        </div>
      </div>

      <!-- The 8-Step Pipeline Map -->
      <div class="p-5 rounded-xl bg-surface border border-border-subtle space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-content-primary uppercase tracking-wider">The 8-Stage Operating Architecture</span>
          <span class="text-xs font-mono text-brand-primary">Progress: {{ pipeline.progressPercentage() }}%</span>
        </div>
        <div class="grid grid-cols-4 gap-3 pt-2">
          @for (step of pipeline.steps(); track step.id) {
            <button (click)="pipeline.selectStep(step.id)"
                    class="p-3 rounded-lg border border-border-subtle text-left bg-surface-elevated/40 hover:bg-surface-elevated transition-all group">
              <div class="text-[10px] font-mono font-bold text-brand-primary group-hover:underline">Step {{ step.id }}</div>
              <div class="text-xs font-bold text-content-primary mt-1">{{ step.title }}</div>
              <div class="text-[11px] text-content-muted mt-0.5">{{ step.subtitle }}</div>
            </button>
          }
        </div>
      </div>
    </div>
  `
})
export class PipelineOverviewComponent {
  public readonly pipeline = inject(PipelineStateService);
}
