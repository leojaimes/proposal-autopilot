import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { I18nService } from '../../core/services/i18n.service';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { JobReportItem } from '../../core/models/pipeline.model';
import { formatRelativeTime, getTimestampOrZero } from '../../core/utils/date.utils';
import { ExcelDataTableComponent } from '../../shared/components/excel-table/excel-table.component';
import { ExcelColumnDef } from '../../shared/components/excel-table/excel-table.models';

import {
  LucideSearch,
  LucideExternalLink,
  LucideCircleCheck,
  LucideStar,
  LucideCheck,
  LucideCopy,
} from '@lucide/angular';

@Component({
  selector: 'app-job-explorer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    I18nPipe,
    ExcelDataTableComponent,
    LucideSearch,
    LucideExternalLink,
    LucideCircleCheck,
    LucideStar,
    LucideCheck,
    LucideCopy,
  ],
  templateUrl: './job-explorer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JobExplorerComponent {
  public readonly report = inject(ReportService);
  public readonly i18n = inject(I18nService);
  public readonly copiedId = signal<string | null>(null);

  // Definición de Columnas de Excel para Empleos reactivas al idioma
  public readonly jobColumns = computed<ExcelColumnDef<JobReportItem>[]>(() => [
    {
      key: 'fitScore',
      header: this.i18n.t('explorer.col.score'),
      type: 'number',
      sortable: true,
      filterable: true,
      width: '80px',
      align: 'center',
    },
    {
      key: 'jobTitle',
      header: this.i18n.t('explorer.col.title'),
      type: 'string',
      sortable: true,
      filterable: true,
      width: '360px',
    },
    {
      key: 'budget',
      header: this.i18n.t('explorer.col.budget'),
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '130px',
    },
    {
      key: 'clientCountry',
      header: this.i18n.t('explorer.col.country'),
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
    },
    {
      key: 'clientRating',
      header: this.i18n.t('explorer.col.rating'),
      type: 'number',
      sortable: true,
      filterable: true,
      width: '110px',
      align: 'center',
    },
    {
      key: 'clientTotalSpent',
      header: this.i18n.t('explorer.col.spent'),
      type: 'number',
      sortable: true,
      filterable: true,
      width: '125px',
      align: 'right',
      valueFormatter: (val) => `$${Math.round(Number(val) || 0).toLocaleString()} USD`,
    },
    {
      key: 'proposalsAlreadyIn',
      header: this.i18n.t('explorer.col.bids'),
      type: 'number',
      sortable: true,
      filterable: true,
      width: '75px',
      align: 'center',
    },
    {
      key: 'suggestedProofStory',
      header: this.i18n.t('explorer.col.story'),
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
      align: 'center',
    },
    {
      key: 'postedAt',
      header: this.i18n.t('explorer.col.posted'),
      type: 'date',
      sortable: true,
      filterable: true,
      width: '115px',
      align: 'center',
      valueGetter: (row) => getTimestampOrZero(row.postedAt),
      valueFormatter: (_val, row) => formatRelativeTime(row.postedAt),
    },
    {
      key: 'status',
      header: this.i18n.t('explorer.col.status'),
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
    },
    {
      key: 'actions',
      header: this.i18n.t('explorer.col.actions'),
      type: 'custom',
      sortable: false,
      filterable: false,
      width: '120px',
      align: 'center',
    },
  ]);

  public copyLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copiedId.set(job.id);
      setTimeout(() => this.copiedId.set(null), 2500);
    });
  }
}
