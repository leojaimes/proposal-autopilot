import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import { ProofStory } from '../../core/models/pipeline.model';

import {
  LucideSettings,
  LucidePlus,
  LucideZap,
  LucideRocket,
  LucideTarget,
  LucideShieldAlert,
  LucideClock,
  LucideTrash,
  LucideRotateCcw,
} from '@lucide/angular';

@Component({
  selector: 'app-engine-settings-drawer',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideSettings,
    LucidePlus,
    LucideZap,
    LucideRocket,
    LucideTarget,
    LucideShieldAlert,
    LucideClock,
    LucideTrash,
    LucideRotateCcw,
  ],
  templateUrl: './engine-settings-drawer.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineSettingsDrawerComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);
  private readonly http = inject(HttpClient);
  
  public readonly isOpen = input<boolean>(false);
  public readonly closeDrawer = output<void>();

  public readonly activeTab = signal<'POSITIONING' | 'ROLES' | 'SCRAPING' | 'GEO' | 'WEIGHTS'>('POSITIONING');

  // Role Taxonomy Tag Inputs State
  public readonly newCoreRoleInput = signal<string>('');
  public readonly newHybridRoleInput = signal<string>('');
  public readonly newTangentialRoleInput = signal<string>('');
  public readonly newExcludedRoleInput = signal<string>('');
  public readonly newCountryInput = signal<string>('');
  public readonly newExcludedCountryInput = signal<string>('');
  public readonly isSavingGeo = signal<boolean>(false);
  public readonly geoSavedMessage = signal<string>('');

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

  public readonly selectedBatchSize = signal<number>(30);
  public readonly newCustomQueryInput = signal<string>('');
  public readonly isSavingScrapeConfig = signal<boolean>(false);
  public readonly scrapeConfigSavedMessage = signal<string>('');

  public moveStoryDown(id: string): void {
    this.pipeline.moveProofStory(id, 'DOWN');
  }

  public async triggerScrapeWithActiveProfile(): Promise<void> {
    const queries = this.pipeline.activeQueriesList();
    try {
      await this.saveScrapingConfig();
    } catch (e) {
      console.warn('Error guardando config previo al scrape:', e);
    }
    this.report.triggerLiveScrape(this.selectedBatchSize(), queries);
    this.close();
  }

  public async synthesizeQueries(): Promise<void> {
    await this.pipeline.synthesizeQueriesWithAi();
  }

  public async synthesizeTaxonomy(): Promise<void> {
    await this.pipeline.synthesizeTaxonomyWithAi();
  }

  public addRole(category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED'): void {
    let val = '';
    if (category === 'CORE') {
      val = this.newCoreRoleInput().trim();
      this.newCoreRoleInput.set('');
    } else if (category === 'HYBRID') {
      val = this.newHybridRoleInput().trim();
      this.newHybridRoleInput.set('');
    } else if (category === 'TANGENTIAL') {
      val = this.newTangentialRoleInput().trim();
      this.newTangentialRoleInput.set('');
    } else if (category === 'EXCLUDED') {
      val = this.newExcludedRoleInput().trim();
      this.newExcludedRoleInput.set('');
    }
    if (val) {
      this.pipeline.addRole(category, val);
    }
  }

  public removeRole(category: 'CORE' | 'HYBRID' | 'TANGENTIAL' | 'EXCLUDED', role: string): void {
    this.pipeline.removeRole(category, role);
  }

  public addCustomQuery(): void {
    const val = this.newCustomQueryInput().trim();
    if (!val) return;
    this.pipeline.addQuery(val);
    this.newCustomQueryInput.set('');
  }

  public removeQuery(q: string): void {
    this.pipeline.removeQuery(q);
  }

  public async saveScrapingConfig(): Promise<void> {
    this.isSavingScrapeConfig.set(true);
    this.scrapeConfigSavedMessage.set('');
    try {
      await this.pipeline.saveActiveProfile();

      this.scrapeConfigSavedMessage.set('¡Perfil, historias y filtros guardados en PostgreSQL!');
      setTimeout(() => this.scrapeConfigSavedMessage.set(''), 3500);
    } catch (err) {
      console.error('Error guardando configuración de scraping:', err);
      this.scrapeConfigSavedMessage.set('Error guardando configuración.');
    } finally {
      this.isSavingScrapeConfig.set(false);
    }
  }

  private getApiBase(): string {
    return (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1')
      ? '/api'
      : 'http://localhost:7000/api';
  }

  public resetDatabase(): void {
    this.http.post(`${this.getApiBase()}/scraping/reset`, {})
      .subscribe(() => {
        this.report.refresh();
        this.close();
      });
  }

  public restorePreset(): void {
    this.http.post(`${this.getApiBase()}/scraping/restore-preset`, {})
      .subscribe(() => {
        this.report.refresh();
        this.close();
      });
  }

  public addCountry(): void {
    const val = this.newCountryInput().trim();
    if (!val) return;
    this.pipeline.toggleTargetCountry(val);
    this.newCountryInput.set('');
  }

  public addExcluded(): void {
    const val = this.newExcludedCountryInput().trim();
    if (!val) return;
    this.pipeline.addExcludedCountry(val);
    this.newExcludedCountryInput.set('');
  }

  public async saveGeoAndRecalculate(): Promise<void> {
    this.isSavingGeo.set(true);
    this.geoSavedMessage.set('');
    try {
      const keywords = this.pipeline.keywordsText().split(',').map(k => k.trim()).filter(Boolean);
      await this.http.put(`${this.getApiBase()}/config/scrape`, {
        searchKeywords: keywords.length > 0 ? keywords : ['UX Designer', 'Figma'],
        minBudgetFixed: this.pipeline.minBudgetFixed(),
        minHourlyRate: this.pipeline.minHourlyRate(),
        verifiedPaymentOnly: this.pipeline.verifiedPaymentOnly(),
        targetCountries: this.pipeline.targetCountries(),
        targetRegions: this.pipeline.targetRegions(),
        excludedCountries: this.pipeline.excludedCountries(),
        geoFilterMode: this.pipeline.geoFilterMode(),
      }).toPromise();

      await this.http.post(`${this.getApiBase()}/scraping/reprocess`, {}).toPromise();
      this.report.refresh();
      this.geoSavedMessage.set('¡Preferencias geográficas aplicadas y ranking recalculado!');
      setTimeout(() => this.geoSavedMessage.set(''), 3500);
    } catch (err) {
      console.error('Error guardando configuración geográfica:', err);
      this.geoSavedMessage.set('Error guardando configuración.');
    } finally {
      this.isSavingGeo.set(false);
    }
  }
}
