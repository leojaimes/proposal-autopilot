import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { Observable, ReplaySubject } from 'rxjs';
import { map } from 'rxjs/operators';

export type ProspectingStreamEventType =
  | 'RADAR_HEARTBEAT'
  | 'CACHE_BURST'
  | 'LEAD_ARRIVED'
  | 'SCAN_FINISHED'
  | 'SCAN_ERROR';

export interface ProspectingStreamEvent {
  scanId: string;
  tenantId?: string;
  type: ProspectingStreamEventType;
  message: string;
  progressPct: number;
  lead?: Record<string, any>;
  leads?: Record<string, any>[];
  leadIndex?: number;
  totalLeads?: number;
  pipelineUsd?: number;
  fromCache?: boolean;
  error?: string;
  timestamp: string;
}

@Injectable()
export class ProspectingStreamService {
  private readonly logger = new Logger(ProspectingStreamService.name);
  private readonly scanSubjects = new Map<string, ReplaySubject<ProspectingStreamEvent>>();

  private getOrCreateSubject(scanId: string): ReplaySubject<ProspectingStreamEvent> {
    let subject = this.scanSubjects.get(scanId);
    if (!subject) {
      subject = new ReplaySubject<ProspectingStreamEvent>(10);
      this.scanSubjects.set(scanId, subject);
    }
    return subject;
  }

  emitEvent(data: Omit<ProspectingStreamEvent, 'timestamp'>): void {
    const fullEvent: ProspectingStreamEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    };

    const subject = this.getOrCreateSubject(data.scanId);
    subject.next(fullEvent);

    if (data.type === 'SCAN_FINISHED' || data.type === 'SCAN_ERROR') {
      setTimeout(() => {
        this.scanSubjects.delete(data.scanId);
      }, 60000); // 1 minuto de retención para reconexiones
    }
  }

  getScanStream(scanId: string): Observable<MessageEvent> {
    const subject = this.getOrCreateSubject(scanId);
    return subject.asObservable().pipe(
      map((event) => ({
        data: event,
      } as MessageEvent)),
    );
  }
}

