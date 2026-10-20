import { Component, ChangeDetectionStrategy, inject, signal, computed, effect, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';
import {
  LucideZap,
  LucideSparkles,
  LucideTarget,
  LucideBot,
  LucideGem,
  LucideClock,
  LucideTriangleAlert,
  LucideScale,
  LucideLightbulb,
  LucideShieldAlert,
  LucideShieldCheck,
  LucideCircleCheck,
  LucideCheck,
  LucideCopy,
  LucideRefreshCw,
  LucideFileDown,
  LucideLayers,
  LucideExternalLink,
  LucideSearch,
  LucideMapPin,
  LucideStar,
  LucideRocket,
} from '@lucide/angular';
import { MermaidViewerComponent } from '../../shared/components/mermaid-viewer/mermaid-viewer.component';
import { JobCardSkeletonComponent } from './job-card-skeleton.component';

@Component({
  selector: 'app-dispatch-terminal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MermaidViewerComponent,
    JobCardSkeletonComponent,
    LucideZap,
    LucideSparkles,
    LucideTarget,
    LucideBot,
    LucideGem,
    LucideClock,
    LucideTriangleAlert,
    LucideScale,
    LucideLightbulb,
    LucideShieldAlert,
    LucideShieldCheck,
    LucideCircleCheck,
    LucideCheck,
    LucideCopy,
    LucideRefreshCw,
    LucideFileDown,
    LucideLayers,
    LucideExternalLink,
    LucideSearch,
    LucideMapPin,
    LucideStar,
    LucideRocket,
  ],
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

  /**
   * Keyboard Shortcuts HostListener (Stitch Cockpit Specification)
   * J/K: Navigate jobs in triage feed
   * D: Discard current lead (Save 16 Connects)
   * G: Generate/Regenerate proposal with Gemini
   * C: Copy 35-word cover letter to clipboard
   * /: Focus search input
   */
  @HostListener('window:keydown', ['$event'])
  public handleKeyboardEvent(event: KeyboardEvent): void {
    const activeEl = document.activeElement;
    const tagName = activeEl?.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
      if (event.key === 'Escape') {
        (activeEl as HTMLElement)?.blur();
      }
      return;
    }

    const key = event.key.toLowerCase();

    if (key === 'j' || event.key === 'ArrowDown') {
      event.preventDefault();
      this.selectNextJob();
    } else if (key === 'k' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.selectPreviousJob();
    } else if (key === 'd') {
      event.preventDefault();
      this.discardCurrentJob();
    } else if (key === 'g') {
      event.preventDefault();
      this.regenerateProposal();
    } else if (key === 'c') {
      const current = this.selectedJob();
      if (current?.coverLetter) {
        event.preventDefault();
        this.copyLetter(current);
      }
    } else if (key === '/') {
      event.preventDefault();
      const searchEl = document.getElementById('cockpit-search-input');
      searchEl?.focus();
    }
  }

  public selectNextJob(): void {
    const jobs = this.filteredJobs();
    if (jobs.length === 0) return;
    const current = this.selectedJob();
    if (!current) {
      this.selectJob(jobs[0]);
      return;
    }
    const idx = jobs.findIndex(j => j.id === current.id);
    if (idx >= 0 && idx < jobs.length - 1) {
      this.selectJob(jobs[idx + 1]);
    }
  }

  public selectPreviousJob(): void {
    const jobs = this.filteredJobs();
    if (jobs.length === 0) return;
    const current = this.selectedJob();
    if (!current) {
      this.selectJob(jobs[0]);
      return;
    }
    const idx = jobs.findIndex(j => j.id === current.id);
    if (idx > 0) {
      this.selectJob(jobs[idx - 1]);
    }
  }

  public discardCurrentJob(): void {
    const current = this.selectedJob();
    if (!current) return;
    this.report.updateJobStatus(current.id, 'SKIPPED');
    this.successBanner.set(`Lead marcado como Descartado (Ahorro de 16 Connects).`);
    setTimeout(() => this.successBanner.set(''), 3500);
    this.selectNextJob();
  }

  public approveCurrentJob(): void {
    const current = this.selectedJob();
    if (!current) return;
    this.report.updateJobStatus(current.id, 'APPROVED');
    this.successBanner.set(`Lead marcado como Aprobado para postulación.`);
    setTimeout(() => this.successBanner.set(''), 3500);
  }

  /**
   * SVG Circular Tachometer Gauge Offset Calculator
   * Circumference for r=32 is ~201
   */
  public getGaugeOffset(score: number): number {
    const clamped = Math.max(0, Math.min(100, score || 0));
    return Math.round(201 * (1 - clamped / 100));
  }

  public selectJob(job: JobReportItem): void {
    this.selectedJob.set(job);
    const initialKey = job.suggestedProofStory && job.suggestedProofStory !== 'NONE'
      ? job.suggestedProofStory
      : (this.report.proofStories()[0]?.keyCode || 'PEPPER_AI');
    this.selectedProofStoryKey.set(initialKey);
  }

  public copyLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copied.set(true);
      this.successBanner.set('📋 Carta de 35 palabras copiada al portapapeles.');
      setTimeout(() => {
        this.copied.set(false);
        this.successBanner.set('');
      }, 3000);
    });
  }

  public toggleRoadmap(): void {
    this.showRoadmap.update(v => !v);
  }

  public toggleTechnicalProposal(): void {
    this.showTechnicalProposal.update(v => !v);
  }

  public formatRelativeTime(postedAt?: string | null): string {
    if (!postedAt) return 'Fecha no disponible';
    const time = new Date(postedAt).getTime();
    if (isNaN(time)) return 'Fecha no disponible';
    const now = Date.now();
    const diffMs = Math.max(0, now - time);
    const diffMin = Math.floor(diffMs / (1000 * 60));
    if (diffMin < 1) return 'Hace un momento';
    if (diffMin < 60) return `Hace ${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Hace 1 día';
    return `Hace ${diffDays} días`;
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

          this.successBanner.set('✨ Propuesta y Roadmap generados exitosamente con IA (Gemini 3.8 Flash).');
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

