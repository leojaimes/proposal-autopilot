import { Injectable, inject, signal, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, catchError, of, tap } from 'rxjs';
import { JobReportItem } from '../models/pipeline.model';
import { PipelineStateService } from './pipeline-state.service';

export interface ScrapingProgressEvent {
  batchId: string;
  tenantId?: string;
  step: 'STARTING' | 'APIFY_RUNNING' | 'SCORING' | 'PROPOSAL_GENERATION' | 'COMPLETED' | 'ERROR';
  message: string;
  percentage: number;
  currentJobIndex?: number;
  totalJobs?: number;
  currentJobTitle?: string;
  highFitCount?: number;
  mediumFitCount?: number;
  radarRebuildStatus?: 'QUEUED' | 'COMPLETED' | 'FAILED';
  radarSnapshotUpdated?: boolean;
  radarRevision?: number;
  error?: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly pipeline = inject(PipelineStateService);
  private readonly baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? '/api/scraping'
    : 'http://localhost:7000/api/scraping';

  // State Signals
  private readonly _jobs = signal<JobReportItem[]>([]);
  public readonly jobs = this._jobs.asReadonly();

  private readonly _isLoading = signal<boolean>(false);
  public readonly isLoading = this._isLoading.asReadonly();

  private readonly _isScrapingInProgress = signal<boolean>(false);
  public readonly isScrapingInProgress = this._isScrapingInProgress.asReadonly();

  private readonly _lastRefreshed = signal<Date>(new Date());
  public readonly lastRefreshed = this._lastRefreshed.asReadonly();

  // SSE Real-Time Progress Signals
  public readonly activeBatchId = signal<string | null>(null);
  public readonly progressPercentage = signal<number>(0);
  public readonly progressStep = signal<string>('');
  public readonly progressMessage = signal<string>('');
  public readonly progressCurrentJob = signal<string>('');
  public readonly progressHighFitCount = signal<number>(0);
  public readonly elapsedTimeSeconds = signal<number>(0);
  public readonly hasCompletedSuccessfully = signal<boolean>(false);

  // Incremented when a completed batch has rebuilt the persisted Market Radar snapshot.
  private readonly _marketRadarRefreshVersion = signal<number>(0);
  public readonly marketRadarRefreshVersion = this._marketRadarRefreshVersion.asReadonly();
  public readonly currentRadarRevision = signal<number | null>(null);

  // Tri-Factor Positioning State
  public readonly offerHeadline = signal<string>('');
  public readonly targetAudience = signal<string>('');
  public readonly proofStories = signal<{ id: string; keyCode: string; companyOrProduct: string; impactMetric: string; domainTags: string[] }[]>([]);

  // Event streams & timers
  private readonly refreshTrigger$ = new Subject<void>();
  private eventSource: EventSource | null = null;
  private timerInterval: any = null;

  constructor() {
    // Reactive Refresh Pipeline con perfil activo
    this.refreshTrigger$
      .pipe(
        tap(() => this._isLoading.set(true)),
        switchMap(() => {
          const personaName = this.pipeline.activeProfile()?.name || '';
          const url = personaName
            ? `${this.baseUrl}/report?personaName=${encodeURIComponent(personaName)}`
            : `${this.baseUrl}/report`;

          return this.http.get<JobReportItem[]>(url).pipe(
            catchError((err) => {
              console.error('Failed to fetch job report', err);
              return of([]);
            })
          );
        })
      )
      .subscribe((data) => {
        this._jobs.set(data);
        this._isLoading.set(false);
        this._lastRefreshed.set(new Date());
      });

    // Auto-refresh reactivo cuando el usuario cambia de perfil en el header
    effect(() => {
      const active = this.pipeline.activeProfile();
      if (active) {
        this.refresh();
        this.fetchProofStories(active.name);
      }
    });
  }

  public fetchProofStories(personaName?: string): void {
    const persona = personaName || this.pipeline.activeProfile()?.name || '';
    const url = persona
      ? `${this.baseUrl}/proof-stories?personaName=${encodeURIComponent(persona)}`
      : `${this.baseUrl}/proof-stories`;

    this.http.get<{ offerHeadline: string; targetAudience: string; proofStories: any[] }>(url)
      .pipe(
        catchError((err) => {
          console.error('Failed to fetch proof stories', err);
          return of({ offerHeadline: '', targetAudience: '', proofStories: [] });
        })
      )
      .subscribe((res) => {
        this.offerHeadline.set(res.offerHeadline);
        this.targetAudience.set(res.targetAudience);
        this.proofStories.set(res.proofStories || []);
      });
  }

  /**
   * Dispara la extracción asíncrona y abre el canal de streaming SSE en vivo
   */
  public triggerLiveScrape(limit = 30, keywords?: string[]): void {
    if (this._isScrapingInProgress()) return;

    this._isScrapingInProgress.set(true);
    this.progressPercentage.set(5);
    this.progressStep.set('STARTING');
    this.progressMessage.set('Iniciando extracción con palabras clave del calibrador...');
    this.progressCurrentJob.set('');
    this.progressHighFitCount.set(0);
    this.elapsedTimeSeconds.set(0);
    this.hasCompletedSuccessfully.set(false);

    // Iniciar cronómetro de tiempo transcurrido
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.elapsedTimeSeconds.update(s => s + 1);
    }, 1000);

    // POST asíncrono con las palabras clave prioritarias del perfil
    const payload: { maxResults: number; keywords?: string[] } = { maxResults: limit };
    if (keywords && keywords.length > 0) {
      payload.keywords = keywords;
    }

    this.http.post<{ success: boolean; batchId: string }>(`${this.baseUrl}/trigger`, payload)
      .pipe(
        catchError((err) => {
          console.error('Fallo iniciando batch:', err);
          this.stopScrapingState('Error conectando con el servidor.');
          return of(null);
        })
      )
      .subscribe((res) => {
        if (!res || !res.batchId) {
          this.stopScrapingState('No se pudo inicializar el lote de extracción.');
          return;
        }

        this.activeBatchId.set(res.batchId);
        this.connectToSseStream(res.batchId);
      });
  }

  /**
   * Establece la conexión SSE con el backend para recibir eventos segundo a segundo
   */
  private connectToSseStream(batchId: string): void {
    if (this.eventSource) {
      this.eventSource.close();
    }

    const sseUrl = `${this.baseUrl}/progress/${batchId}`;
    this.eventSource = new EventSource(sseUrl);

    this.eventSource.onmessage = (event) => {
      try {
        const data: ScrapingProgressEvent = JSON.parse(event.data);
        this.handleProgressEvent(data);
      } catch (err) {
        console.error('Error parseando evento SSE:', err);
      }
    };

    this.eventSource.onerror = (err) => {
      console.warn('Conexión SSE reconectando o cerrada...', err);
      if (this.progressPercentage() >= 100) {
        this.closeEventSource();
      }
    };
  }

  private handleProgressEvent(data: ScrapingProgressEvent): void {
    this.progressPercentage.set(data.percentage);
    this.progressStep.set(data.step);
    this.progressMessage.set(data.message);
    if (data.currentJobTitle) {
      this.progressCurrentJob.set(data.currentJobTitle);
    }
    if (data.highFitCount !== undefined) {
      this.progressHighFitCount.set(data.highFitCount);
    }

    if (data.radarRevision != null) {
      this.currentRadarRevision.set(data.radarRevision);
    }

    if (data.radarSnapshotUpdated) {
      this._marketRadarRefreshVersion.update((version) => version + 1);
    }

    if (data.step === 'COMPLETED') {
      this.hasCompletedSuccessfully.set(true);
      this._marketRadarRefreshVersion.update((version) => version + 1);
      this.refresh(); // Refresco reactivo automático de la lista de vacantes
      this.closeEventSource();
      if (this.timerInterval) clearInterval(this.timerInterval);

      // Mantener feedback visual de éxito 4.5 segundos antes de ocultar el banner
      setTimeout(() => {
        this._isScrapingInProgress.set(false);
      }, 4500);
    } else if (data.step === 'ERROR') {
      this.stopScrapingState(data.message || 'Error en el proceso de extracción.');
    }
  }

  private stopScrapingState(errorMsg?: string): void {
    this.closeEventSource();
    if (this.timerInterval) clearInterval(this.timerInterval);
    if (errorMsg) {
      this.progressMessage.set(errorMsg);
      this.progressStep.set('ERROR');
    }
    setTimeout(() => {
      this._isScrapingInProgress.set(false);
    }, 4000);
  }

  private closeEventSource(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  public regenerateProposal(jobId: string, proofStoryKey?: string) {
    const personaName = this.pipeline.activeProfile()?.name || '';
    return this.http.post<any>(`${this.baseUrl}/jobs/${jobId}/regenerate-proposal`, {
      proofStoryKey,
      personaName,
    }).pipe(
      tap((res) => {
        if (res.success) {
          this._jobs.update((list) =>
            list.map((j) => {
              if (j.id === jobId) {
                return {
                  ...j,
                  coverLetter: res.coverLetter,
                  contactNameFound: res.contactNameFound,
                  mermaidCode: res.mermaidCode,
                  technicalProposal: res.technicalProposal,
                  suggestedProofStory: res.suggestedProofStory,
                  proposalDocLink: res.proposalDocLink,
                };
              }
              return j;
            })
          );
        }
      })
    );
  }

  public refresh(): void {
    this.refreshTrigger$.next();
  }

  public updateJobStatus(jobId: string, status: string): void {
    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = personaName
      ? `${this.baseUrl}/jobs/${jobId}/status?personaName=${encodeURIComponent(personaName)}`
      : `${this.baseUrl}/jobs/${jobId}/status`;

    this.http.patch(url, { status })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this._jobs.update(list =>
          list.map(j => j.id === jobId ? { ...j, status: status as any } : j)
        );
      });
  }

  public downloadCsv(): void {
    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = personaName
      ? `${this.baseUrl}/report/csv?personaName=${encodeURIComponent(personaName)}`
      : `${this.baseUrl}/report/csv`;
    window.open(url, '_blank');
  }

  public isReprocessing = signal<boolean>(false);
  public reprocessMessage = signal<string | null>(null);

  public reprocessLeads() {
    this.isReprocessing.set(true);
    this.reprocessMessage.set('Re-evaluando vacantes con tu perfil actual...');
    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = personaName
      ? `${this.baseUrl}/reprocess?personaName=${encodeURIComponent(personaName)}`
      : `${this.baseUrl}/reprocess`;

    return this.http.post<{ success: boolean; reprocessedCount: number; top3GoldGenerated: number; message: string }>(url, {}).pipe(
      tap((res) => {
        this.isReprocessing.set(false);
        this.reprocessMessage.set(res.message);
        this.refresh();
        setTimeout(() => this.reprocessMessage.set(null), 5000);
      }),
      catchError((err) => {
        this.isReprocessing.set(false);
        this.reprocessMessage.set('Error re-procesando vacantes.');
        setTimeout(() => this.reprocessMessage.set(null), 5000);
        return of({ success: false, reprocessedCount: 0, top3GoldGenerated: 0, message: err.message });
      })
    );
  }

  public downloadTechnicalProposalPdf(jobId: string, jobTitle?: string) {
    const personaName = this.pipeline.activeProfile()?.name || '';
    const url = personaName
      ? `${this.baseUrl}/jobs/${jobId}/technical-proposal-pdf?personaName=${encodeURIComponent(personaName)}`
      : `${this.baseUrl}/jobs/${jobId}/technical-proposal-pdf`;

    return this.http.get(url, {
      responseType: 'blob',
    }).pipe(
      tap((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        const cleanTitle = (jobTitle || 'Technical_Proposal')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .substring(0, 45);
        a.download = `Strategic_Proposal_${cleanTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
      })
    );
  }
}
