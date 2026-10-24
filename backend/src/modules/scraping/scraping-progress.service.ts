import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

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
  classificationStatus?: 'QUEUED' | 'COMPLETED' | 'FAILED';
  classificationQueued?: number;
  classificationCompleted?: number;
  classificationFailed?: number;
  radarRebuildStatus?: 'QUEUED' | 'COMPLETED' | 'FAILED';
  radarSnapshotUpdated?: boolean;
  radarRevision?: number;
  error?: string;
  timestamp: string;
}

@Injectable()
export class ScrapingProgressService {
  private readonly logger = new Logger(ScrapingProgressService.name);

  // ReplaySubject(1) garantiza que el cliente reciba el último estado inmediatamente al conectarse vía SSE
  private readonly batchSubjects = new Map<string, ReplaySubject<ScrapingProgressEvent>>();
  private readonly latestEvents = new Map<string, ScrapingProgressEvent>();
  private readonly activeTenantBatches = new Map<string, string>();

  /**
   * Emite un evento de progreso para un batchId específico
   */
  emitProgress(eventData: Omit<ScrapingProgressEvent, 'timestamp'>): void {
    const fullEvent: ScrapingProgressEvent = {
      ...eventData,
      timestamp: new Date().toISOString(),
    };

    this.latestEvents.set(fullEvent.batchId, fullEvent);
    if (fullEvent.tenantId) {
      this.activeTenantBatches.set(fullEvent.tenantId, fullEvent.batchId);
    }

    let subject = this.batchSubjects.get(fullEvent.batchId);
    if (!subject) {
      subject = new ReplaySubject<ScrapingProgressEvent>(1);
      this.batchSubjects.set(fullEvent.batchId, subject);
    }

    subject.next(fullEvent);
    this.logger.debug(`[SSE ${fullEvent.batchId}] ${fullEvent.percentage}% - ${fullEvent.step}: ${fullEvent.message}`);

    // Si terminó o falló, programar limpieza de memoria tras 10 minutos
    if (fullEvent.step === 'COMPLETED' || fullEvent.step === 'ERROR') {
      setTimeout(() => {
        this.batchSubjects.delete(fullEvent.batchId);
        this.latestEvents.delete(fullEvent.batchId);
      }, 10 * 60 * 1000);
    }
  }

  /**
   * Retorna el Observable de MessageEvent compatible con el decorador @Sse() de NestJS
   */
  getProgressStream(batchId: string): Observable<MessageEvent> {
    let subject = this.batchSubjects.get(batchId);
    if (!subject) {
      subject = new ReplaySubject<ScrapingProgressEvent>(1);
      this.batchSubjects.set(batchId, subject);

      // Si no hay evento previo, emitir estado inicial
      const initial: ScrapingProgressEvent = {
        batchId,
        step: 'STARTING',
        message: 'Conectando con el motor de extracción...',
        percentage: 0,
        timestamp: new Date().toISOString(),
      };
      subject.next(initial);
    }

    return subject.asObservable().pipe(
      map((evt: ScrapingProgressEvent) => ({
        data: evt,
      } as MessageEvent))
    );
  }

  /**
   * Obtiene el stream para el batch activo de un tenant
   */
  getTenantProgressStream(tenantId: string): Observable<MessageEvent> {
    const activeBatchId = this.activeTenantBatches.get(tenantId);
    if (activeBatchId) {
      return this.getProgressStream(activeBatchId);
    }

    const fallbackSubject = new ReplaySubject<ScrapingProgressEvent>(1);
    fallbackSubject.next({
      batchId: 'none',
      tenantId,
      step: 'STARTING',
      message: 'Sin extracciones activas',
      percentage: 0,
      timestamp: new Date().toISOString(),
    });

    return fallbackSubject.asObservable().pipe(
      map((evt) => ({ data: evt } as MessageEvent))
    );
  }

  /**
   * Retorna el último evento emitido para un batchId
   */
  getLatestEvent(batchId: string): ScrapingProgressEvent | undefined {
    return this.latestEvents.get(batchId);
  }
}
