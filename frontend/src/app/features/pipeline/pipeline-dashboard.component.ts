import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';

import { LucideCopy, LucideCheck } from '@lucide/angular';

@Component({
  selector: 'app-pipeline-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideCopy, LucideCheck],
  templateUrl: './pipeline-dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineDashboardComponent {
  public readonly report = inject(ReportService);
  public readonly selectedTier = signal<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  public readonly searchTerm = signal<string>('');
  public readonly copiedJobId = signal<string | null>(null);

  public readonly highFitCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'High').length
  );

  public readonly medFitCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'Medium').length
  );

  public readonly lowFitCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'Low').length
  );

  public readonly connectsSaved = computed(() =>
    this.lowFitCount() * 16
  );

  public readonly dollarsSaved = computed(() =>
    (this.lowFitCount() * 16 * 0.15).toFixed(2)
  );

  public formatSpend(amount: number): string {
    return '$' + (amount / 1000).toFixed(0) + 'k spent';
  }

  public readonly filteredJobs = computed(() => {
    let list = this.report.jobs();
    const tier = this.selectedTier();
    if (tier !== 'ALL') {
      list = list.filter(j => j.fitLabel === tier);
    }
    const q = this.searchTerm().trim().toLowerCase();
    if (q) {
      list = list.filter(j =>
        j.jobTitle.toLowerCase().includes(q) ||
        j.clientCountry.toLowerCase().includes(q) ||
        j.normalizedRole.toLowerCase().includes(q)
      );
    }
    return list;
  });

  public copyCoverLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copiedJobId.set(job.id);
      setTimeout(() => this.copiedJobId.set(null), 2500);
    });
  }
}
