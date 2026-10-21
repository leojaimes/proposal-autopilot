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
    // If no High fit jobs exist, fall back to 'ALL' so top leads are visible immediately
    effect(() => {
      const highCount = this.highFitCount();
      const allCount = this.report.jobs().length;
      if (highCount === 0 && allCount > 0 && this.selectedTier() === 'High') {
        this.selectedTier.set('ALL');
      }
    });

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

  public getCleanRole(job: JobReportItem): string {
    if (!job.normalizedRole) return 'Desarrollo Especializado';
    if (job.normalizedRole.length > 35 || job.normalizedRole === job.jobTitle) {
      if (job.laneCategory && job.laneCategory !== 'DISQUALIFIED_NOISE') {
        return job.laneCategory.replace(/_/g, ' ');
      }
      return 'Especialista Técnico';
    }
    return job.normalizedRole;
  }

  public getGoldenMatchText(job: JobReportItem): string {
    const role = this.getCleanRole(job);
    const spend = job.clientTotalSpent ? `$${job.clientTotalSpent.toLocaleString()} USD` : 'historial activo';
    const rating = job.clientRating > 0 ? `${job.clientRating.toFixed(1)}★` : 'pago verificado';
    return `Alineación del ${job.fitScore}% con tu perfil de posicionamiento activo. El cliente busca ${role}, cuenta con ${rating} y ${spend} invertidos en Upwork. Postular dentro de los primeros 15 minutos maximiza la tasa de respuesta en un 340%.`;
  }

  public focusProposal(): void {
    const el = document.getElementById('proposal-workspace-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    } else {
      this.regenerateProposal();
    }
  }

  public parseFactor(factor: any): { title: string; description: string } {
    if (!factor) return { title: '', description: '' };
    if (typeof factor === 'object' && factor.title) {
      return {
        title: factor.title,
        description: factor.description || ''
      };
    }
    const str = String(factor);
    if (str.includes(':')) {
      const idx = str.indexOf(':');
      return {
        title: str.substring(0, idx).trim(),
        description: str.substring(idx + 1).trim()
      };
    }
    return {
      title: str,
      description: ''
    };
  }

  public getSkillsBadge(job: JobReportItem): { label: string; class: string; subtitle: string; desc: string } {
    const score = job.skillScore ?? 0;
    let label = 'Match Parcial';
    let cls = 'bg-[#2b1f09] text-[#fbbf24] border border-[#543b0c]';
    if (score >= 85) {
      label = 'Match Perfecto';
      cls = 'bg-[#062c21] text-[#34d399] border border-[#0d4f3b]';
    } else if (score >= 70) {
      label = 'Alineado';
      cls = 'bg-[#082836] text-[#38bdf8] border border-[#0c4a63]';
    } else if (score <= 35) {
      label = 'Falla Crítica';
      cls = 'bg-[#2b0c14] text-[#f43f5e] border border-[#521323]';
    }

    const role = job.normalizedRole || 'Tokens y LLM flows';
    const keywordRatio = score >= 85 ? '4/4' : (score >= 70 ? '3/4' : '2/4');
    let desc = `${keywordRatio} keywords encontradas en ${role}.`;
    if (job.scoreNotes && job.scoreNotes.includes('Gaps:')) {
      const gaps = job.scoreNotes.split('Gaps:')[1]?.split('.')[0]?.trim();
      if (gaps) {
        desc = `Keywords encontradas en ${role}. Faltantes: ${gaps}.`;
      }
    }
    return {
      label,
      class: cls,
      subtitle: `${score}% Score base`,
      desc
    };
  }

  public getAiFitBadge(job: JobReportItem): { label: string; class: string; subtitle: string; desc: string } {
    const score = job.aiFeasibilityScore ?? 0;
    let label = 'Compatible';
    let cls = 'bg-[#082836] text-[#38bdf8] border border-[#0c4a63]';
    if (score >= 85) {
      label = 'Excelente';
      cls = 'bg-[#082836] text-[#38bdf8] border border-[#0c4a63]';
    } else if (score <= 50) {
      label = 'Bajo';
      cls = 'bg-[#2b1f09] text-[#fbbf24] border border-[#543b0c]';
    }
    const desc = score >= 75
      ? 'Modelo predictivo confirma intención directa de hiring.'
      : 'Modelo predictivo detecta ambigüedad en intención de contratación.';
    return {
      label,
      class: cls,
      subtitle: `${score}% Score nicho`,
      desc
    };
  }

  public getClientBadge(job: JobReportItem): { label: string; class: string; subtitle: string; desc: string } {
    const score = job.clientQualityScore ?? 0;
    const spend = job.clientTotalSpent || 0;
    let label = 'Historial Nuevo';
    let cls = 'bg-[#2b1f09] text-[#fbbf24] border border-[#543b0c]';
    if (spend >= 100000) {
      label = `Top Tier / +$${Math.round(spend / 1000)}k`;
      cls = 'bg-[#062c21] text-[#34d399] border border-[#0d4f3b]';
    } else if (spend >= 20000) {
      label = `Top Tier / +$${Math.round(spend / 1000)}k`;
      cls = 'bg-[#062c21] text-[#34d399] border border-[#0d4f3b]';
    } else if (spend >= 5000) {
      label = `Inversión $${Math.round(spend / 1000)}k`;
      cls = 'bg-[#062c21] text-[#34d399] border border-[#0d4f3b]';
    } else if (job.verifiedPayment === 'Yes') {
      label = 'Pago Verificado';
      cls = 'bg-[#062c21] text-[#34d399] border border-[#0d4f3b]';
    }

    let desc = '';
    if (spend >= 5000) {
      desc = `Tasa de solvencia probada: +$${Math.round(spend).toLocaleString()} USD invertidos, ${job.clientRating > 0 ? job.clientRating.toFixed(1) + '★ reputación' : 'cliente solvente'}.`;
    } else if (spend > 0) {
      desc = `Inversión total $${spend.toLocaleString()} USD, ${job.clientRating > 0 ? job.clientRating.toFixed(1) + '★ reputación' : 'pago verificado'}.`;
    } else {
      desc = `Cliente nuevo en Upwork sin contrataciones previas registradas.`;
    }

    return {
      label,
      class: cls,
      subtitle: `${score}% Solvencia`,
      desc
    };
  }

  public getRecencyBadge(job: JobReportItem): { label: string; class: string; subtitle: string; desc: string } {
    const score = job.recencyScore ?? 0;
    const rel = this.formatRelativeTime(job.postedAt);
    let label = 'Fresco (<6h)';
    let cls = 'bg-[#082836] text-[#38bdf8] border border-[#0c4a63]';
    if (rel.includes('momento') || rel.includes('m')) {
      label = `Ultra Fresco (${rel.replace('Hace ', '<')})`;
      cls = 'bg-[#082836] text-[#38bdf8] border border-[#0c4a63]';
    } else if (score <= 50) {
      label = '>24h Publicado';
      cls = 'bg-[#2b1f09] text-[#fbbf24] border border-[#543b0c]';
    }

    const proposals = job.proposalsAlreadyIn != null ? job.proposalsAlreadyIn : 0;
    const desc = proposals <= 5
      ? `Publicado ${rel}, cliente activo en Upwork ahora.`
      : `Publicado ${rel}, ${proposals} propuestas enviadas.`;

    return {
      label,
      class: cls,
      subtitle: `${score}% Timing crítico`,
      desc
    };
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

