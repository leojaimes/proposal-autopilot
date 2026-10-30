import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CustomJobService, CustomJobAnalysisResult } from '../../core/services/custom-job.service';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import {
  LucideSparkles,
  LucideLink,
  LucideFileText,
  LucideCheckCircle2,
  LucideAlertTriangle,
  LucideDownload,
  LucideCopy,
  LucideCheck,
  LucideArrowRight,
  LucideBuilding,
  LucideMapPin,
  LucideCode2,
  LucideRefreshCw,
  LucideLayers,
  LucideChevronRight
} from '@lucide/angular';

@Component({
  selector: 'app-custom-job-workbench',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideSparkles,
    LucideLink,
    LucideFileText,
    LucideCheckCircle2,
    LucideAlertTriangle,
    LucideDownload,
    LucideCopy,
    LucideCheck,
    LucideArrowRight,
    LucideBuilding,
    LucideMapPin,
    LucideCode2,
    LucideRefreshCw,
    LucideLayers,
    LucideChevronRight,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-full flex flex-col bg-[#0b0e14] text-slate-100 overflow-y-auto">
      
      <!-- TOP BANNER / HERO -->
      <div class="border-b border-white/[0.08] bg-[#0f131d]/90 px-6 py-5 shrink-0">
        <div class="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                Copiloto 1:1
              </span>
              <h1 class="text-xl font-bold font-headline text-white flex items-center gap-2">
                Taller de Postulación Universal
              </h1>
            </div>
            <p class="text-xs text-slate-400">
              Pega cualquier vacante externa (Workday, LinkedIn, Greenhouse) o texto directo. Extrae, diagnostica brechas de fit y adapta tu CV ATS con edición humana antes de compilar a PDF.
            </p>
          </div>

          <div class="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <!-- TARGET LANGUAGE SELECTOR -->
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-[#171b26] border border-white/[0.08]">
              <span class="text-[10px] font-mono text-slate-400 px-2 uppercase font-bold">Idioma:</span>
              <button
                (click)="setLanguage('en')"
                [ngClass]="targetLanguage() === 'en' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all border"
                title="Generar CV ATS, Carta y Propuesta en Inglés">
                <span>🇺🇸 English</span>
              </button>
              <button
                (click)="setLanguage('es')"
                [ngClass]="targetLanguage() === 'es' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                class="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all border"
                title="Generar CV ATS, Carta y Propuesta en Español">
                <span>🇲🇽 Español</span>
              </button>
            </div>

            <!-- INPUT MODE TOGGLE -->
            <div class="flex items-center gap-1.5 p-1 rounded-xl bg-[#171b26] border border-white/[0.08]">
              <button
                (click)="inputMode.set('URL')"
                [ngClass]="inputMode() === 'URL' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border">
                <svg lucideLink class="w-3.5 h-3.5"></svg>
                <span>Por Enlace (URL)</span>
              </button>
              <button
                (click)="inputMode.set('TEXT')"
                [ngClass]="inputMode() === 'TEXT' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border">
                <svg lucideFileText class="w-3.5 h-3.5"></svg>
                <span>Pegar Texto</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- INPUT BAR CONTAINER -->
      <div class="max-w-6xl mx-auto w-full px-6 py-5">
        <div class="rounded-2xl bg-[#141824] border border-white/[0.08] p-4 shadow-xl space-y-3">
          @if (inputMode() === 'URL') {
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <svg lucideLink class="w-3.5 h-3.5 text-cyan-400"></svg>
                  <span>Enlace de la vacante (Workday, LinkedIn, Greenhouse, etc.)</span>
                </label>
                <button
                  (click)="loadWorkdayExample()"
                  class="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                  Probar con vacante Workday Litera
                </button>
              </div>
              <div class="flex gap-2">
                <input
                  type="url"
                  [(ngModel)]="urlInput"
                  placeholder="https://litera.wd12.myworkdayjobs.com/Litera_Careers/job/Denver-CO/Senior-Software-Engineer_R-501348-1"
                  class="flex-1 px-3.5 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"
                  (keyup.enter)="analyze()" />
                <button
                  (click)="analyze()"
                  [disabled]="isLoading() || !urlInput.trim()"
                  class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all">
                  @if (isLoading()) {
                    <svg lucideRefreshCw class="w-4 h-4 animate-spin"></svg>
                    <span>Analizando...</span>
                  } @else {
                    <svg lucideSparkles class="w-4 h-4"></svg>
                    <span>⚡ Analizar & Generar Kit</span>
                  }
                </button>
              </div>
            </div>
          } @else {
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <label class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <svg lucideFileText class="w-3.5 h-3.5 text-cyan-400"></svg>
                  <span>Descripción o requerimientos completos de la vacante</span>
                </label>
                <button
                  (click)="loadTextExample()"
                  class="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                  Cargar texto de ejemplo
                </button>
              </div>
              <textarea
                [(ngModel)]="textInput"
                rows="4"
                placeholder="Pega aquí el texto completo del rol, empresa, tecnologías requeridas y responsabilidades..."
                class="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 transition-colors"></textarea>
              <div class="flex justify-end">
                <button
                  (click)="analyze()"
                  [disabled]="isLoading() || !textInput.trim()"
                  class="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition-all">
                  @if (isLoading()) {
                    <svg lucideRefreshCw class="w-4 h-4 animate-spin"></svg>
                    <span>Analizando...</span>
                  } @else {
                    <svg lucideSparkles class="w-4 h-4"></svg>
                    <span>⚡ Analizar & Generar Kit</span>
                  }
                </button>
              </div>
            </div>
          }

          @if (errorMessage()) {
            <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <svg lucideAlertTriangle class="w-4 h-4 text-rose-400 shrink-0"></svg>
              <span>{{ errorMessage() }}</span>
            </div>
          }
        </div>
      </div>

      <!-- MAIN WORKBENCH BODY (2-COLUMN LAYOUT) -->
      @if (result(); as r) {
        <div class="max-w-6xl mx-auto w-full px-6 pb-12 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          <!-- LEFT PANEL: DIAGNOSTIC & GAPS (5 cols) -->
          <div class="lg:col-span-5 space-y-5">
            
            <!-- VACANCY CARD -->
            <div class="p-4 rounded-2xl bg-[#141824] border border-white/[0.08] space-y-3 shadow-lg">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <h2 class="text-sm font-bold text-white font-headline">{{ r.title }}</h2>
                  <div class="flex items-center gap-3 text-xs text-slate-400 mt-1 font-mono">
                    <span class="flex items-center gap-1 text-slate-300">
                      <svg lucideBuilding class="w-3.5 h-3.5 text-cyan-400"></svg>
                      {{ r.companyName }}
                    </span>
                    <span class="flex items-center gap-1 text-slate-400">
                      <svg lucideMapPin class="w-3.5 h-3.5 text-emerald-400"></svg>
                      {{ r.location }}
                    </span>
                  </div>
                </div>
                
                <!-- FIT SCORE PILL -->
                <div class="px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-mono text-xs font-bold border"
                     [ngClass]="r.fitScore >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : (r.fitScore >= 45 ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30')">
                  <span>{{ r.fitScore }}% FIT</span>
                </div>
              </div>

              <!-- REQUIRED SKILLS TAGS -->
              <div class="pt-2 border-t border-white/[0.06] space-y-1.5">
                <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Habilidades Detectadas</span>
                <div class="flex flex-wrap gap-1">
                  @for (skill of r.requiredSkills; track skill) {
                    <span class="px-2 py-0.5 rounded-md text-[10px] font-mono bg-white/[0.06] text-slate-300 border border-white/[0.08]">
                      {{ skill }}
                    </span>
                  }
                </div>
              </div>
            </div>

            <!-- 🎯 WHY APPLY? (DRIVERS) -->
            <div class="p-4 rounded-2xl bg-[#141824] border border-emerald-500/20 space-y-2.5 shadow-lg">
              <div class="flex items-center gap-2 text-xs font-bold text-emerald-400">
                <svg lucideCheckCircle2 class="w-4 h-4"></svg>
                <span>¿Por qué sí deberías aplicar? (Drivers)</span>
              </div>
              <div class="space-y-1.5 text-xs text-slate-300">
                @if (r.drivers && r.drivers.length > 0) {
                  @for (d of r.drivers; track $index) {
                    <div class="flex items-start gap-2 p-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10">
                      <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5"></svg>
                      <span class="leading-relaxed">{{ getFactorText(d) }}</span>
                    </div>
                  }
                } @else {
                  <p class="text-xs text-slate-400 italic">Alta compatibilidad con tu stack principal y seniority.</p>
                }
              </div>
            </div>

            <!-- ⚠️ WHAT IS MISSING? (SKILL GAPS & RECOMMENDATIONS) -->
            <div class="p-4 rounded-2xl bg-[#141824] border border-amber-500/20 space-y-2.5 shadow-lg">
              <div class="flex items-center gap-2 text-xs font-bold text-amber-400">
                <svg lucideAlertTriangle class="w-4 h-4"></svg>
                <span>¿Qué falta aprender o justificar? (Brecha / Gaps)</span>
              </div>
              <div class="space-y-1.5 text-xs text-slate-300">
                @if (r.drags && r.drags.length > 0) {
                  @for (drag of r.drags; track $index) {
                    <div class="flex items-start gap-2 p-2 rounded-lg bg-amber-500/[0.04] border border-amber-500/10">
                      <svg lucideChevronRight class="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5"></svg>
                      <span class="leading-relaxed">{{ getFactorText(drag) }}</span>
                    </div>
                  }
                } @else {
                  <p class="text-xs text-slate-400 italic">No se detectaron brechas críticas. Perfil 100% alineado con la vacante.</p>
                }
                @if (r.scoreNotes) {
                  <p class="text-[11px] text-slate-400 mt-2 p-2 rounded-lg bg-white/[0.03] border border-white/[0.06] font-mono leading-relaxed">
                    {{ r.scoreNotes }}
                  </p>
                }
              </div>
            </div>

          </div>

          <!-- RIGHT PANEL: HUMAN-IN-THE-LOOP EDITOR (7 cols) -->
          <div class="lg:col-span-7 flex flex-col rounded-2xl bg-[#141824] border border-white/[0.08] shadow-2xl overflow-hidden">
            
            <!-- TABS HEADER -->
            <div class="px-4 py-3 border-b border-white/[0.08] bg-[#10141f] flex items-center justify-between gap-3">
              <div class="flex items-center gap-1">
                <button
                  (click)="outputTab.set('CV')"
                  [ngClass]="outputTab() === 'CV' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                  class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all border flex items-center gap-1.5">
                  <svg lucideFileText class="w-3.5 h-3.5"></svg>
                  <span>1. CV Adaptado (ATS)</span>
                </button>
                <button
                  (click)="outputTab.set('LETTER')"
                  [ngClass]="outputTab() === 'LETTER' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                  class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all border flex items-center gap-1.5">
                  <svg lucideSparkles class="w-3.5 h-3.5"></svg>
                  <span>2. Carta de Presentación</span>
                </button>
                <button
                  (click)="outputTab.set('PROPOSAL')"
                  [ngClass]="outputTab() === 'PROPOSAL' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40 font-bold' : 'text-slate-400 hover:text-white border-transparent'"
                  class="px-3 py-1.5 rounded-lg text-xs font-mono transition-all border flex items-center gap-1.5">
                  <svg lucideCode2 class="w-3.5 h-3.5"></svg>
                  <span>3. Propuesta Técnica</span>
                </button>
              </div>

              <div class="flex items-center gap-2">
                <span class="text-[10px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-400/20 hidden sm:inline-block">
                  Edición Humana Activa
                </span>
                <div class="flex items-center p-0.5 rounded-lg bg-black/40 border border-white/[0.08] text-[10px] font-mono">
                  <button
                    (click)="setLanguage('en')"
                    [ngClass]="targetLanguage() === 'en' ? 'bg-cyan-500/30 text-cyan-200 font-bold' : 'text-slate-400 hover:text-white'"
                    class="px-2 py-0.5 rounded transition-all"
                    title="Alternar contenido a Inglés">
                    🇺🇸 EN
                  </button>
                  <button
                    (click)="setLanguage('es')"
                    [ngClass]="targetLanguage() === 'es' ? 'bg-cyan-500/30 text-cyan-200 font-bold' : 'text-slate-400 hover:text-white'"
                    class="px-2 py-0.5 rounded transition-all"
                    title="Alternar contenido a Español">
                    🇲🇽 ES
                  </button>
                </div>
              </div>
            </div>

            <!-- TAB CONTENT AREA -->
            <div class="p-5 flex-1 space-y-4">
              
              <!-- TAB 1: CV ATS ADAPTED -->
              @if (outputTab() === 'CV') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-200">Resumen Profesional (ATS Summary)</span>
                    <span class="text-[11px] font-mono text-slate-400">Modifica libremente antes de generar PDF</span>
                  </div>
                  <textarea
                    [(ngModel)]="editableSummary"
                    rows="4"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-400 transition-colors"></textarea>

                  <div class="flex items-center justify-between pt-2">
                    <span class="text-xs font-bold text-slate-200">Habilidades Clave Priorizadas</span>
                  </div>
                  <input
                    type="text"
                    [(ngModel)]="editableSkillsString"
                    class="w-full px-3.5 py-2 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400" />

                  <!-- ACTIONS BAR FOR CV -->
                  <div class="pt-4 border-t border-white/[0.08] flex items-center justify-between gap-3">
                    <button
                      (click)="copyCvText()"
                      class="px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all">
                      @if (copiedCv()) {
                        <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
                        <span class="text-emerald-400">¡Texto Copiado!</span>
                      } @else {
                        <svg lucideCopy class="w-3.5 h-3.5 text-slate-400"></svg>
                        <span>Copiar Texto ATS</span>
                      }
                    </button>

                    <button
                      (click)="downloadCompiledPdf()"
                      [disabled]="isCompilingPdf()"
                      class="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all">
                      @if (isCompilingPdf()) {
                        <svg lucideRefreshCw class="w-4 h-4 animate-spin"></svg>
                        <span>Compilando PDF...</span>
                      } @else {
                        <svg lucideDownload class="w-4 h-4"></svg>
                        <span>Descargar PDF ATS con tus Cambios</span>
                      }
                    </button>
                  </div>
                </div>
              }

              <!-- TAB 2: COVER LETTER -->
              @if (outputTab() === 'LETTER') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-200">Carta de Presentación (Gancho de Autoridad)</span>
                    <span class="text-[11px] font-mono text-slate-400">Optimizada para reclutadores & hiring managers</span>
                  </div>
                  <textarea
                    [(ngModel)]="editableCoverLetter"
                    rows="8"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-400 transition-colors"></textarea>

                  <div class="pt-4 border-t border-white/[0.08] flex items-center justify-end">
                    <button
                      (click)="copyLetterText()"
                      class="px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-xs font-mono text-cyan-300 flex items-center gap-1.5 transition-all">
                      @if (copiedLetter()) {
                        <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
                        <span class="text-emerald-400">¡Carta Copiada!</span>
                      } @else {
                        <svg lucideCopy class="w-3.5 h-3.5 text-cyan-400"></svg>
                        <span>Copiar Carta de Presentación</span>
                      }
                    </button>
                  </div>
                </div>
              }

              <!-- TAB 3: TECHNICAL PROPOSAL -->
              @if (outputTab() === 'PROPOSAL') {
                <div class="space-y-4">
                  <div class="flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-200">Arquitectura Propuesta & Roadmap de Solución</span>
                  </div>
                  
                  <!-- MERMAID CODE PREVIEW -->
                  @if (r.mermaidCode) {
                    <div class="p-3 rounded-xl bg-[#0d1017] border border-cyan-500/20 font-mono text-[11px] text-cyan-300 space-y-1">
                      <span class="text-[10px] text-slate-500 uppercase tracking-wider block">Diagrama de Arquitectura Mermaid:</span>
                      <pre class="overflow-x-auto">{{ r.mermaidCode }}</pre>
                    </div>
                  }

                  <textarea
                    [(ngModel)]="editableProposal"
                    rows="6"
                    class="w-full px-3.5 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.1] text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-cyan-400 transition-colors"></textarea>

                  <div class="pt-4 border-t border-white/[0.08] flex items-center justify-end">
                    <button
                      (click)="copyProposalText()"
                      class="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] text-xs font-mono text-slate-200 flex items-center gap-1.5 transition-all">
                      @if (copiedProposal()) {
                        <svg lucideCheck class="w-3.5 h-3.5 text-emerald-400"></svg>
                        <span class="text-emerald-400">¡Propuesta Copiada!</span>
                      } @else {
                        <svg lucideCopy class="w-3.5 h-3.5 text-slate-400"></svg>
                        <span>Copiar Propuesta Completa</span>
                      }
                    </button>
                  </div>
                </div>
              }

            </div>
          </div>

        </div>
      }

    </div>
  `
})
export class CustomJobWorkbenchComponent {
  private readonly customJobService = inject(CustomJobService);
  private readonly pipeline = inject(PipelineStateService);

  public readonly inputMode = signal<'URL' | 'TEXT'>('URL');
  public urlInput = '';
  public textInput = '';
  public readonly isLoading = signal<boolean>(false);
  public readonly errorMessage = signal<string>('');

  public readonly result = signal<CustomJobAnalysisResult | null>(null);
  public readonly outputTab = signal<'CV' | 'LETTER' | 'PROPOSAL'>('CV');
  public readonly targetLanguage = signal<'en' | 'es'>('en');

  // Human-in-the-loop editable fields
  public editableSummary = '';
  public editableSkillsString = '';
  public editableCoverLetter = '';
  public editableProposal = '';

  // Copy and compile flags
  public readonly copiedCv = signal<boolean>(false);
  public readonly copiedLetter = signal<boolean>(false);
  public readonly copiedProposal = signal<boolean>(false);
  public readonly isCompilingPdf = signal<boolean>(false);

  public setLanguage(lang: 'en' | 'es'): void {
    if (this.targetLanguage() === lang) return;
    this.targetLanguage.set(lang);
    if (this.result()) {
      this.analyze();
    }
  }

  public loadWorkdayExample(): void {
    this.urlInput = 'https://litera.wd12.myworkdayjobs.com/Litera_Careers/job/Denver-CO/Senior-Software-Engineer_R-501348-1';
  }

  public loadTextExample(): void {
    this.textInput = `Company: Litera
Role: Senior Software Engineer
Location: Denver, CO, United States

About Litera:
Litera is a global leader in legal technology software. We are seeking a Senior Software Engineer to build scalable cloud architectures.

Key Requirements:
- 5+ years of experience with TypeScript, Node.js, and modern frontends (Vue or Angular).
- Experience designing RESTful and GraphQL microservices.
- Solid knowledge of PostgreSQL, Redis, and cloud infrastructure on AWS.
- Background with Docker and CI/CD pipelines.`;
  }

  public analyze(): void {
    if (this.isLoading()) return;

    this.errorMessage.set('');
    const mode = this.inputMode();
    const payload = mode === 'URL'
      ? { url: this.urlInput.trim(), personaName: this.pipeline.activeProfile()?.name, lang: this.targetLanguage() }
      : { rawText: this.textInput.trim(), personaName: this.pipeline.activeProfile()?.name, lang: this.targetLanguage() };

    if (mode === 'URL' && !payload.url) {
      this.errorMessage.set('Por favor ingresa una URL válida.');
      return;
    }
    if (mode === 'TEXT' && !payload.rawText) {
      this.errorMessage.set('Por favor ingresa el texto de la vacante.');
      return;
    }

    this.isLoading.set(true);
    this.customJobService.analyzeJob(payload).subscribe({
      next: (res) => {
        this.result.set(res);
        this.isLoading.set(false);

        // Pre-cargar campos editables con los resultados de la IA
        this.editableSummary = res.adaptedCv?.summary?.text || '';
        const technicalSkills = res.adaptedCv?.skills_technical || [];
        this.editableSkillsString = technicalSkills
          .map((cat: any) => `${cat.category}: ${(cat.items || []).join(', ')}`)
          .join(' | ');

        this.editableCoverLetter = res.coverLetter?.paragraphs?.join('\n\n') || '';
        this.editableProposal = res.technicalProposal || '';
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(
          err?.error?.message || 'Error procesando la vacante. Verifica la URL o el formato del texto.'
        );
      },
    });
  }

  public getFactorText(factor: any): string {
    if (typeof factor === 'string') return factor;
    if (factor?.title && factor?.description) {
      return `${factor.title}: ${factor.description}`;
    }
    return factor?.title || factor?.description || JSON.stringify(factor);
  }

  public copyCvText(): void {
    const text = `RESUMEN PROFESIONAL:\n${this.editableSummary}\n\nHABILIDADES:\n${this.editableSkillsString}`;
    navigator.clipboard.writeText(text);
    this.copiedCv.set(true);
    setTimeout(() => this.copiedCv.set(false), 2000);
  }

  public copyLetterText(): void {
    navigator.clipboard.writeText(this.editableCoverLetter);
    this.copiedLetter.set(true);
    setTimeout(() => this.copiedLetter.set(false), 2000);
  }

  public copyProposalText(): void {
    const text = `${this.editableProposal}\n\n${this.result()?.mermaidCode || ''}`;
    navigator.clipboard.writeText(text);
    this.copiedProposal.set(true);
    setTimeout(() => this.copiedProposal.set(false), 2000);
  }

  public downloadCompiledPdf(): void {
    const currentResult = this.result();
    if (!currentResult || this.isCompilingPdf()) return;

    // Inyectar las modificaciones humanas del usuario en la estructura de cvData
    const cvPayload = {
      ...currentResult.adaptedCv,
      summary: { text: this.editableSummary },
    };

    this.isCompilingPdf.set(true);
    const safeCompany = (currentResult.companyName || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const lang = this.targetLanguage();
    const filename = `cv_ats_${safeCompany}_${lang}_${new Date().toISOString().slice(0, 10)}.pdf`;

    this.customJobService.compilePdf(cvPayload, filename).subscribe({
      next: (blob) => {
        this.isCompilingPdf.set(false);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.isCompilingPdf.set(false);
        alert('Error compilando el PDF en Gotenberg. Intenta nuevamente.');
      },
    });
  }
}

