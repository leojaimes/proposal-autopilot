import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import { ProofStory } from '../../core/models/pipeline.model';

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

  // Form State for Adding / Editing Story
  public readonly showStoryForm = signal<boolean>(false);
  public readonly editingStoryId = signal<string | null>(null);
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

  public openAddStoryForm(): void {
    this.editingStoryId.set(null);
    this.newCompany.set('');
    this.newMetric.set('');
    this.newDescription.set('');
    this.newTags.set('SaaS, AI, Mobile UX');
    this.showStoryForm.set(true);
  }

  public openEditStoryForm(story: ProofStory): void {
    this.editingStoryId.set(story.id);
    this.newCompany.set(story.company);
    this.newMetric.set(story.metric);
    this.newDescription.set(story.description);
    this.newTags.set(story.tags.join(', '));
    this.showStoryForm.set(true);
  }

  public cancelStoryForm(): void {
    this.showStoryForm.set(false);
    this.editingStoryId.set(null);
  }

  public saveStory(): void {
    const company = this.newCompany().trim();
    const metric = this.newMetric().trim();
    const desc = this.newDescription().trim() || `Caso de éxito de alto impacto en ${company} (${metric}).`;
    const tags = this.newTags().split(',').map(t => t.trim()).filter(Boolean);

    if (!company || !metric) return;

    if (this.editingStoryId()) {
      // EDIT EXISTING
      this.pipeline.updateProofStory(this.editingStoryId()!, {
        company,
        metric,
        description: desc,
        tags
      });
    } else {
      // ADD NEW
      this.pipeline.addProofStory({ company, metric, description: desc, tags });
    }

    this.cancelStoryForm();
  }

  public removeStory(id: string): void {
    this.pipeline.deleteProofStory(id);
  }

  public moveStoryUp(id: string): void {
    this.pipeline.moveProofStory(id, 'UP');
  }

  public moveStoryDown(id: string): void {
    this.pipeline.moveProofStory(id, 'DOWN');
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
