import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';

@Component({
  selector: 'app-dispatch-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dispatch-terminal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DispatchTerminalComponent {
  public readonly report = inject(ReportService);

  public readonly selectedTier = signal<'ALL' | 'High' | 'Low'>('High'); // High Fit active by default!
  public readonly searchTerm = signal<string>('');
  public readonly selectedJob = signal<JobReportItem | null>(null);
  public readonly copied = signal<boolean>(false);
  public readonly showRoadmap = signal<boolean>(true);

  public readonly highFitCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'High').length
  );

  public readonly lowFitCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'Low').length
  );

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

  constructor() {
    // Auto-select first High Fit job when data loads
    const initialJobs = this.report.jobs();
    const firstHigh = initialJobs.find(j => j.fitLabel === 'High') || initialJobs[0];
    if (firstHigh) {
      this.selectedJob.set(firstHigh);
    }
  }

  public selectJob(job: JobReportItem): void {
    this.selectedJob.set(job);
  }

  public copyLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2500);
    });
  }

  public toggleRoadmap(): void {
    this.showRoadmap.update(v => !v);
  }
}
