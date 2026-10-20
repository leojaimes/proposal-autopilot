import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportService } from '../../core/services/report.service';
import { JobReportItem } from '../../core/models/pipeline.model';
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
  public readonly copiedId = signal<string | null>(null);

  // Definición de Columnas de Excel para Empleos (Stitch Grid Layout)
  public readonly jobColumns: ExcelColumnDef<JobReportItem>[] = [
    {
      key: 'fitScore',
      header: 'Score',
      type: 'number',
      sortable: true,
      filterable: true,
      width: '80px',
      align: 'center',
    },
    {
      key: 'jobTitle',
      header: 'Título & Rol Estratégico',
      type: 'string',
      sortable: true,
      filterable: true,
      width: '360px',
    },
    {
      key: 'budget',
      header: 'Presupuesto',
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '130px',
    },
    {
      key: 'clientCountry',
      header: 'País del Cliente',
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
    },
    {
      key: 'clientRating',
      header: 'Rating Cliente',
      type: 'number',
      sortable: true,
      filterable: true,
      width: '110px',
      align: 'center',
    },
    {
      key: 'clientTotalSpent',
      header: 'Gasto Total',
      type: 'number',
      sortable: true,
      filterable: true,
      width: '125px',
      align: 'right',
      valueFormatter: (val) => `$${Math.round(Number(val) || 0).toLocaleString()} USD`,
    },
    {
      key: 'proposalsAlreadyIn',
      header: 'Bids',
      type: 'number',
      sortable: true,
      filterable: true,
      width: '75px',
      align: 'center',
    },
    {
      key: 'suggestedProofStory',
      header: 'Historia Inyectada',
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
      align: 'center',
    },
    {
      key: 'status',
      header: 'Estado',
      type: 'enum',
      sortable: true,
      filterable: true,
      width: '145px',
    },
    {
      key: 'actions',
      header: 'Acciones',
      type: 'custom',
      sortable: false,
      filterable: false,
      width: '120px',
      align: 'center',
    },
  ];

  public copyLetter(job: JobReportItem): void {
    if (!job.coverLetter) return;
    navigator.clipboard.writeText(job.coverLetter).then(() => {
      this.copiedId.set(job.id);
      setTimeout(() => this.copiedId.set(null), 2500);
    });
  }
}
