import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject, switchMap, catchError, of, tap, exhaustMap } from 'rxjs';
import { JobReportItem } from '../models/pipeline.model';

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:7000/api/scraping';

  // Signals for state
  private readonly _jobs = signal<JobReportItem[]>([]);
  public readonly jobs = this._jobs.asReadonly();

  private readonly _isLoading = signal<boolean>(false);
  public readonly isLoading = this._isLoading.asReadonly();

  private readonly _isScrapingInProgress = signal<boolean>(false);
  public readonly isScrapingInProgress = this._isScrapingInProgress.asReadonly();

  private readonly _lastRefreshed = signal<Date>(new Date());
  public readonly lastRefreshed = this._lastRefreshed.asReadonly();

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
}
