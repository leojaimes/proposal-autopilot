import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';
import { MermaidViewerComponent } from '../../shared/components/mermaid-viewer/mermaid-viewer.component';

@Component({
  selector: 'app-dispatch-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, MermaidViewerComponent],
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
  public readonly showTechnicalProposal = signal<boolean>(false);
  public readonly isRegenerating = signal<boolean>(false);
  public readonly selectedProofStoryKey = signal<string>('');
  public readonly successBanner = signal<string>('');

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
    // Reactive auto-select: whenever filteredJobs() updates, ensure the top job is selected
    effect(() => {
      const jobs = this.filteredJobs();
      const current = this.selectedJob();
      if (jobs.length > 0 && (!current || !jobs.some(j => j.id === current.id))) {
        this.selectJob(jobs[0]);
      }
    });
  }

  public selectJob(job: JobReportItem): void {
    this.selectedJob.set(job);
    // Sync proof story key to suggested or first available
    const initialKey = job.suggestedProofStory && job.suggestedProofStory !== 'NONE'
      ? job.suggestedProofStory
      : (this.report.proofStories()[0]?.keyCode || 'PEPPER_AI');
    this.selectedProofStoryKey.set(initialKey);
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

  public toggleTechnicalProposal(): void {
    this.showTechnicalProposal.update(v => !v);
  }

  public getWordCount(text?: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(Boolean).length;
  }

  public regenerateProposal(): void {
    const current = this.selectedJob();
    if (!current || this.isRegenerating()) return;

    this.isRegenerating.set(true);
    this.successBanner.set('');

    const key = this.selectedProofStoryKey() || current.suggestedProofStory;
    this.report.regenerateProposal(current.id, key).subscribe({
      next: (res) => {
        this.isRegenerating.set(false);
        if (res.success) {
          this.selectedJob.update(j => j ? {
            ...j,
            coverLetter: res.coverLetter,
            contactNameFound: res.contactNameFound,
            mermaidCode: res.mermaidCode,
            technicalProposal: res.technicalProposal,
            suggestedProofStory: res.suggestedProofStory,
            proposalDocLink: res.proposalDocLink,
          } : null);

          this.successBanner.set('✨ Propuesta y Roadmap regenerados exitosamente con IA (Gemini 3.8 Flash).');
          setTimeout(() => this.successBanner.set(''), 4500);
        }
      },
      error: (err) => {
        console.error('Error al regenerar propuesta:', err);
        this.isRegenerating.set(false);
      }
    });
  }

  public readonly isDownloadingPdf = signal<boolean>(false);

  public downloadPdf(job: JobReportItem): void {
    if (!job || !job.id || this.isDownloadingPdf()) return;
    this.isDownloadingPdf.set(true);
    this.report.downloadTechnicalProposalPdf(job.id, job.jobTitle).subscribe({
      next: () => {
        this.isDownloadingPdf.set(false);
      },
      error: (err) => {
        console.error('Error al descargar PDF:', err);
        this.isDownloadingPdf.set(false);
      }
    });
  }
}
