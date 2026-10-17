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

  public readonly activeTab = signal<'POSITIONING' | 'SCRAPING' | 'WEIGHTS'>('POSITIONING');

  // Creating New Profile Modal/State
  public readonly showNewProfileInput = signal<boolean>(false);
  public readonly newProfileName = signal<string>('');

  // Form State for Adding New Story
  public readonly showAddStoryForm = signal<boolean>(false);
  public readonly newCompany = signal<string>('');
  public readonly newMetric = signal<string>('');
  public readonly newDescription = signal<string>('');
  public readonly newTags = signal<string>('SaaS, Fullstack, AI');

  public close(): void {
    this.closeDrawer.emit();
  }

  public createNewProfile(): void {
    const name = this.newProfileName().trim() || 'Mi Nueva Calibración';
    this.pipeline.createBlankProfile(name);
    this.newProfileName.set('');
    this.showNewProfileInput.set(false);
  }

  public toggleAddStoryForm(): void {
    this.showAddStoryForm.update(v => !v);
  }

  public saveNewStory(): void {
    const company = this.newCompany().trim();
    const metric = this.newMetric().trim();
    const desc = this.newDescription().trim() || `Caso de éxito de alto impacto en ${company} (${metric}).`;
    const tags = this.newTags().split(',').map(t => t.trim()).filter(Boolean);

    if (company && metric) {
      this.pipeline.addProofStory({ company, metric, description: desc, tags });
      this.newCompany.set('');
      this.newMetric.set('');
      this.newDescription.set('');
      this.showAddStoryForm.set(false);
    }
  }

  public removeStory(id: string): void {
    this.pipeline.deleteProofStory(id);
  }

  public triggerScrapeWithActiveProfile(): void {
    this.report.triggerLiveScrape(15);
    this.close();
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
