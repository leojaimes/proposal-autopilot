import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideChevronDown,
  LucideChevronUp,
  LucideCrosshair,
  LucideLayers,
  LucideMapPin,
  LucideSearch,
  LucideSliders,
  LucideSparkles,
  LucideX,
} from '@lucide/angular';
import { StreamProgressState } from '../../../core/services/prospecting.service';
import { CityOption, CountryOption } from './geo-radar.models';

@Component({
  selector: 'app-geo-location-combobox',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideMapPin,
    LucideCrosshair,
    LucideSearch,
    LucideSliders,
    LucideLayers,
    LucideSparkles,
    LucideChevronDown,
    LucideChevronUp,
    LucideX,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="border-b border-border-subtle bg-surface">
      <!-- TOP BAR: TITLE + ZONE SUMMARY / COLLAPSE TOGGLE -->
      <div class="px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <div class="w-6 h-6 rounded-lg bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center text-cyan-400 shrink-0">
            <svg lucideCrosshair class="w-3.5 h-3.5"></svg>
          </div>
          <div class="flex items-center gap-1.5 min-w-0">
            <h2 class="font-bold text-xs tracking-wide text-content-primary truncate">GEO-RADAR</h2>
            <span class="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-surface-elevated text-cyan-400 border border-border-subtle shrink-0">
              Prospector B2B
            </span>
          </div>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <span class="text-[10px] font-mono text-content-muted tabular-nums">
            {{ leadsCount() }} prospectos
          </span>
          <button
            type="button"
            (click)="toggleCollapse.emit()"
            class="press-scale px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-[10px] font-semibold text-cyan-300 flex items-center gap-1 cursor-pointer"
            [title]="isCollapsed() ? 'Expandir configuración de zona y giro comercial' : 'Contraer panel de configuración'"
          >
            <span>{{ isCollapsed() ? 'Cambiar zona' : 'Contraer' }}</span>
            @if (isCollapsed()) {
              <svg lucideChevronDown class="w-3 h-3"></svg>
            } @else {
              <svg lucideChevronUp class="w-3 h-3"></svg>
            }
          </button>
        </div>
      </div>

      <!-- COMPACT 1-LINE SUMMARY BAR (HIGH DENSITY MODE: RECLAIMS +220PX VERTICAL SPACE) -->
      @if (isCollapsed()) {
        <div class="px-3.5 pb-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            (click)="toggleCollapse.emit()"
            class="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-subtle flex items-center gap-2 text-left transition-colors cursor-pointer"
          >
            <span class="px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[9px] font-bold shrink-0">
              {{ activeCountryCode() }}
            </span>
            <span class="text-[11px] font-semibold text-content-primary truncate">
              {{ selectedCity() }}
            </span>
            <span class="text-[10px] text-content-muted truncate">
              · {{ selectedSector() }} ·
              {{ scanMode() === 'POLYGON' ? (polygonVerticesCount() + ' vértices · ' + polygonAreaKm2() + ' km²') : (radiusKm() + ' km') }}
            </span>
          </button>

          <button
            type="button"
            (click)="scanRequested.emit()"
            [disabled]="isScanning()"
            class="press-scale px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            @if (isScanning()) {
              <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              <span>Auditando</span>
            } @else {
              <svg lucideSparkles class="w-3 h-3"></svg>
              <span>Escanear</span>
            }
          </button>
        </div>
      } @else {
        <!-- EXPANDED ZONE & SECTOR CONFIGURATION -->
        <div class="px-3.5 pb-3.5 space-y-2.5">
          <!-- COUNTRY SEGMENTED SELECTOR (ZERO NATIVE OS DROPDOWNS, ZERO BROKEN EMOJIS) -->
          <div class="space-y-1">
            <div class="flex items-center justify-between text-[10px] font-semibold text-content-secondary uppercase tracking-wider">
              <span>Territorio</span>
              <span class="font-mono text-content-muted tabular-nums">{{ totalPresetsCount() | number }} zonas</span>
            </div>
            <div class="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-app border border-border-subtle">
              @for (country of countries(); track country.countryCode) {
                <button
                  type="button"
                  [attr.data-testid]="'country-pill-' + country.countryCode"
                  (click)="selectCountry(country.countryName)"
                  class="press-scale py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                  [ngClass]="selectedCountry() === country.countryName
                    ? 'bg-surface-elevated text-cyan-300 border border-cyan-500/40'
                    : 'text-content-secondary hover:text-content-primary'"
                >
                  <span class="font-mono text-[9px] px-1 rounded bg-white/[0.06] text-cyan-400">
                    {{ country.countryCode }}
                  </span>
                  <span class="truncate">{{ country.label }}</span>
                </button>
              }
            </div>
          </div>

          <!-- UNIFIED WAI-ARIA SEARCHABLE COMBOBOX (STATE + CITY + TACTICAL CORRIDORS) -->
          <div class="space-y-1 relative">
            <label class="text-[10px] font-semibold text-content-secondary uppercase tracking-wider flex items-center justify-between">
              <span>Municipio o Corredor Táctico</span>
              <span class="text-[10px] font-mono text-content-muted tabular-nums">{{ matchingCities().length }} coincidencias</span>
            </label>

            <div class="relative">
              <svg lucideSearch class="w-3.5 h-3.5 text-content-muted absolute left-2.5 top-2 pointer-events-none"></svg>
              <input
                type="text"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="geo-city-listbox"
                [attr.aria-expanded]="isDropdownOpen()"
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)"
                (focus)="openDropdown()"
                (keydown)="onComboboxKeydown($event)"
                [placeholder]="selectedCity() + ', ' + selectedState() + ' — escribir para buscar...'"
                class="w-full bg-app border border-border-subtle rounded-lg pl-8 pr-7 py-1.5 text-xs text-content-primary placeholder-content-secondary focus:outline-none focus:border-cyan-500"
              />
              @if (searchQuery()) {
                <button
                  type="button"
                  (click)="clearSearch()"
                  class="absolute right-2 top-1.5 p-0.5 text-content-muted hover:text-content-primary cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  <svg lucideX class="w-3.5 h-3.5"></svg>
                </button>
              }
            </div>

            @if (isDropdownOpen()) {
              <ul
                id="geo-city-listbox"
                role="listbox"
                class="absolute left-0 right-0 top-full mt-1 z-40 max-h-52 overflow-y-auto rounded-xl bg-surface-elevated border border-border-subtle shadow-2xl p-1 space-y-0.5"
              >
                @for (item of visibleDropdownCities(); track item.id; let idx = $index) {
                  <li
                    role="option"
                    [attr.aria-selected]="selectedCity() === item.name && selectedState() === item.state"
                    (mousedown)="pickCityOption(item, $event)"
                    (mouseenter)="activeIndex.set(idx)"
                    class="px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                    [ngClass]="activeIndex() === idx
                      ? 'bg-cyan-500/15 text-content-primary'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'"
                  >
                    <div class="flex items-center gap-1.5 min-w-0">
                      @if (item.isTactical) {
                        <span class="px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-mono text-[9px] font-bold shrink-0">
                          TÁCTICO
                        </span>
                      } @else {
                        <svg lucideMapPin class="w-3 h-3 text-content-muted shrink-0"></svg>
                      }
                      <span class="font-medium truncate">{{ item.name }}</span>
                    </div>
                    <span class="text-[10px] font-mono text-content-muted shrink-0 truncate max-w-[120px]">
                      {{ item.state }}
                    </span>
                  </li>
                } @empty {
                  <li class="px-3 py-3 text-center text-[11px] text-content-muted font-mono">
                    Sin municipios para "{{ searchQuery() }}" en {{ selectedCountry() }}
                  </li>
                }
              </ul>
            }
          </div>

          <!-- SECTOR INPUT & QUICK CHIPS -->
          <div class="space-y-1">
            <label class="text-[10px] font-semibold text-content-secondary uppercase tracking-wider flex items-center justify-between">
              <span>Giro Comercial</span>
              <span class="text-cyan-400 text-[10px] font-mono">Google Maps Live</span>
            </label>
            <input
              type="text"
              [ngModel]="selectedSector()"
              (ngModelChange)="sectorChange.emit($event)"
              placeholder="Ej. Dentistas, Clínicas, Notarías, Logística..."
              class="w-full bg-app border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-content-primary placeholder-content-muted focus:outline-none focus:border-cyan-500"
            />
            <div class="flex flex-wrap gap-1 pt-0.5">
              @for (chip of popularSectors(); track chip) {
                <button
                  type="button"
                  (click)="sectorChange.emit(chip)"
                  class="press-scale text-[10px] px-2 py-0.5 rounded-md border cursor-pointer"
                  [ngClass]="selectedSector() === chip
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-semibold'
                    : 'bg-app text-content-secondary border-border-subtle hover:text-content-primary'"
                >
                  {{ chip }}
                </button>
              }
            </div>
          </div>

          <!-- DELIMITATION: RADIUS VS TACTICAL POLYGON -->
          <div class="space-y-1.5">
            <div class="grid grid-cols-2 gap-1 p-0.5 bg-app rounded-lg border border-border-subtle">
              <button
                type="button"
                (click)="scanModeChange.emit('RADIUS')"
                class="press-scale py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                [ngClass]="scanMode() === 'RADIUS'
                  ? 'bg-surface-elevated text-cyan-300 border border-cyan-500/40'
                  : 'text-content-secondary hover:text-content-primary'"
              >
                <svg lucideSliders class="w-3 h-3"></svg>
                <span>Radio ({{ radiusKm() }} km)</span>
              </button>
              <button
                type="button"
                (click)="scanModeChange.emit('POLYGON')"
                class="press-scale py-1 px-2 rounded-md text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                [ngClass]="scanMode() === 'POLYGON'
                  ? 'bg-surface-elevated text-cyan-300 border border-cyan-500/40'
                  : 'text-content-secondary hover:text-content-primary'"
              >
                <svg lucideLayers class="w-3 h-3"></svg>
                <span>Polígono Táctico</span>
              </button>
            </div>

            @if (scanMode() === 'RADIUS') {
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                [ngModel]="radiusKm()"
                (ngModelChange)="radiusChange.emit($event)"
                class="w-full accent-cyan-400 bg-surface-elevated h-1.5 rounded-lg cursor-pointer"
              />
            } @else {
              @if (polygonVerticesCount() >= 3) {
                <div class="px-2.5 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-between text-[11px]">
                  <span class="text-cyan-300 font-mono font-semibold tabular-nums">
                    {{ polygonVerticesCount() }} vértices · ~{{ polygonAreaKm2() }} km²
                  </span>
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      (click)="openPolygonModal.emit()"
                      class="text-cyan-300 hover:underline font-semibold cursor-pointer"
                    >
                      Cambiar
                    </button>
                    <button
                      type="button"
                      (click)="clearPolygonRequested.emit()"
                      class="text-badge-low-text hover:underline font-semibold cursor-pointer"
                    >
                      Limpiar
                    </button>
                  </div>
                </div>
              } @else {
                <button
                  type="button"
                  (click)="openPolygonModal.emit()"
                  class="press-scale w-full py-1.5 px-3 rounded-lg bg-surface-elevated hover:bg-surface-hover text-cyan-300 border border-border-subtle text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <svg lucideLayers class="w-3.5 h-3.5"></svg>
                  <span>Elegir Corredor Táctico ({{ tacticalPolygonsCount() }}) o GeoJSON</span>
                </button>
              }
            }
          </div>

          <!-- PRIMARY SCAN CTA -->
          <button
            type="button"
            (click)="scanRequested.emit()"
            [disabled]="isScanning()"
            class="press-scale w-full py-2 px-4 rounded-lg font-bold text-xs tracking-wide uppercase flex items-center justify-center gap-2 cursor-pointer"
            [ngClass]="isScanning()
              ? 'bg-surface-elevated text-cyan-300 border border-cyan-500/40 cursor-not-allowed'
              : 'bg-cyan-600 hover:bg-cyan-500 text-white'"
          >
            @if (isScanning()) {
              <span class="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin shrink-0"></span>
              <span class="truncate">{{ streamState().stepMessage || 'Auditando zona en vivo...' }}</span>
            } @else {
              <svg lucideSparkles class="w-3.5 h-3.5"></svg>
              <span>{{ scanMode() === 'POLYGON' ? 'Escanear Polígono Táctico' : 'Escanear Negocios en Radar' }}</span>
            }
          </button>
        </div>
      }

      <!-- LIVE SSE STREAMING BAR (VISIBLE IN BOTH COLLAPSED & EXPANDED MODES WHEN ACTIVE) -->
      @if (streamState().isActive) {
        <div class="px-3.5 pb-2.5">
          <div class="p-2 rounded-lg bg-surface-elevated border border-cyan-500/30 text-[11px] space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-cyan-300 font-semibold truncate flex items-center gap-1.5">
                <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0"></span>
                <span class="truncate">{{ streamState().stepMessage }}</span>
              </span>
              @if (streamState().fromCache) {
                <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-badge-med-bg text-badge-med-text shrink-0">
                  Caché 7d
                </span>
              }
            </div>
            <div class="w-full bg-app h-1 rounded-full overflow-hidden">
              <div
                class="bg-cyan-400 h-full transition-transform duration-200 origin-left"
                [style.transform]="'scaleX(' + (streamState().progressPct / 100) + ')'"
              ></div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class GeoLocationComboboxComponent {
  readonly countries = input.required<CountryOption[]>();
  readonly countryCities = input.required<CityOption[]>();
  readonly selectedCountry = input.required<string>();
  readonly selectedState = input.required<string>();
  readonly selectedCity = input.required<string>();
  readonly activeCountryCode = input.required<string>();
  readonly totalPresetsCount = input.required<number>();
  readonly tacticalPolygonsCount = input.required<number>();
  readonly leadsCount = input.required<number>();

  readonly selectedSector = input.required<string>();
  readonly popularSectors = input.required<string[]>();
  readonly scanMode = input.required<'RADIUS' | 'POLYGON'>();
  readonly radiusKm = input.required<number>();
  readonly polygonVerticesCount = input.required<number>();
  readonly polygonAreaKm2 = input.required<number>();
  readonly isScanning = input.required<boolean>();
  readonly streamState = input.required<StreamProgressState>();
  readonly isCollapsed = input.required<boolean>();

  readonly countrySelected = output<string>();
  readonly cityOptionSelected = output<CityOption>();
  readonly sectorChange = output<string>();
  readonly scanModeChange = output<'RADIUS' | 'POLYGON'>();
  readonly radiusChange = output<number>();
  readonly openPolygonModal = output<void>();
  readonly clearPolygonRequested = output<void>();
  readonly scanRequested = output<void>();
  readonly toggleCollapse = output<void>();

  readonly searchQuery = signal<string>('');
  readonly isDropdownOpen = signal<boolean>(false);
  readonly activeIndex = signal<number>(0);

  readonly matchingCities = computed<CityOption[]>(() => {
    const q = this.searchQuery()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const all = this.countryCities();
    if (!q) {
      return [...all].sort((a, b) => Number(b.isTactical) - Number(a.isTactical));
    }
    return all
      .filter((item) => {
        const hay = `${item.name} ${item.state}`
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => Number(b.isTactical) - Number(a.isTactical));
  });

  readonly visibleDropdownCities = computed<CityOption[]>(() => {
    return this.matchingCities().slice(0, 40);
  });

  selectCountry(countryName: string): void {
    this.searchQuery.set('');
    this.activeIndex.set(0);
    this.countrySelected.emit(countryName);
  }

  openDropdown(): void {
    this.isDropdownOpen.set(true);
    this.activeIndex.set(0);
  }

  onSearchChange(val: string): void {
    this.searchQuery.set(val);
    this.isDropdownOpen.set(true);
    this.activeIndex.set(0);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.activeIndex.set(0);
  }

  pickCityOption(option: CityOption, event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
    }
    this.searchQuery.set('');
    this.isDropdownOpen.set(false);
    (document.activeElement as HTMLElement | null)?.blur();
    this.cityOptionSelected.emit(option);
  }

  onComboboxKeydown(event: KeyboardEvent): void {
    const options = this.visibleDropdownCities();
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopPropagation();
      this.isDropdownOpen.set(true);
      if (options.length > 0) {
        this.activeIndex.update((i) => (i + 1) % options.length);
      }
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopPropagation();
      this.isDropdownOpen.set(true);
      if (options.length > 0) {
        this.activeIndex.update((i) => (i - 1 + options.length) % options.length);
      }
    } else if (event.key === 'Enter') {
      if (this.isDropdownOpen() && options.length > 0) {
        event.preventDefault();
        event.stopPropagation();
        const chosen = options[this.activeIndex()] || options[0];
        this.pickCityOption(chosen);
      }
    } else if (event.key === 'Escape') {
      if (this.isDropdownOpen()) {
        event.preventDefault();
        event.stopPropagation();
        this.isDropdownOpen.set(false);
        (event.target as HTMLInputElement | null)?.blur();
      }
    }
  }
}
