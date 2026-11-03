import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideArrowUpDown,
  LucideBuilding2,
  LucideChevronDown,
  LucideChevronLeft,
  LucideChevronRight,
  LucideClock,
  LucideMaximize2,
  LucideMinimize2,
  LucidePhone,
  LucideSmartphone,
  LucideStore,
  LucideTable,
} from '@lucide/angular';
import { ProspectedBusiness } from '../../../core/services/prospecting.service';
import {
  DockViewMode,
  cleanPhoneDigits,
  formatPainTitle,
  formatPriceTier,
  getCooldownDaysLeft,
  getPainBadgeClass,
  getPainDotClass,
  isChainLead,
  isLeadInCooldown,
} from './geo-radar.models';

@Component({
  selector: 'app-geo-prospects-dock',
  standalone: true,
  imports: [
    CommonModule,
    LucideTable,
    LucideArrowUpDown,
    LucideChevronDown,
    LucideChevronLeft,
    LucideChevronRight,
    LucideMaximize2,
    LucideMinimize2,
    LucideBuilding2,
    LucideStore,
    LucideSmartphone,
    LucidePhone,
    LucideClock,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="geo-dock-sheet absolute z-20 bg-surface/95 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col overflow-hidden border border-border-subtle"
      [ngClass]="mode() === 'PEEK'
        ? 'geo-dock-sheet--peek'
        : mode() === 'SPLIT'
          ? 'geo-dock-sheet--split'
          : 'geo-dock-sheet--maximized'"
    >
      <!-- DOCK HEADER (48PX) -->
      <div class="h-12 px-4 border-b border-border-subtle bg-surface-elevated/90 flex items-center justify-between shrink-0 select-none">
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-2">
            <svg lucideTable class="w-4 h-4 text-cyan-400"></svg>
            <span class="text-xs font-bold text-content-primary tracking-wide">
              TABLA DE PROSPECTOS B2B
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 tabular-nums">
              {{ leads().length }} registros
            </span>
          </div>

          <div class="hidden sm:flex items-center gap-2 pl-3 border-l border-border-subtle text-[11px] font-mono tabular-nums">
            <span class="text-content-muted">Pipeline Total:</span>
            <span class="text-badge-high-text font-bold">~&#36;{{ totalPipelineUsd() | number }} USD</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            (click)="sortToggled.emit()"
            class="press-scale px-2.5 py-1 rounded-lg bg-app hover:bg-surface-hover text-content-secondary border border-border-subtle text-xs font-mono flex items-center gap-1.5 cursor-pointer"
            title="Ordenar por Ticket Estimado"
          >
            <svg lucideArrowUpDown class="w-3.5 h-3.5 text-cyan-400"></svg>
            <span>Ticket: {{ sortOrder() === 'DESC' ? 'Mayor a Menor' : 'Menor a Mayor' }}</span>
          </button>

          <div class="flex items-center bg-app p-0.5 rounded-lg border border-border-subtle">
            <button
              type="button"
              (click)="modeChanged.emit('PEEK')"
              [ngClass]="mode() === 'PEEK' ? 'bg-cyan-500/20 text-cyan-300' : 'text-content-muted hover:text-content-primary'"
              class="press-scale p-1 rounded text-xs cursor-pointer"
              title="Minimizar (Modo Peek)"
            >
              <svg lucideChevronDown class="w-3.5 h-3.5"></svg>
            </button>
            <button
              type="button"
              (click)="modeChanged.emit('SPLIT')"
              [ngClass]="mode() === 'SPLIT' ? 'bg-cyan-500/20 text-cyan-300' : 'text-content-muted hover:text-content-primary'"
              class="press-scale px-2 py-0.5 rounded text-xs font-semibold cursor-pointer"
              title="Modo Dual 50% (Mapa + Tabla)"
            >
              50%
            </button>
            <button
              type="button"
              (click)="modeChanged.emit(mode() === 'MAXIMIZED' ? 'SPLIT' : 'MAXIMIZED')"
              [ngClass]="mode() === 'MAXIMIZED' ? 'bg-cyan-500/20 text-cyan-300' : 'text-content-muted hover:text-content-primary'"
              class="press-scale p-1 rounded text-xs cursor-pointer"
              title="Pantalla Completa"
            >
              @if (mode() === 'MAXIMIZED') {
                <svg lucideMinimize2 class="w-3.5 h-3.5"></svg>
              } @else {
                <svg lucideMaximize2 class="w-3.5 h-3.5"></svg>
              }
            </button>
          </div>
        </div>
      </div>

      <!-- TABLE BODY -->
      @if (mode() !== 'PEEK') {
        <div
          class="overflow-auto"
          [ngClass]="mode() === 'SPLIT' ? 'max-h-[45vh]' : 'flex-1'"
        >
          <table class="w-full text-left border-collapse text-xs">
            <thead class="sticky top-0 bg-surface-elevated z-10 border-b border-border-subtle text-[10px] font-semibold text-content-muted uppercase tracking-wider select-none">
              <tr>
                <th class="py-2.5 px-3">Empresa B2B</th>
                <th class="py-2.5 px-3">Reputación</th>
                <th class="py-2.5 px-3">Dolencia Principal</th>
                <th class="py-2.5 px-3 text-right">Ticket Est. (USD)</th>
                <th class="py-2.5 px-3">Canal Directo</th>
                <th class="py-2.5 px-3 text-center">Estado</th>
                <th class="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @for (lead of pagedLeads(); track lead.id) {
                <tr
                  (mouseenter)="rowHovered.emit(lead)"
                  (mouseleave)="rowHoverLeft.emit()"
                  (click)="leadSelected.emit(lead)"
                  class="hover:bg-surface-hover transition-colors cursor-pointer group"
                  [ngClass]="selectedLeadId() === lead.id ? 'bg-cyan-500/10' : ''"
                >
                  <td class="py-2 px-3">
                    <div class="font-bold text-content-primary group-hover:text-cyan-300 transition-colors line-clamp-1">
                      {{ lead.name }}
                    </div>
                    <div class="flex items-center gap-1.5 mt-0.5 text-[10px] text-content-muted">
                      @if (checkChain(lead)) {
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold">
                          <svg lucideBuilding2 class="w-2.5 h-2.5"></svg>
                          <span>{{ lead.corporateBrand?.name || 'Franquicia' }}</span>
                        </span>
                      } @else {
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-badge-high-bg text-badge-high-text border border-emerald-500/30 font-semibold">
                          <svg lucideStore class="w-2.5 h-2.5"></svg>
                          <span>Independiente</span>
                        </span>
                      }
                      <span class="truncate max-w-[220px]" [title]="lead.address || lead.city">{{ lead.address || lead.city }}</span>
                    </div>
                  </td>

                  <td class="py-2 px-3 font-mono tabular-nums">
                    <span class="text-amber-400 font-bold">{{ lead.rating || '—' }} ★</span>
                    <span class="text-[10px] text-content-muted ml-1">({{ lead.reviewsCount }})</span>
                  </td>

                  <td class="py-2 px-3">
                    <span
                      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold"
                      [ngClass]="painBadge(lead)"
                    >
                      <span class="w-1.5 h-1.5 rounded-full" [ngClass]="painDot(lead)"></span>
                      <span>{{ painTitle(lead) }}</span>
                    </span>
                  </td>

                  <td class="py-2 px-3 text-right font-mono font-bold text-cyan-300 tabular-nums">
                    @if (lead.estimatedTicketUsd) {
                      <span>~&#36;{{ lead.estimatedTicketUsd }}</span>
                      <span class="text-[10px] text-content-muted ml-1 font-normal">{{ priceTier(lead) }}</span>
                    } @else {
                      <span class="text-content-muted">—</span>
                    }
                  </td>

                  <td class="py-2 px-3" (click)="$event.stopPropagation()">
                    @if (lead.phoneType === 'MOBILE' && (lead.phoneE164 || lead.phone)) {
                      <a
                        [href]="buildWhatsappLink(lead)"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="press-scale inline-flex items-center gap-1 px-2 py-1 rounded-md bg-badge-high-bg hover:bg-emerald-500/25 text-badge-high-text border border-emerald-500/30 text-[10px] font-bold"
                      >
                        <svg lucideSmartphone class="w-3 h-3"></svg>
                        <span>WhatsApp</span>
                      </a>
                    } @else if (lead.phone) {
                      <a
                        [href]="'tel:' + (lead.phoneE164 || cleanDigits(lead.phone))"
                        class="press-scale inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover text-content-secondary border border-border-subtle text-[10px] font-mono tabular-nums"
                      >
                        <svg lucidePhone class="w-3 h-3"></svg>
                        <span>{{ lead.phoneE164 || lead.phone }}</span>
                      </a>
                    } @else {
                      <span class="text-[10px] text-content-muted">Sin teléfono</span>
                    }
                  </td>

                  <td class="py-2 px-3 text-center">
                    @if (checkCooldown(lead)) {
                      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-badge-med-bg text-badge-med-text border border-amber-500/30 text-[10px] font-mono tabular-nums">
                        <svg lucideClock class="w-2.5 h-2.5"></svg>
                        <span>{{ cooldownDays(lead) }}d</span>
                      </span>
                    } @else if (lead.status === 'CONTACTED') {
                      <span class="px-2 py-0.5 rounded bg-badge-high-bg text-badge-high-text text-[10px] font-semibold">
                        Contactado
                      </span>
                    } @else {
                      <span class="px-2 py-0.5 rounded bg-app text-content-muted border border-border-subtle text-[10px]">
                        Nuevo
                      </span>
                    }
                  </td>

                  <td class="py-2 px-3 text-right">
                    <button
                      type="button"
                      (click)="leadSelected.emit(lead)"
                      class="press-scale px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold cursor-pointer"
                    >
                      Abrir CRM
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7" class="py-8 text-center text-content-muted text-xs font-mono">
                    Sin prospectos en esta vista. Usa Escanear para iniciar el barrido comercial.
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <!-- DOCK PAGINATION FOOTER BAR -->
          @if (totalPages() > 1) {
            <div class="px-4 py-2 border-t border-border-subtle bg-surface-elevated flex items-center justify-between text-xs select-none">
              <span class="text-content-muted font-mono text-[11px] tabular-nums">
                Mostrando {{ startItemIndex() }}-{{ endItemIndex() }} de {{ leads().length }} prospectos
              </span>
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  data-testid="dock-prev-page"
                  (click)="goToPage(currentPage() - 1)"
                  [disabled]="currentPage() <= 1"
                  class="press-scale p-1 rounded-md bg-app hover:bg-surface-hover text-content-secondary border border-border-subtle disabled:opacity-30 cursor-pointer"
                  title="Página anterior"
                >
                  <svg lucideChevronLeft class="w-3.5 h-3.5"></svg>
                </button>
                <span class="px-2 font-mono text-[11px] text-cyan-300 font-bold tabular-nums">
                  {{ currentPage() }} / {{ totalPages() }}
                </span>
                <button
                  type="button"
                  data-testid="dock-next-page"
                  (click)="goToPage(currentPage() + 1)"
                  [disabled]="currentPage() >= totalPages()"
                  class="press-scale p-1 rounded-md bg-app hover:bg-surface-hover text-content-secondary border border-border-subtle disabled:opacity-30 cursor-pointer"
                  title="Página siguiente"
                >
                  <svg lucideChevronRight class="w-3.5 h-3.5"></svg>
                </button>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class GeoProspectsDockComponent {
  readonly leads = input.required<ProspectedBusiness[]>();
  readonly selectedLeadId = input.required<string | null>();
  readonly totalPipelineUsd = input.required<number>();
  readonly mode = input.required<DockViewMode>();
  readonly sortOrder = input.required<'ASC' | 'DESC'>();
  readonly currentPage = input<number>(1);
  readonly pageSize = input<number>(25);

  readonly modeChanged = output<DockViewMode>();
  readonly sortToggled = output<void>();
  readonly leadSelected = output<ProspectedBusiness>();
  readonly rowHovered = output<ProspectedBusiness>();
  readonly rowHoverLeft = output<void>();
  readonly pageChanged = output<number>();

  readonly totalPages = computed(() => {
    const total = this.leads().length;
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly startItemIndex = computed(() => {
    if (this.leads().length === 0) return 0;
    return (this.currentPage() - 1) * this.pageSize() + 1;
  });

  readonly endItemIndex = computed(() => {
    return Math.min(this.leads().length, this.currentPage() * this.pageSize());
  });

  readonly pagedLeads = computed(() => {
    const list = this.leads();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return list.slice(start, start + size);
  });

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages()) {
      this.pageChanged.emit(page);
    }
  }

  checkChain(lead: ProspectedBusiness): boolean {
    return isChainLead(lead);
  }

  checkCooldown(lead: ProspectedBusiness): boolean {
    return isLeadInCooldown(lead);
  }

  cooldownDays(lead: ProspectedBusiness): number {
    return getCooldownDaysLeft(lead);
  }

  painBadge(lead: ProspectedBusiness): string {
    return getPainBadgeClass(lead.primaryPain);
  }

  painDot(lead: ProspectedBusiness): string {
    return getPainDotClass(lead.primaryPain);
  }

  painTitle(lead: ProspectedBusiness): string {
    return formatPainTitle(lead.primaryPain);
  }

  priceTier(lead: ProspectedBusiness): string {
    return formatPriceTier(lead.priceLevel);
  }

  cleanDigits(phone?: string | null): string {
    return cleanPhoneDigits(phone);
  }

  buildWhatsappLink(lead: ProspectedBusiness): string {
    const digits = cleanPhoneDigits(lead.phoneE164 || lead.phone || '');
    const msg = encodeURIComponent(
      lead.salesPitchDraft ||
        `Hola equipo de ${lead.name}, preparamos una propuesta digital para su sucursal en ${lead.city}.`,
    );
    return `https://wa.me/${digits}?text=${msg}`;
  }
}
