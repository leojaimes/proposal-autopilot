import fs from 'fs';
import path from 'path';

const frontendApp = 'D:/SpotlightProjects/proposal-autopilot/frontend/src/app';

console.log('--- Making Keywords, Filters and Proof Stories 100% Interactive ---');

// 1. Update PipelineStateService with editable keywords, budget and proof story CRUD
const stateServicePath = path.join(frontendApp, 'core', 'services', 'pipeline-state.service.ts');
let stateCode = fs.readFileSync(stateServicePath, 'utf8');

// Ensure keywords and budget signals exist
if (!stateCode.includes('keywordsText')) {
  stateCode = stateCode.replace(
    'public readonly weightRecency = signal<number>(15);',
    `public readonly weightRecency = signal<number>(15);

  // Editable Scraping Keywords & Filters
  public readonly keywordsText = signal<string>(
    'UX research, design system, Figma design system, AI product design, usability testing, AI prototyping, vibe coding, agentic workflow design, N8N automation design, GenAI UX'
  );
  public readonly minBudgetFixed = signal<number>(1000);
  public readonly minHourlyRate = signal<number>(40);
  public readonly verifiedPaymentOnly = signal<boolean>(true);

  public addProofStory(story: { company: string; metric: string; description: string; tags: string[] }): void {
    const newStory = {
      id: 'STORY_' + Date.now(),
      company: story.company,
      metric: story.metric,
      description: story.description,
      tags: story.tags,
    };
    this.proofStories.update(list => [newStory, ...list]);
  }

  public deleteProofStory(id: string): void {
    this.proofStories.update(list => list.filter(s => s.id !== id));
  }`
  );
  fs.writeFileSync(stateServicePath, stateCode, 'utf8');
  console.log('✓ PipelineStateService updated with editable keywords and CRUD');
}

// 2. Update engine-settings-drawer.component.ts
const drawerTsPath = path.join(frontendApp, 'features', 'dispatch', 'engine-settings-drawer.component.ts');
const cleanDrawerTs = `import { Component, ChangeDetectionStrategy, inject, signal, input, output } from '@angular/core';
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

  // Form State for Adding New Story
  public readonly showAddForm = signal<boolean>(false);
  public readonly newCompany = signal<string>('');
  public readonly newMetric = signal<string>('');
  public readonly newDescription = signal<string>('');
  public readonly newTags = signal<string>('Fintech, Mobile UX');

  public close(): void {
    this.closeDrawer.emit();
  }

  public toggleAddForm(): void {
    this.showAddForm.update(v => !v);
  }

  public saveNewStory(): void {
    const company = this.newCompany().trim();
    const metric = this.newMetric().trim();
    const desc = this.newDescription().trim() || \`Caso de éxito de alto impacto en \${company} (\${metric}).\`;
    const tags = this.newTags().split(',').map(t => t.trim()).filter(Boolean);

    if (company && metric) {
      this.pipeline.addProofStory({ company, metric, description: desc, tags });
      this.newCompany.set('');
      this.newMetric.set('');
      this.newDescription.set('');
      this.showAddForm.set(false);
    }
  }

  public removeStory(id: string): void {
    this.pipeline.deleteProofStory(id);
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
`;
fs.writeFileSync(drawerTsPath, cleanDrawerTs, 'utf8');

// 3. Update engine-settings-drawer.component.html with fully editable keywords & stories
const drawerHtmlPath = path.join(frontendApp, 'features', 'dispatch', 'engine-settings-drawer.component.html');
const cleanDrawerHtml = `<!-- Drawer Backdrop -->
@if (isOpen()) {
  <div class="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
       (click)="close()"></div>
}

<!-- Slide-over Drawer Panel -->
<div class="fixed inset-y-0 right-0 w-full max-w-xl bg-surface border-l border-border-subtle z-50 shadow-2xl flex flex-col transform transition-transform duration-300 ease-out"
     [ngClass]="isOpen() ? 'translate-x-0' : 'translate-x-full'">
  
  <!-- Header -->
  <div class="p-5 border-b border-border-subtle flex items-center justify-between bg-surface-elevated/40">
    <div>
      <h2 class="text-base font-bold text-content-primary flex items-center gap-2">
        <span>⚙️</span>
        <span>Calibración del Motor (Engine Settings)</span>
      </h2>
      <p class="text-xs text-content-muted mt-0.5">Edita tu oferta, quita/agrega historias y cambia tus keywords de scraping.</p>
    </div>
    <button (click)="close()" class="p-1.5 rounded-lg hover:bg-surface-elevated text-content-secondary hover:text-content-primary">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  </div>

  <!-- Navigation Tabs -->
  <div class="flex border-b border-border-subtle px-5 bg-surface text-xs font-semibold">
    <button (click)="activeTab.set('POSITIONING')"
            class="py-3 px-3 border-b-2 transition-all"
            [ngClass]="activeTab() === 'POSITIONING' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-content-secondary hover:text-content-primary'">
      Oferta & Historias ({{ pipeline.proofStories().length }})
    </button>
    <button (click)="activeTab.set('SCRAPING')"
            class="py-3 px-3 border-b-2 transition-all"
            [ngClass]="activeTab() === 'SCRAPING' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-content-secondary hover:text-content-primary'">
      Keywords & Filtros
    </button>
    <button (click)="activeTab.set('WEIGHTS')"
            class="py-3 px-3 border-b-2 transition-all"
            [ngClass]="activeTab() === 'WEIGHTS' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-content-secondary hover:text-content-primary'">
      Pesos Matemáticos
    </button>
  </div>

  <!-- Drawer Body -->
  <div class="flex-1 overflow-y-auto p-5 space-y-6">
    
    <!-- ZONA DE PRUEBAS & ESTADO CERO -->
    <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-3">
      <div class="text-xs font-bold text-content-primary uppercase tracking-wider flex items-center gap-1.5">
        <span>🧪</span>
        <span>Zona de Pruebas (Test Harness)</span>
      </div>
      <p class="text-xs text-content-muted">
        Limpia la base de datos para probar el flujo de Onboarding desde cero, o restaura los datos de prueba de Bo.
      </p>
      <div class="flex items-center gap-3">
        <button (click)="resetDatabase()"
                class="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 font-bold text-xs border border-rose-500/30 transition-all">
          🧹 Resetear Base a Cero
        </button>
        <button (click)="restorePreset()"
                class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 font-bold text-xs border border-emerald-500/30 transition-all">
          📦 Restaurar Preset de Bo
        </button>
      </div>
    </div>

    @switch (activeTab()) {
      @case ('POSITIONING') {
        <!-- Specific Offer -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-content-primary uppercase tracking-wider">Tu Oferta Específica (Transformación)</label>
          <textarea [ngModel]="pipeline.offerText()"
                    (ngModelChange)="pipeline.offerText.set($event)"
                    rows="3"
                    class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-3 text-xs text-content-primary focus:outline-none focus:border-brand-primary leading-relaxed"></textarea>
        </div>

        <!-- Target Audience -->
        <div class="space-y-2">
          <label class="text-xs font-bold text-content-primary uppercase tracking-wider">Perfil Cliente Objetivo</label>
          <input type="text"
                 [ngModel]="pipeline.targetAudience()"
                 (ngModelChange)="pipeline.targetAudience.set($event)"
                 class="w-full bg-surface-elevated border border-border-subtle rounded-lg p-3 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
        </div>

        <!-- Proof Stories Section with ADD / REMOVE -->
        <div class="space-y-3 pt-2 border-t border-border-subtle">
          <div class="flex items-center justify-between">
            <div>
              <label class="text-xs font-bold text-content-primary uppercase tracking-wider block">Historias de Autoridad</label>
              <span class="text-[11px] text-content-muted">Tienes {{ pipeline.proofStories().length }} historias activas</span>
            </div>
            
            <!-- Botón Agregar Historia -->
            @if (!showAddForm()) {
              <button (click)="toggleAddForm()"
                      class="px-3 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm">
                <span>➕</span>
                <span>Agregar Historia</span>
              </button>
            }
          </div>

          <!-- FORMULARIO PARA AGREGAR HISTORIA -->
          @if (showAddForm()) {
            <div class="p-4 rounded-xl bg-surface border-2 border-brand-primary/50 space-y-3 shadow-lg">
              <div class="flex items-center justify-between border-b border-border-subtle pb-2">
                <span class="text-xs font-bold text-content-primary flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Nueva Historia de Autoridad</span>
                </span>
                <button (click)="toggleAddForm()" class="text-xs text-content-muted hover:text-content-primary">✕ Cancelar</button>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-[11px] font-medium text-content-muted mb-1">Empresa / Cliente</label>
                  <input type="text"
                         [ngModel]="newCompany()"
                         (ngModelChange)="newCompany.set($event)"
                         placeholder="Ej: Rappi, Stripe, Startup X..."
                         class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-content-muted mb-1">Métrica de Impacto</label>
                  <input type="text"
                         [ngModel]="newMetric()"
                         (ngModelChange)="newMetric.set($event)"
                         placeholder="Ej: +35% conv, $5M ARR..."
                         class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
                </div>
              </div>

              <div>
                <label class="block text-[11px] font-medium text-content-muted mb-1">Descripción Breve (1 oración)</label>
                <input type="text"
                       [ngModel]="newDescription()"
                       (ngModelChange)="newDescription.set($event)"
                       placeholder="Ej: Rediseñé el checkout y la arquitectura de componentes para 100k usuarios."
                       class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
              </div>

              <div>
                <label class="block text-[11px] font-medium text-content-muted mb-1">Tags (separados por coma)</label>
                <input type="text"
                       [ngModel]="newTags()"
                       (ngModelChange)="newTags.set($event)"
                       placeholder="Fintech, Mobile UX, Design Systems"
                       class="w-full bg-surface-elevated border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-content-primary focus:outline-none focus:border-brand-primary">
              </div>

              <div class="flex justify-end gap-2 pt-1 border-t border-border-subtle">
                <button (click)="toggleAddForm()" class="px-3 py-1.5 rounded-lg bg-surface-elevated text-content-muted hover:text-content-primary text-xs">
                  Cancelar
                </button>
                <button (click)="saveNewStory()"
                        [disabled]="!newCompany() || !newMetric()"
                        class="px-4 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-hover text-white font-bold text-xs shadow-md disabled:opacity-50">
                  Guardar Historia
                </button>
              </div>
            </div>
          }

          <!-- LISTA DE HISTORIAS CON BOTÓN QUITAR -->
          <div class="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            @for (story of pipeline.proofStories(); track story.id) {
              <div class="p-3.5 rounded-xl bg-surface-elevated border border-border-subtle flex items-start justify-between gap-3 group hover:border-border-focus transition-all">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-content-primary">{{ story.company }}</span>
                    <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {{ story.metric }}
                    </span>
                  </div>
                  <p class="text-xs text-content-secondary leading-relaxed">{{ story.description }}</p>
                  <div class="flex flex-wrap gap-1 pt-1">
                    @for (tag of story.tags; track tag) {
                      <span class="text-[10px] font-mono text-content-muted bg-surface px-1.5 py-0.5 rounded">
                        #{{ tag }}
                      </span>
                    }
                  </div>
                </div>

                <!-- BOTÓN QUITAR HISTORIA -->
                <button (click)="removeStory(story.id)"
                        class="p-1.5 rounded-lg text-content-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors flex items-center gap-1 text-xs font-medium"
                        title="Quitar esta historia">
                  <span>🗑️</span>
                  <span class="text-[11px]">Quitar</span>
                </button>
              </div>
            } @empty {
              <div class="p-6 text-center text-xs text-content-muted bg-surface-elevated rounded-xl">
                No tienes historias configuradas. Haz clic en "➕ Agregar Historia" arriba.
              </div>
            }
          </div>
        </div>
      }

      @case ('SCRAPING') {
        <!-- EDITABLE KEYWORDS & FILTERS -->
        <div class="space-y-5">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-content-primary uppercase tracking-wider">Palabras Clave de Búsqueda (Keywords)</label>
              <span class="text-[11px] text-content-muted">Separadas por comas</span>
            </div>
            <textarea [ngModel]="pipeline.keywordsText()"
                      (ngModelChange)="pipeline.keywordsText.set($event)"
                      rows="4"
                      placeholder="Ej: UX research, design system, Figma, AI product design..."
                      class="w-full bg-surface-elevated border border-border-subtle rounded-xl p-3 text-xs text-content-primary font-mono focus:outline-none focus:border-brand-primary leading-relaxed"></textarea>
            <p class="text-[11px] text-content-muted">
              Apify usará estas palabras clave para extraer los empleos más relevantes de Upwork en cada corrida.
            </p>
          </div>

          <!-- EDITABLE BUDGET FILTERS -->
          <div class="grid grid-cols-2 gap-4">
            <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-1.5">
              <label class="text-[11px] font-bold text-content-muted uppercase tracking-wider block">Presupuesto Mínimo Fijo</label>
              <div class="flex items-center gap-1">
                <span class="text-xs text-content-muted">$</span>
                <input type="number"
                       [ngModel]="pipeline.minBudgetFixed()"
                       (ngModelChange)="pipeline.minBudgetFixed.set($event)"
                       class="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-content-primary focus:outline-none focus:border-brand-primary">
                <span class="text-xs text-content-muted">USD</span>
              </div>
            </div>

            <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-1.5">
              <label class="text-[11px] font-bold text-content-muted uppercase tracking-wider block">Tarifa Horaria Mínima</label>
              <div class="flex items-center gap-1">
                <span class="text-xs text-content-muted">$</span>
                <input type="number"
                       [ngModel]="pipeline.minHourlyRate()"
                       (ngModelChange)="pipeline.minHourlyRate.set($event)"
                       class="w-full bg-surface border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-content-primary focus:outline-none focus:border-brand-primary">
                <span class="text-xs text-content-muted">/ hr</span>
              </div>
            </div>
          </div>

          <!-- VERIFIED PAYMENT ONLY TOGGLE -->
          <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-between">
            <div>
              <span class="text-xs font-bold text-content-primary block">Solo Clientes con Pago Verificado</span>
              <span class="text-[11px] text-content-muted">Descarta clientes sin método de pago para evitar fraudes</span>
            </div>
            <input type="checkbox"
                   [ngModel]="pipeline.verifiedPaymentOnly()"
                   (ngModelChange)="pipeline.verifiedPaymentOnly.set($event)"
                   class="w-4 h-4 rounded border-border-subtle accent-indigo-500 cursor-pointer">
          </div>
        </div>
      }

      @case ('WEIGHTS') {
        <div class="space-y-4">
          <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-content-primary">Skill Match</span>
              <span class="font-mono text-brand-primary">{{ pipeline.weightSkill() }}%</span>
            </div>
            <input type="range" min="10" max="60"
                   [ngModel]="pipeline.weightSkill()"
                   (ngModelChange)="pipeline.weightSkill.set($event)"
                   class="w-full accent-indigo-500">
            <p class="text-[10px] text-content-muted">Comprobado contra tus 16 skills verificadas de UX y Research.</p>
          </div>

          <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-content-primary">AI Feasibility</span>
              <span class="font-mono text-brand-primary">{{ pipeline.weightAi() }}%</span>
            </div>
            <input type="range" min="10" max="40"
                   [ngModel]="pipeline.weightAi()"
                   (ngModelChange)="pipeline.weightAi.set($event)"
                   class="w-full accent-indigo-500">
            <p class="text-[10px] text-content-muted">Capacidad de entrega ultra-rápida con Figma Make y Agentes.</p>
          </div>

          <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-content-primary">Client Quality</span>
              <span class="font-mono text-brand-primary">{{ pipeline.weightClient() }}%</span>
            </div>
            <input type="range" min="10" max="40"
                   [ngModel]="pipeline.weightClient()"
                   (ngModelChange)="pipeline.weightClient.set($event)"
                   class="w-full accent-indigo-500">
            <p class="text-[10px] text-content-muted">Gasto histórico, método de pago verificado y pocas propuestas.</p>
          </div>

          <div class="p-4 rounded-xl bg-surface-elevated border border-border-subtle space-y-2">
            <div class="flex justify-between text-xs font-bold">
              <span class="text-content-primary">Recency</span>
              <span class="font-mono text-brand-primary">{{ pipeline.weightRecency() }}%</span>
            </div>
            <input type="range" min="5" max="30"
                   [ngModel]="pipeline.weightRecency()"
                   (ngModelChange)="pipeline.weightRecency.set($event)"
                   class="w-full accent-indigo-500">
            <p class="text-[10px] text-content-muted">Ventana de prioridad para propuestas tempranas (&lt; 3h).</p>
          </div>

          <div class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 leading-relaxed">
            🛡️ <strong>Regla del CAP en 44</strong>: Si el empleo es de soporte o tareas fuera de tu nicho (Skill &lt; 40), el puntaje se congela automáticamente en 44 para no quemar Connects.
          </div>
        </div>
      }
    }
  </div>

  <!-- Footer Actions -->
  <div class="p-4 border-t border-border-subtle bg-surface-elevated/60 flex justify-end">
    <button (click)="close()"
            class="px-5 py-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold transition-all shadow-md">
      Guardar y Cerrar
    </button>
  </div>
</div>
`;
fs.writeFileSync(drawerHtmlPath, cleanDrawerHtml, 'utf8');

console.log('--- Keywords, Filters, and Proof Stories are now 100% interactive! ---');
