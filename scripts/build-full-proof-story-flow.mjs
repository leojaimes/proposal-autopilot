import fs from 'fs';
import path from 'path';

const frontendApp = 'D:/SpotlightProjects/proposal-autopilot/frontend/src/app';

console.log('--- Enhancing PipelineStateService, Onboarding & Drawer with Add Proof Story Flow ---');

// 1. Update PipelineStateService with addProofStory and deleteProofStory
const stateServicePath = path.join(frontendApp, 'core', 'services', 'pipeline-state.service.ts');
let stateCode = fs.readFileSync(stateServicePath, 'utf8');

if (!stateCode.includes('addProofStory')) {
  const methods = `
  public addProofStory(story: { company: string; metric: string; description: string; tags: string[] }): void {
    const newStory: ProofStory = {
      id: 'CUSTOM_' + Date.now(),
      company: story.company,
      metric: story.metric,
      description: story.description,
      tags: story.tags,
    };
    this.proofStories.update(list => [newStory, ...list]);
  }

  public deleteProofStory(id: string): void {
    this.proofStories.update(list => list.filter(s => s.id !== id));
  }
}
`;
  stateCode = stateCode.replace(/\n\}\s*$/, methods);
  fs.writeFileSync(stateServicePath, stateCode, 'utf8');
}

// 2. Update zero-state-onboarding.component.html with "+ Agregar Nueva Historia" Form
const onboardingHtml = `<div class="min-h-full flex flex-col items-center justify-center p-8 max-w-3xl mx-auto space-y-8 select-none">
  
  <!-- Welcome Hero Badge -->
  <div class="text-center space-y-3">
    <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-primary/10 border border-brand-primary/30 text-brand-primary text-xs font-mono font-bold">
      <span class="w-2 h-2 rounded-full bg-brand-primary animate-pulse"></span>
      Paso a Paso: Configura tu Posicionamiento
    </div>
    <h1 class="text-3xl font-extrabold tracking-tight text-content-primary">
      Bienvenido a Proposal Autopilot
    </h1>
    <p class="text-sm text-content-secondary max-w-xl mx-auto leading-relaxed">
      Ingresa tu oferta específica y tus historias de autoridad para que el motor redacte propuestas hiper-personalizadas de 35 palabras.
    </p>
  </div>

  <!-- 3-Step Guided Setup Card -->
  <div class="w-full bg-surface border border-border-subtle rounded-3xl p-8 shadow-xl space-y-6">
    
    <!-- STEP 1: TU OFERTA ESPECÍFICA -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center text-[11px] font-mono">1</span>
          <span>Tu Oferta Específica (Transformación que vendes)</span>
        </label>
        <span class="text-xs text-content-muted font-mono">{{ pipeline.offerText().length }} caracteres</span>
      </div>
      <textarea [ngModel]="pipeline.offerText()"
                (ngModelChange)="pipeline.offerText.set($event)"
                rows="3"
                class="w-full bg-surface-elevated border border-border-subtle rounded-xl p-3.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary leading-relaxed"></textarea>
      <p class="text-xs text-content-muted">
        Ejemplo: <em>"AI-native UX para startups y producto B2B: diseño de interfaces, sistemas de tokens en Figma y research entregado a velocidad de agencia."</em>
      </p>
    </div>

    <!-- STEP 2: HISTORIAS DE AUTORIDAD (PROOF STORIES) -->
    <div class="space-y-3 pt-3 border-t border-border-subtle">
      <div class="flex items-center justify-between">
        <label class="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center text-[11px] font-mono">2</span>
          <span>Tus Historias de Autoridad (Métricas que cierran llamadas)</span>
        </label>
        
        <!-- Botón + Agregar Nueva Historia -->
        @if (!showStoryForm()) {
          <button (click)="showStoryForm.set(true)"
                  class="px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
            <span>+</span>
            <span>Agregar Historia</span>
          </button>
        }
      </div>

      <!-- Formulario para Agregar Nueva Historia -->
      @if (showStoryForm()) {
        <div class="p-5 rounded-2xl bg-surface-elevated border-2 border-brand-primary/40 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-content-primary">Nueva Historia de Autoridad</span>
            <button (click)="showStoryForm.set(false)" class="text-content-muted hover:text-content-primary text-xs">✕ Cancelar</button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[11px] text-content-muted mb-1">Empresa / Cliente</label>
              <input type="text"
                     [ngModel]="newCompany()"
                     (ngModelChange)="newCompany.set($event)"
                     placeholder="Ej: Rappi, Stripe, Startup X..."
                     class="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
            </div>
            <div>
              <label class="block text-[11px] text-content-muted mb-1">Métrica de Impacto</label>
              <input type="text"
                     [ngModel]="newMetric()"
                     (ngModelChange)="newMetric.set($event)"
                     placeholder="Ej: +35% conversión, $40B reservas..."
                     class="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
            </div>
          </div>

          <div>
            <label class="block text-[11px] text-content-muted mb-1">Descripción Breve (1 oración)</label>
            <input type="text"
                   [ngModel]="newDescription()"
                   (ngModelChange)="newDescription.set($event)"
                   placeholder="Ej: Rediseñé el checkout y la arquitectura de componentes para 100k usuarios."
                   class="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
          </div>

          <div>
            <label class="block text-[11px] text-content-muted mb-1">Tags (separados por coma)</label>
            <input type="text"
                   [ngModel]="newTags()"
                   (ngModelChange)="newTags.set($event)"
                   placeholder="Fintech, Mobile UX, Design Systems"
                   class="w-full bg-surface border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button (click)="showStoryForm.set(false)"
                    class="px-3 py-1.5 rounded-lg bg-surface hover:bg-surface-hover text-content-secondary text-xs">
              Cancelar
            </button>
            <button (click)="saveCustomStory()"
                    [disabled]="!newCompany() || !newMetric()"
                    class="px-4 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white font-bold text-xs shadow-md disabled:opacity-50">
              Guardar Historia
            </button>
          </div>
        </div>
      }

      <!-- Lista de Historias Activas -->
      <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
        @for (story of pipeline.proofStories(); track story.id) {
          <div class="p-3.5 rounded-xl bg-surface-elevated border border-border-subtle flex items-start justify-between gap-3 group">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-content-primary">{{ story.company }}</span>
                <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {{ story.metric }}
                </span>
              </div>
              <p class="text-xs text-content-secondary leading-relaxed">{{ story.description }}</p>
              <div class="flex flex-wrap gap-1 pt-0.5">
                @for (tag of story.tags; track tag) {
                  <span class="text-[10px] font-mono text-content-muted bg-surface px-1.5 py-0.5 rounded">
                    #{{ tag }}
                  </span>
                }
              </div>
            </div>

            <!-- Botón Eliminar Historia -->
            <button (click)="pipeline.deleteProofStory(story.id)"
                    class="p-1 rounded text-content-muted hover:text-rose-400 transition-colors"
                    title="Eliminar Historia">
              🗑️
            </button>
          </div>
        }
      </div>
    </div>

    <!-- STEP 3: ACTIVACIÓN Y EXTRACCIÓN DE EMPLEOS DE UPWORK -->
    <div class="space-y-3 pt-3 border-t border-border-subtle">
      <label class="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-2">
        <span class="w-5 h-5 rounded-full bg-brand-primary text-white flex items-center justify-center text-[11px] font-mono">3</span>
        <span>Generación del Reporte de Upwork</span>
      </label>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
        <!-- Live Scrape Button -->
        <button (click)="triggerLiveScrape()"
                [disabled]="report.isScrapingInProgress()"
                class="p-4 rounded-2xl bg-brand-primary hover:bg-brand-hover text-white font-bold text-xs flex flex-col items-center justify-center gap-2 transition-all shadow-lg disabled:opacity-50 group">
          @if (report.isScrapingInProgress()) {
            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Extrayendo con tu Token de Apify...</span>
          } @else {
            <span class="text-lg">🚀</span>
            <span class="text-sm font-extrabold">Guardar Oferta & Extraer Empleos Reales</span>
            <span class="text-[11px] font-normal opacity-80">15 empleos de Upwork evaluados con tu historia</span>
          }
        </button>

        <!-- Restore Demo Preset Button -->
        <button (click)="restoreBoPreset()"
                [disabled]="isLoadingPreset()"
                class="p-4 rounded-2xl bg-surface-elevated hover:bg-surface-hover text-content-primary font-bold text-xs flex flex-col items-center justify-center gap-2 border border-border-subtle transition-all group">
          <span class="text-lg">📦</span>
          <span class="text-sm font-extrabold">Cargar Datos de Demostración</span>
          <span class="text-[11px] font-normal text-content-muted">Restaura 15 empleos de prueba con 1 clic</span>
        </button>
      </div>
    </div>
  </div>
</div>
`;
fs.writeFileSync(path.join(frontendApp, 'features', 'onboarding', 'zero-state-onboarding.component.html'), onboardingHtml, 'utf8');

// 3. Update zero-state-onboarding.component.ts with methods to add proof story
const onboardingTs = `import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';

@Component({
  selector: 'app-zero-state-onboarding',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './zero-state-onboarding.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ZeroStateOnboardingComponent {
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);
  private readonly http = inject(HttpClient);

  public readonly showStoryForm = signal<boolean>(false);
  public readonly newCompany = signal<string>('');
  public readonly newMetric = signal<string>('');
  public readonly newDescription = signal<string>('');
  public readonly newTags = signal<string>('SaaS, UX Design, Prototyping');
  public readonly isLoadingPreset = signal<boolean>(false);

  public saveCustomStory(): void {
    const company = this.newCompany().trim();
    const metric = this.newMetric().trim();
    const description = this.newDescription().trim() || \`Caso de éxito de alto impacto en \${company} con métrica \${metric}.\`;
    const tags = this.newTags().split(',').map(t => t.trim()).filter(Boolean);

    if (company && metric) {
      this.pipeline.addProofStory({ company, metric, description, tags });
      // Reset form
      this.newCompany.set('');
      this.newMetric.set('');
      this.newDescription.set('');
      this.showStoryForm.set(false);
    }
  }

  public triggerLiveScrape(): void {
    // 1. Guardar posicionamiento en el backend
    this.http.put('http://localhost:7000/api/config/positioning', {
      offerHeadline: this.pipeline.offerText(),
      targetAudience: this.pipeline.targetAudience(),
    }).subscribe();

    // 2. Disparar scraping en vivo con Apify
    this.report.triggerLiveScrape(15);
  }

  public restoreBoPreset(): void {
    this.isLoadingPreset.set(true);
    this.http.post('http://localhost:7000/api/scraping/restore-preset', {})
      .subscribe({
        next: () => {
          this.isLoadingPreset.set(false);
          this.report.refresh();
        },
        error: () => {
          this.isLoadingPreset.set(false);
          this.report.triggerLiveScrape(15);
        }
      });
  }
}
`;
fs.writeFileSync(path.join(frontendApp, 'features', 'onboarding', 'zero-state-onboarding.component.ts'), onboardingTs, 'utf8');

// 4. Update EngineSettingsDrawerComponent with Add Proof Story Form as well
const drawerHtmlPath = path.join(frontendApp, 'features', 'dispatch', 'engine-settings-drawer.component.html');
let drawerHtml = fs.readFileSync(drawerHtmlPath, 'utf8');

const drawerStoriesReplacement = `
        <!-- Proof Stories -->
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <label class="text-xs font-bold text-content-primary uppercase tracking-wider">Tus Historias de Autoridad</label>
            @if (!showStoryForm()) {
              <button (click)="showStoryForm.set(true)"
                      class="px-2.5 py-1 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-[11px] font-bold flex items-center gap-1 transition-all">
                <span>+</span>
                <span>Agregar Historia</span>
              </button>
            }
          </div>

          <!-- Formulario Agregar Historia en Drawer -->
          @if (showStoryForm()) {
            <div class="p-4 rounded-xl bg-surface border-2 border-brand-primary/40 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-content-primary">Nueva Historia</span>
                <button (click)="showStoryForm.set(false)" class="text-content-muted hover:text-content-primary text-xs">✕</button>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <input type="text" [ngModel]="newCompany()" (ngModelChange)="newCompany.set($event)" placeholder="Empresa (ej: Rappi)"
                       class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-primary">
                <input type="text" [ngModel]="newMetric()" (ngModelChange)="newMetric.set($event)" placeholder="Métrica (ej: +35% conv)"
                       class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-primary">
              </div>
              <input type="text" [ngModel]="newDescription()" (ngModelChange)="newDescription.set($event)" placeholder="Descripción breve..."
                     class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-primary">
              <div class="flex justify-end gap-2 pt-1">
                <button (click)="showStoryForm.set(false)" class="px-2.5 py-1 rounded text-content-muted text-xs">Cancelar</button>
                <button (click)="saveCustomStory()" [disabled]="!newCompany() || !newMetric()"
                        class="px-3 py-1 rounded bg-brand-primary text-white font-bold text-xs disabled:opacity-50">
                  Guardar
                </button>
              </div>
            </div>
          }

          <div class="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            @for (story of pipeline.proofStories(); track story.id) {
              <div class="p-3 rounded-lg bg-surface-elevated border border-border-subtle flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-content-primary">{{ story.company }}</span>
                    <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">{{ story.metric }}</span>
                  </div>
                  <p class="text-[11px] text-content-secondary mt-1 leading-relaxed">{{ story.description }}</p>
                </div>
                <button (click)="pipeline.deleteProofStory(story.id)" class="text-content-muted hover:text-rose-400 text-xs" title="Eliminar">
                  🗑️
                </button>
              </div>
            }
          </div>
        </div>
`;

drawerHtml = drawerHtml.replace(/<!-- Proof Stories -->[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*\}\s*@case \('WEIGHTS'\)/, drawerStoriesReplacement + '\n      }\n      @case (\'WEIGHTS\')');
fs.writeFileSync(drawerHtmlPath, drawerHtml, 'utf8');

// 5. Update engine-settings-drawer.component.ts with methods
const drawerTsPath = path.join(frontendApp, 'features', 'dispatch', 'engine-settings-drawer.component.ts');
let drawerTs = fs.readFileSync(drawerTsPath, 'utf8');

if (!drawerTs.includes('showStoryForm')) {
  drawerTs = drawerTs.replace(
    'public readonly activeTab = signal',
    `public readonly showStoryForm = signal<boolean>(false);
  public readonly newCompany = signal<string>('');
  public readonly newMetric = signal<string>('');
  public readonly newDescription = signal<string>('');

  public saveCustomStory(): void {
    const company = this.newCompany().trim();
    const metric = this.newMetric().trim();
    const description = this.newDescription().trim() || \`Caso de éxito en \${company} (\${metric}).\`;

    if (company && metric) {
      this.pipeline.addProofStory({ company, metric, description, tags: ['Custom'] });
      this.newCompany.set('');
      this.newMetric.set('');
      this.newDescription.set('');
      this.showStoryForm.set(false);
    }
  }

  public readonly activeTab = signal`
  );
  fs.writeFileSync(drawerTsPath, drawerTs, 'utf8');
}

console.log('--- Full Proof Story Flow built successfully! ---');
