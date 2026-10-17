import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-zero-state-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zero-state-onboarding.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZeroStateOnboardingComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);
  private readonly http = inject(HttpClient);

  public readonly isLoadingPreset = signal<boolean>(false);

  public triggerLiveScrape(): void {
    this.report.triggerLiveScrape(15);
  }

  public restoreBoPreset(): void {
    this.isLoadingPreset.set(true);
    this.http.post('http://localhost:7000/api/scraping/restore-preset', {})
      .subscribe({
        next: () => {
          this.isLoadingPreset.set(false);
          this.report.refresh();
        },
        error: () => {
          this.isLoadingPreset.set(false);
          // Fallback to live scrape
          this.report.triggerLiveScrape(15);
        }
      });
  }
}
