import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-job-card-skeleton',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-2 p-2 select-none animate-pulse">
      @for (item of [1, 2, 3, 4]; track item) {
        <div class="p-3.5 rounded-xl bg-[#111522]/70 border border-border-subtle/40 space-y-3 relative overflow-hidden">
          <!-- Top Shimmer Row -->
          <div class="flex items-center justify-between">
            <div class="h-5 w-24 bg-white/10 rounded-md"></div>
            <div class="h-5 w-16 bg-white/10 rounded"></div>
          </div>

          <!-- Title Lines -->
          <div class="space-y-1.5">
            <div class="h-3.5 w-full bg-white/10 rounded"></div>
            <div class="h-3.5 w-3/4 bg-white/10 rounded"></div>
          </div>

          <!-- Footer Meta -->
          <div class="flex items-center justify-between pt-2 border-t border-white/[0.04]">
            <div class="h-3 w-28 bg-white/5 rounded"></div>
            <div class="h-3 w-16 bg-white/5 rounded"></div>
          </div>
        </div>
      }
    </div>
  `
})
export class JobCardSkeletonComponent {}
