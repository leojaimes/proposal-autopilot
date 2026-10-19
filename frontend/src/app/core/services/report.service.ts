import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, catchError, of, tap, exhaustMap } from 'rxjs';
import { JobReportItem } from '../models/pipeline.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
    ? '/api/scraping'
    : 'http://localhost:7000/api/scraping';

  // Signals for state
  private readonly _jobs = signal<JobReportItem[]>([]);
  public readonly jobs = this._jobs.asReadonly();

  private readonly _isLoading = signal<boolean>(false);
  public readonly isLoading = this._isLoading.asReadonly();

  private readonly _isScrapingInProgress = signal<boolean>(false);
  public readonly isScrapingInProgress = this._isScrapingInProgress.asReadonly();

  private readonly _lastRefreshed = signal<Date>(new Date());
  public readonly lastRefreshed = this._lastRefreshed.asReadonly();

  // Tri-Factor Positioning State
  public readonly offerHeadline = signal<string>('');
  public readonly targetAudience = signal<string>('');
  public readonly proofStories = signal<{ id: string; keyCode: string; companyOrProduct: string; impactMetric: string; domainTags: string[] }[]>([]);

  // Event streams
  private readonly refreshTrigger$ = new Subject<void>();
  private readonly scrapeTrigger$ = new Subject<number>();

  constructor() {
    // 1. Reactive Refresh Pipeline (switchMap cancels in-flight requests)
    this.refreshTrigger$
      .pipe(
        tap(() => this._isLoading.set(true)),
        switchMap(() =>
          this.http.get<JobReportItem[]>(this.baseUrl + '/report').pipe(
            catchError((err) => {
              console.error('Failed to fetch job report', err);
              return of([]);
            })
          )
        )
      )
      .subscribe((data) => {
        this._jobs.set(data);
        this._isLoading.set(false);
        this._lastRefreshed.set(new Date());
      });

    // 2. Reactive Scraper Trigger (exhaustMap prevents double click triggers)
    this.scrapeTrigger$
      .pipe(
        tap(() => this._isScrapingInProgress.set(true)),
        exhaustMap((limit) =>
          this.http.post<{ success: boolean; totalScraped: number }>(this.baseUrl + '/trigger', { limit }).pipe(
            catchError((err) => {
              console.error('Scraping run failed', err);
              return of({ success: false, totalScraped: 0 });
            })
          )
        )
      )
      .subscribe(() => {
        this._isScrapingInProgress.set(false);
        this.refresh();
      });

    // Initial load
    this.refresh();
    this.fetchProofStories();
  }

  public fetchProofStories(): void {
    this.http.get<{ offerHeadline: string; targetAudience: string; proofStories: any[] }>(this.baseUrl + '/proof-stories')
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

  public regenerateProposal(jobId: string, proofStoryKey?: string) {
    return this.http.post<any>(`${this.baseUrl}/jobs/${jobId}/regenerate-proposal`, { proofStoryKey }).pipe(
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

  public triggerLiveScrape(limit = 25): void {
    this.scrapeTrigger$.next(limit);
  }

  public updateJobStatus(jobId: string, status: string): void {
    this.http.patch(this.baseUrl + '/jobs/' + jobId + '/status', { status })
      .pipe(catchError(() => of(null)))
      .subscribe(() => {
        this._jobs.update(list =>
          list.map(j => j.id === jobId ? { ...j, status: status as any } : j)
        );
      });
  }

  public downloadCsv(): void {
    window.open(this.baseUrl + '/report/csv', '_blank');
  }

  public downloadTechnicalProposalPdf(jobId: string, jobTitle?: string) {
    return this.http.get(`${this.baseUrl}/jobs/${jobId}/technical-proposal-pdf`, {
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
