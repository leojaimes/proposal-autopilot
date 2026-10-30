import { Component, ChangeDetectionStrategy, inject, signal, computed, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PipelineStateService } from '../../core/services/pipeline-state.service';
import { ReportService } from '../../core/services/report.service';
import { AuthService } from '../../core/services/auth.service';
import { I18nPipe } from '../../core/pipes/i18n.pipe';
import { AppViewMode } from '../dispatch/dispatch-header.component';
import {
  LucideZap,
  LucideSearch,
  LucideCompass,
  LucideUser,
  LucideSettings,
  LucideRefreshCw,
  LucidePin,
  LucidePinOff,
  LucideLogOut,
  LucideShield,
  LucideSparkles
} from '@lucide/angular';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    CommonModule,
    I18nPipe,
    LucideZap,
    LucideSearch,
    LucideCompass,
    LucideUser,
    LucideSettings,
    LucideRefreshCw,
    LucidePin,
    LucidePinOff,
    LucideLogOut,
    LucideShield,
    LucideSparkles
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- SIDEBAR CONTAINER: Rail en reposo (56px) o Pinned (220px), expandido en hover si no está pinned -->
    <aside
      class="h-screen bg-[#0d1017]/95 border-r border-border-subtle/70 select-none flex flex-col justify-between transition-all duration-200 ease-out z-40 shrink-0"
      [ngClass]="{
        'w-[220px]': isPinned(),
        'w-14': !isPinned() && !isHovered(),
        'w-[220px] fixed top-0 left-0 shadow-[8px_0_24px_rgba(0,0,0,0.6)] backdrop-blur-xl border-r-cyan-500/20': !isPinned() && isHovered()
      }"
      (mouseenter)="onMouseEnter()"
      (mouseleave)="onMouseLeave()">

      <!-- TOP: BRAND & PIN TOGGLE -->
      <div class="flex flex-col">
        <div class="h-14 px-3 flex items-center justify-between border-b border-white/[0.06] overflow-hidden">
          <div class="flex items-center gap-2.5 overflow-hidden">
            <div class="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center font-bold text-cyan-400 text-xs shadow-[0_0_12px_rgba(76,215,246,0.25)] shrink-0">
              PA
            </div>
            @if (isExpandedView()) {
              <div class="flex flex-col min-w-0 animate-in fade-in duration-150">
                <span class="text-xs font-bold text-white tracking-tight truncate font-headline">Proposal Autopilot</span>
                <span class="text-[9px] text-content-muted font-mono leading-none">Cockpit Intelligence</span>
              </div>
            }
          </div>

          <!-- PIN TOGGLE BUTTON (Visible when expanded) -->
          @if (isExpandedView()) {
            <button
              (click)="togglePin()"
              [title]="isPinned() ? 'Desanclar barra (colapsar a iconos)' : 'Fijar barra abierta'"
              class="p-1 rounded-lg hover:bg-white/[0.08] text-content-muted hover:text-cyan-400 transition-colors">
              @if (isPinned()) {
                <svg lucidePinOff class="w-3.5 h-3.5 text-cyan-400"></svg>
              } @else {
                <svg lucidePin class="w-3.5 h-3.5"></svg>
              }
            </button>
          }
        </div>

        <!-- NAVIGATION ITEMS -->
        <nav class="p-2 space-y-1">
          <!-- CABINA DE DESPACHO -->
          <button
            (click)="viewModeChange.emit('TERMINAL')"
            [ngClass]="activeView() === 'TERMINAL' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30 font-bold' : 'text-content-secondary hover:text-content-primary hover:bg-white/[0.05] border-transparent'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all border group relative"
            title="Cabina de Despacho">
            <svg lucideZap class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"></svg>
            @if (isExpandedView()) {
              <span class="truncate flex-1 text-left">Cabina</span>
              @if (highFitCount() > 0) {
                <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">
                  {{ highFitCount() }}
                </span>
              }
            } @else {
              @if (highFitCount() > 0) {
                <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
              }
            }
          </button>

          <!-- MOTOR DE BÚSQUEDA / EXPLORER -->
          <button
            (click)="viewModeChange.emit('EXPLORER')"
            [ngClass]="activeView() === 'EXPLORER' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30 font-bold' : 'text-content-secondary hover:text-content-primary hover:bg-white/[0.05] border-transparent'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all border group"
            title="Motor de Búsqueda">
            <svg lucideSearch class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"></svg>
            @if (isExpandedView()) {
              <span class="truncate flex-1 text-left">Explorador</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-white/[0.08] text-content-muted">
                {{ report.jobs().length }}
              </span>
            }
          </button>

          <!-- RADAR DE MERCADO -->
          <button
            (click)="viewModeChange.emit('RADAR')"
            [ngClass]="activeView() === 'RADAR' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30 font-bold' : 'text-content-secondary hover:text-content-primary hover:bg-white/[0.05] border-transparent'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all border group relative"
            title="Radar de Mercado">
            <svg lucideCompass class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"></svg>
            @if (isExpandedView()) {
              <span class="truncate flex-1 text-left">Radar</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                Live
              </span>
            } @else {
              <span class="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            }
          </button>

          <!-- PERFIL & AJUSTES -->
          <button
            (click)="viewModeChange.emit('PROFILE')"
            [ngClass]="activeView() === 'PROFILE' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30 font-bold' : 'text-content-secondary hover:text-content-primary hover:bg-white/[0.05] border-transparent'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all border group"
            title="Perfil de Posicionamiento">
            <svg lucideUser class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110"></svg>
            @if (isExpandedView()) {
              <span class="truncate flex-1 text-left">Mi Perfil</span>
            }
          </button>
          <!-- TALLER 1:1 / VACANTES EXTERNAS -->
          <button
            (click)="viewModeChange.emit('WORKBENCH')"
            [ngClass]="activeView() === 'WORKBENCH' ? 'bg-cyan-500/15 text-cyan-400 border-cyan-400/30 font-bold' : 'text-content-secondary hover:text-content-primary hover:bg-white/[0.05] border-transparent'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs transition-all border group"
            title="Taller 1:1 - Analizador de Vacante Externa">
            <svg lucideSparkles class="w-4 h-4 shrink-0 transition-transform group-hover:scale-110 text-cyan-400"></svg>
            @if (isExpandedView()) {
              <span class="truncate flex-1 text-left">Taller 1:1</span>
              <span class="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                Nuevo
              </span>
            }
          </button>
        </nav>

        <!-- ACCIONES RÁPIDAS (SCRAPE & RE-EVALUAR) -->
        <div class="px-2 pt-2 pb-1 border-t border-white/[0.06] space-y-1">
          <!-- SCRAPEAR SEGÚN PLATAFORMA ACTIVA (UPWORK / LINKEDIN) -->
          <button
            (click)="triggerCurrentPlatformScrape()"
            [disabled]="report.isScrapingInProgress()"
            [ngClass]="activeScrapePlatform() === 'LINKEDIN'
              ? 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border-sky-400/30'
              : 'bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border-cyan-400/30'"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-bold border transition-all group disabled:opacity-50"
            [title]="scrapeButtonLabel()">
            @if (report.isScrapingInProgress()) {
              <svg lucideRefreshCw class="w-4 h-4 shrink-0 animate-spin" [ngClass]="activeScrapePlatform() === 'LINKEDIN' ? 'text-sky-400' : 'text-cyan-400'"></svg>
            } @else {
              <svg lucideZap class="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" [ngClass]="activeScrapePlatform() === 'LINKEDIN' ? 'text-sky-400' : 'text-cyan-400'"></svg>
            }
            @if (isExpandedView()) {
              <span class="truncate text-left flex-1">
                {{ report.isScrapingInProgress() ? 'Scrapeando...' : scrapeButtonLabel() }}
              </span>
            }
          </button>

          <!-- RE-EVALUAR LEADS ($0 TOKENS) -->
          <button
            (click)="reprocessLeads()"
            [disabled]="report.isReprocessing() || report.isScrapingInProgress()"
            class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 transition-all group disabled:opacity-50"
            title="Re-evaluar Leads ($0 tokens)">
            @if (report.isReprocessing()) {
              <svg lucideRefreshCw class="w-4 h-4 shrink-0 animate-spin text-emerald-400"></svg>
            } @else {
              <svg lucideShield class="w-4 h-4 shrink-0 text-emerald-400 group-hover:scale-110 transition-transform"></svg>
            }
            @if (isExpandedView()) {
              <span class="truncate text-left flex-1">Re-evaluar ($0)</span>
            }
          </button>
        </div>
      </div>

      <!-- BOTTOM: TELEMETRÍA, CALIBRADOR & USUARIO -->
      <div class="p-2 border-t border-white/[0.06] space-y-1">
        <!-- BOTÓN CAJÓN DE CALIBRACIÓN -->
        <button
          (click)="openSettings.emit()"
          class="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-xs text-content-secondary hover:text-content-primary hover:bg-white/[0.05] transition-all group"
          title="Calibrar Motor">
          <svg lucideSettings class="w-4 h-4 shrink-0 transition-transform group-hover:rotate-45"></svg>
          @if (isExpandedView()) {
            <span class="truncate text-left flex-1">Calibrar Motor</span>
          }
        </button>

        <!-- CONNECTS TELEMETRY WIDGET -->
        @if (isExpandedView()) {
          <div class="px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/[0.05] flex flex-col gap-0.5 animate-in fade-in duration-150">
            <div class="flex items-center justify-between text-[10px] text-content-muted font-mono">
              <span>Connects</span>
              <span class="text-emerald-400 font-bold">{{ lowFitCount() * 16 }}</span>
            </div>
            <div class="text-[9px] text-content-muted font-mono">
              Ahorro: ~{{ lowFitSavings() }} USD
            </div>
          </div>
        }

        <!-- USER / TENANT PROFILE -->
        <div class="pt-1 flex items-center justify-between px-1">
          <div class="flex items-center gap-2 overflow-hidden">
            <div class="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-300 font-bold text-xs flex items-center justify-center shrink-0 border border-cyan-400/30 font-mono">
              {{ getInitials() }}
            </div>
            @if (isExpandedView()) {
              <div class="flex flex-col min-w-0 truncate">
                <span class="text-xs font-bold text-content-primary truncate leading-tight">
                  {{ pipeline.activeProfile()?.name || auth.currentUser()?.email || 'Operador' }}
                </span>
                <span class="text-[9px] text-content-muted font-mono truncate">
                  {{ auth.currentTenant()?.name || 'Workspace' }}
                </span>
              </div>
            }
          </div>

          @if (isExpandedView()) {
            <button
              (click)="auth.logout()"
              class="p-1 rounded-lg hover:bg-rose-500/20 text-content-muted hover:text-rose-400 transition-colors"
              title="Cerrar Sesión">
              <svg lucideLogOut class="w-3.5 h-3.5"></svg>
            </button>
          }
        </div>
      </div>
    </aside>
  `
})
export class AppSidebarComponent {
  public readonly auth = inject(AuthService);
  public readonly pipeline = inject(PipelineStateService);
  public readonly report = inject(ReportService);

  public readonly activeView = input.required<AppViewMode>();
  public readonly viewModeChange = output<AppViewMode>();
  public readonly openSettings = output<void>();

  public readonly isHovered = signal<boolean>(false);
  public readonly isPinned = signal<boolean>(false);

  private hoverTimeout: any = null;

  public readonly isExpandedView = computed(() => {
    return this.isPinned() || this.isHovered();
  });

  public readonly activeScrapePlatform = computed<'UPWORK' | 'LINKEDIN'>(() => {
    const isLinkedInEnabled = this.pipeline.enabledScrapingProviders().includes('LINKEDIN');
    return (this.report.selectedPlatform() === 'LINKEDIN' && isLinkedInEnabled) ? 'LINKEDIN' : 'UPWORK';
  });

  public readonly scrapeButtonLabel = computed<string>(() => {
    return this.activeScrapePlatform() === 'LINKEDIN' ? 'Scrapear LinkedIn' : 'Scrapear Upwork';
  });

  public readonly highFitCount = computed(() => {
    return this.report.jobs().filter(j => j.fitLabel === 'High' || j.fitScore >= 70).length;
  });

  public readonly lowFitCount = computed(() => {
    return this.report.jobs().filter(j => j.fitLabel === 'Low' || j.fitScore < 50).length;
  });

  public readonly lowFitSavings = computed(() => {
    return (this.lowFitCount() * 16 * 0.15).toFixed(2);
  });

  public onMouseEnter(): void {
    if (this.isPinned()) return;
    this.hoverTimeout = setTimeout(() => {
      this.isHovered.set(true);
    }, 80);
  }

  public onMouseLeave(): void {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
      this.hoverTimeout = null;
    }
    if (!this.isPinned()) {
      this.isHovered.set(false);
    }
  }

  public togglePin(): void {
    const next = !this.isPinned();
    this.isPinned.set(next);
    if (!next) {
      this.isHovered.set(false);
    }
  }

  public triggerCurrentPlatformScrape(): void {
    const keywords = this.pipeline.activeQueriesList();
    this.report.triggerLiveScrape(30, keywords.length > 0 ? keywords : undefined, this.activeScrapePlatform());
  }

  public triggerScrape(platform: 'UPWORK' | 'LINKEDIN'): void {
    const keywords = this.pipeline.activeQueriesList();
    this.report.triggerLiveScrape(30, keywords.length > 0 ? keywords : undefined, platform);
  }

  public reprocessLeads(): void {
    this.report.reprocessLeads().subscribe();
  }

  public getInitials(): string {
    const name = this.pipeline.activeProfile()?.name || this.auth.currentUser()?.email || 'OP';
    return name.substring(0, 2).toUpperCase();
  }
}
