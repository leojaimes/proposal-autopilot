import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';

type SortOption = 'SCORE_DESC' | 'SCORE_ASC' | 'PROPOSALS_ASC' | 'SPEND_DESC';

@Component({
  selector: 'app-job-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-explorer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobExplorerComponent {
  public readonly report = inject(ReportService);

  public readonly searchQuery = signal<string>('');
  public readonly tierFilter = signal<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  public readonly onlyVerifiedPayment = signal<boolean>(false);
  public readonly sortBy = signal<SortOption>('SCORE_DESC');
  public readonly copiedId = signal<string | null>(null);

  public readonly highCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'High').length
  );

  public readonly medCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'Medium').length
  );

  public readonly lowCount = computed(() =>
    this.report.jobs().filter(j => j.fitLabel === 'Low').length
  );

  public readonly filteredJobs = computed(() => {
    let list = this.report.jobs();

    // 1. Filter by Tier
    const tier = this.tierFilter();
    if (tier !== 'ALL') {
      list = list.filter(j => j.fitLabel === tier);
    }

    // 2. Filter by Verified Payment
    if (this.onlyVerifiedPayment()) {
      list = list.filter(j => j.verifiedPayment === 'Yes');
    }

    // 3. Multi-field Search Query
    const q = this.searchQuery().trim().toLowerCase();
    if (q) {
      list = list.filter(j =>
        j.jobTitle.toLowerCase().includes(q) ||
        j.clientCountry.toLowerCase().includes(q) ||
        j.normalizedRole.toLowerCase().includes(q) ||
        j.laneCategory.toLowerCase().includes(q) ||
        j.scoreNotes.toLowerCase().includes(q) ||
        (j.suggestedProofStory && j.suggestedProofStory.toLowerCase().includes(q))
      );
    }

    // 4. Sorting
    const sort = this.sortBy();
    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'SCORE_DESC':
          return b.fitScore - a.fitScore;
        case 'SCORE_ASC':
          return a.fitScore - b.fitScore;
        case 'PROPOSALS_ASC':
          return a.proposalsAlreadyIn - b.proposalsAlreadyIn;
        case 'SPEND_DESC':
          return b.clientTotalSpent - a.clientTotalSpent;
        default:
          return 0;
      }
    });

    return list;
  });

  public copyLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copiedId.set(job.id);
      setTimeout(() => this.copiedId.set(null), 2500);
    });
  }
}
