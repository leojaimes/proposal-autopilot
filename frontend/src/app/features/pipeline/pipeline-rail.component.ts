import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PipelineStateService } from '../../core/services/pipeline-state.service';

@Component({
  selector: 'app-pipeline-rail',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="w-80 flex-shrink-0 bg-surface border-r border-border-subtle flex flex-col h-full select-none">
      <!-- Progress Header (matching screenshot) -->
      <div class="p-5 border-b border-border-subtle">
        <div class="flex items-center justify-between text-xs font-medium text-content-secondary mb-2">
          <span>{{ pipeline.completedCount() }} of {{ pipeline.totalCount() }} done</span>
          <span class="font-mono text-content-primary font-semibold">{{ pipeline.progressPercentage() }}%</span>
        </div>
        <!-- Progress Bar -->
        <div class="w-full h-1.5 bg-surface-elevated rounded-full overflow-hidden">
          <div class="h-full bg-brand-primary transition-all duration-300"
               [style.width.%]="pipeline.progressPercentage()"></div>
        </div>
      </div>

      <!-- Vertical Stepper List (0 to 7) -->
      <nav class="flex-1 overflow-y-auto p-3 space-y-1">
        @for (step of pipeline.steps(); track step.id) {
          <button (click)="pipeline.selectStep(step.id)"
                  class="w-full text-left flex items-start gap-3.5 p-3 rounded-xl transition-all duration-150 group"
                  [ngClass]="{
                    'bg-[#222744] text-white shadow-sm': pipeline.activeStepId() === step.id,
                    'hover:bg-surface-elevated text-content-secondary hover:text-content-primary': pipeline.activeStepId() !== step.id
                  }">
            
            <!-- Step Circle Badge -->
            <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-medium transition-colors mt-0.5"
                 [ngClass]="{
                   'bg-brand-primary text-white': pipeline.activeStepId() === step.id,
                   'bg-surface-elevated text-content-muted group-hover:bg-surface-hover group-hover:text-content-secondary': pipeline.activeStepId() !== step.id
                 }">
              {{ step.id }}
            </div>

            <!-- Title & Subtitle -->
            <div class="flex-1 min-w-0">
              <div class="text-sm font-semibold tracking-tight"
                   [ngClass]="{
                     'text-[#a5b4fc]': pipeline.activeStepId() === step.id,
                     'text-content-primary': pipeline.activeStepId() !== step.id
                   }">
                {{ step.title }}
                <span class="text-xs font-normal opacity-60 ml-1">{{ step.subtitle }}</span>
              </div>
            </div>

            <!-- Checkmark icon if step is completed -->
            @if (step.isCompleted) {
              <svg class="w-4 h-4 text-emerald-400 mt-0.5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
              </svg>
            }
          </button>
        }
      </nav>

      <!-- Bottom Workspace Footer -->
      <div class="p-4 border-t border-border-subtle bg-surface-elevated/40 flex items-center justify-between text-xs text-content-muted">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>Workspace: <strong class="text-content-primary font-mono">personal</strong></span>
        </div>
        <span class="font-mono text-[11px] opacity-70">Docker: 7000</span>
      </div>
    </aside>
  `
})
export class PipelineRailComponent {
  public readonly pipeline = inject(PipelineStateService);
}
