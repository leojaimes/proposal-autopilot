import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/services/i18n.service';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import { MarketRadarComponent } from './market-radar.component';

describe('MarketRadarComponent', () => {
  it('renders shared evidence when the tenant has no snapshots', async () => {
    await TestBed.configureTestingModule({
      imports: [MarketRadarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: PipelineStateService, useValue: { activeProfileId: signal(null), activeProfile: signal(null) } },
        { provide: ReportService, useValue: { marketRadarRefreshVersion: signal(0) } },
        { provide: I18nService, useValue: { t: (key: string) => key } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(MarketRadarComponent);
    fixture.detectChanges();
    const request = TestBed.inject(HttpTestingController).expectOne('http://localhost:7000/api/scraping/market-radar?personaName=');
    request.flush({ success: true, data: {
      kpis: { totalJobsSampled: 0, topCategory: null, opportunityCount: 0, medianProposalsAcrossAll: null, activeProfileName: null },
      operationalHealth: { state: 'NO_SNAPSHOTS', latestSnapshotAsOf: null, latestSnapshotRevision: null, latestCompletedScrapeAt: null, ageDays: null, expectedCategories: 9, latestSnapshotCategories: 0, retainedSnapshots: 0, retentionDays: 180, staleAfterDays: 2 },
      categories: [], methodology: {},
      sharedMarketEvidence: [{ segment: 'social-media-content', sampleJobs: 759, oldestPostedAt: '2026-11-06T02:03:43.850Z', newestPostedAt: '2026-11-07T15:07:14.651Z', coverage: 'PARTIAL' }],
    } });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Shared market evidence');
    expect(fixture.nativeElement.textContent).toContain('social-media-content');
    expect(fixture.nativeElement.textContent).toContain('Partial coverage');
    const sharedEvidence = fixture.nativeElement.querySelector('[aria-label="Shared market evidence"]')?.textContent ?? '';
    expect(sharedEvidence).not.toContain('Profile fit');
  });
});
