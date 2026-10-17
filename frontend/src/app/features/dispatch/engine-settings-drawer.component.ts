import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-engine-settings-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './engine-settings-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineSettingsDrawerComponent {
  public readonly pipeline = inject(PipelineStateService);
  private readonly http = inject(HttpClient);
  private readonly report = inject(ReportService);
  
  public readonly isOpen = input<boolean>(false);
  public readonly closeDrawer = output<void>();

  public readonly activeTab = signal<'POSITIONING' | 'WEIGHTS' | 'SCRAPING'>('POSITIONING');

  public close(): void {
    this.closeDrawer.emit();
  }

  public resetDatabase(): void {
    this.http.post('http://localhost:7000/api/scraping/reset', {})
      .subscribe(() => {
        this.report.refresh();
        this.close();
      });
  }

  public restorePreset(): void {
    this.http.post('http://localhost:7000/api/scraping/restore-preset', {})
      .subscribe(() => {
        this.report.refresh();
        this.close();
      });
  }
}
