import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAlertCircle,
  LucideBuilding2,
  LucideChevronDown,
  LucideClock,
  LucideFilter,
  LucideLayers,
  LucideMapPin,
  LucidePhone,
  LucideRefreshCw,
  LucideSmartphone,
  LucideStore,
  LucideX,
} from '@lucide/angular';
import * as LeafletESM from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

import {
  CompanyPainCategory,
  ContactChannel,
  ContactOutcome,
  GeoPresetDto,
  PhoneLineType,
  PitchToneKey,
  ProspectedBusiness,
  ProspectedBusinessPainItem,
  ProspectingService,
} from '../../core/services/prospecting.service';
import {
  CityOption,
  CountryOption,
  DockViewMode,
  TacticalPolygonOption,
  cleanPhoneDigits,
  formatPainTitle,
  formatPriceTier,
  getCooldownDaysLeft,
  getPainBadgeClass,
  getPainDotClass,
  getPinModifierClass,
  isChainLead,
  isLeadInCooldown,
  normalizeGeoText,
} from './components/geo-radar.models';
import { GeoLocationComboboxComponent } from './components/geo-location-combobox.component';
import { GeoLeadInspectorComponent } from './components/geo-lead-inspector.component';
import { GeoProspectsDockComponent } from './components/geo-prospects-dock.component';

type LeafletNamespace = typeof LeafletESM;
const L: LeafletNamespace =
  (globalThis as unknown as { L?: LeafletNamespace }).L ?? LeafletESM;

const INITIAL_BOOT_PRESET: GeoPresetDto = {
  id: 'boot-us-ca-san-francisco',
  slug: 'us-ca-san-francisco',
  countryCode: 'US',
  countryName: 'United States',
  flag: 'US',
  state: 'California',
  stateCode: 'CA',
  city: 'San Francisco',
  latitude: 37.77493,
  longitude: -122.41942,
  zoom: 13,
  isTactical: false,
};

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Component({
  selector: 'app-geo-radar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    GeoLocationComboboxComponent,
    GeoLeadInspectorComponent,
    GeoProspectsDockComponent,
    LucideBuilding2,
    LucideStore,
    LucideSmartphone,
    LucidePhone,
    LucideClock,
    LucideFilter,
    LucideChevronDown,
    LucideLayers,
    LucideRefreshCw,
    LucideMapPin,
    LucideAlertCircle,
    LucideX,
  ],
  host: {
    class: 'w-full h-full flex flex-1 overflow-hidden'
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full w-full overflow-hidden bg-app text-content-primary">
      <!-- =====================================================================
           COLUMN 1 (LEFT): COLLAPSIBLE ZONE COMBOBOX + FILTERS + HIGH-DENSITY CARDS
           ===================================================================== -->
      <aside class="w-[396px] border-r border-border-subtle bg-surface flex flex-col z-20 shrink-0">
        <app-geo-location-combobox
          [countries]="countries()"
          [countryCities]="countryCities()"
          [selectedCountry]="selectedCountry()"
          [selectedState]="selectedState()"
          [selectedCity]="selectedCity()"
          [activeCountryCode]="activeCountryCode()"
          [totalPresetsCount]="totalPresetsCount()"
          [tacticalPolygonsCount]="tacticalPolygons().length"
          [leadsCount]="prospecting.leads().length"
          [selectedSector]="selectedSector()"
          [popularSectors]="popularSectors"
          [scanMode]="scanMode()"
          [radiusKm]="radiusKm()"
          [polygonVerticesCount]="customPolygon()?.length || 0"
          [polygonAreaKm2]="polygonAreaKm2()"
          [isScanning]="prospecting.isScanning()"
          [streamState]="prospecting.streamState()"
          [isCollapsed]="isZoneCollapsed()"
          (countrySelected)="onCountrySelected($event)"
          (cityOptionSelected)="onCityOptionSelected($event)"
          (sectorChange)="selectedSector.set($event)"
          (scanModeChange)="setScanMode($event)"
          (radiusChange)="onRadiusChange($event)"
          (openPolygonModal)="isPolygonModalOpen.set(true)"
          (clearPolygonRequested)="clearPolygon()"
          (scanRequested)="triggerScan()"
          (toggleCollapse)="toggleZoneCollapse()"
        />

        <!-- ENTERPRISE QUALIFICATION FILTERS (PURE VECTOR, ZERO NATIVE OS SELECTS) -->
        <div class="px-3 py-2 border-b border-border-subtle bg-surface-elevated/40 space-y-1.5">
          <div class="flex flex-wrap items-center gap-1">
            <button
              type="button"
              data-testid="filter-exclude-chains"
              (click)="toggleExcludeChains()"
              class="press-scale inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border cursor-pointer"
              [ngClass]="excludeChains()
                ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                : 'bg-app text-content-secondary border-border-subtle hover:text-content-primary'"
              title="Excluir franquicias corporativas y cadenas multi-sede"
            >
              <svg lucideBuilding2 class="w-3 h-3"></svg>
              <span>{{ excludeChains() ? 'Solo Independientes' : 'Ocultar Franquicias' }}</span>
            </button>

            <button
              type="button"
              data-testid="filter-exclude-cooldown"
              (click)="toggleExcludeCooldown()"
              class="press-scale inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border cursor-pointer"
              [ngClass]="excludeCooldown()
                ? 'bg-amber-500/15 text-badge-med-text border-amber-500/40'
                : 'bg-app text-content-secondary border-border-subtle hover:text-content-primary'"
              title="Ocultar prospectos contactados recientemente en enfriamiento"
            >
              <svg lucideClock class="w-3 h-3"></svg>
              <span>Sin Cooldown (30d)</span>
            </button>

            <button
              type="button"
              data-testid="filter-only-mobile"
              (click)="toggleOnlyMobile()"
              class="press-scale inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-semibold border cursor-pointer"
              [ngClass]="onlyMobileWhatsapp()
                ? 'bg-badge-high-bg text-badge-high-text border-emerald-500/40'
                : 'bg-app text-content-secondary border-border-subtle hover:text-content-primary'"
              title="Mostrar únicamente prospectos con línea móvil para WhatsApp directo"
            >
              <svg lucideSmartphone class="w-3 h-3"></svg>
              <span>Solo Móvil WA</span>
            </button>
          </div>

          <!-- CUSTOM PAIN FILTER POPOVER + RESET -->
          <div class="flex items-center gap-1.5 relative">
            <button
              type="button"
              (click)="togglePainDropdown()"
              class="flex-1 px-2.5 py-1 rounded-md bg-app hover:bg-surface-hover border border-border-subtle text-[10px] text-content-secondary flex items-center justify-between gap-1.5 cursor-pointer"
            >
              <span class="inline-flex items-center gap-1.5 truncate">
                <svg lucideFilter class="w-3 h-3 text-cyan-400 shrink-0"></svg>
                <span class="truncate">{{ activePainFilterLabel() }}</span>
              </span>
              <svg lucideChevronDown class="w-3 h-3 text-content-muted shrink-0"></svg>
            </button>

            @if (hasActiveFilters()) {
              <button
                type="button"
                (click)="resetFilters()"
                class="press-scale px-2 py-1 rounded-md bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-[10px] font-semibold text-cyan-300 shrink-0 cursor-pointer"
              >
                Limpiar
              </button>
            }

            @if (isPainDropdownOpen()) {
              <div class="absolute left-0 right-0 top-full mt-1 z-40 rounded-xl bg-surface-elevated border border-border-subtle shadow-2xl p-1 max-h-48 overflow-y-auto space-y-0.5">
                <button
                  type="button"
                  (click)="selectPainFilter('')"
                  class="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between cursor-pointer"
                  [ngClass]="!selectedPainFilter()
                    ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                    : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'"
                >
                  <span>Todas las dolencias B2B</span>
                </button>
                @for (pain of prospecting.painCatalog(); track pain.code) {
                  <button
                    type="button"
                    (click)="selectPainFilter(pain.code)"
                    class="w-full px-2.5 py-1.5 rounded-lg text-left text-[11px] flex items-center justify-between cursor-pointer"
                    [ngClass]="selectedPainFilter() === pain.code
                      ? 'bg-cyan-500/15 text-cyan-300 font-semibold'
                      : 'text-content-secondary hover:bg-surface-hover hover:text-content-primary'"
                  >
                    <span class="truncate">{{ pain.name }}</span>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        <!-- CONTEXTUAL GEOGRAPHIC MISMATCH BANNER (SAVED LEADS IN ANOTHER CITY) -->
        @if (mismatchLeadsCity(); as savedCity) {
          <div class="px-3 py-1.5 border-b border-border-subtle bg-cyan-500/[0.06] flex items-center justify-between gap-2 text-[10px]">
            <span class="inline-flex items-center gap-1.5 text-content-secondary truncate">
              <svg lucideMapPin class="w-3 h-3 text-cyan-400 shrink-0"></svg>
              <span class="truncate">
                Mostrando <strong class="text-content-primary font-semibold">{{ prospecting.leads().length }}</strong> guardados en <strong class="text-cyan-300 font-semibold">{{ savedCity }}</strong>
              </span>
            </span>
            <button
              type="button"
              (click)="focusMapOnSavedLeads()"
              class="text-cyan-300 hover:underline font-semibold shrink-0 cursor-pointer"
            >
              Enfocar pines
            </button>
          </div>
        }

        <!-- HIGH-DENSITY SCANNABLE LEAD CARDS (>= 4 FULL CARDS ABOVE THE FOLD AT 1440x900) -->
        <div
          #leadListContainer
          class="flex-1 overflow-y-auto p-2.5 space-y-2"
        >
          @if (prospecting.leads().length === 0 && !prospecting.isScanning()) {
            <div class="h-full flex flex-col items-center justify-center text-center px-5 py-8 space-y-2.5">
              <div class="w-10 h-10 rounded-xl bg-surface-elevated border border-border-subtle flex items-center justify-center text-content-muted">
                <svg lucideMapPin class="w-5 h-5"></svg>
              </div>
              <div class="space-y-1">
                <p class="text-xs font-semibold text-content-primary">Sin prospectos en esta vista</p>
                <p class="text-[11px] text-content-muted leading-relaxed">
                  Selecciona un municipio o corredor táctico y ejecuta el barrido para detectar oportunidades comerciales verificadas.
                </p>
              </div>
            </div>
          }

          @for (lead of prospecting.leads(); track lead.id) {
            <article
              data-testid="geo-lead-card"
              [attr.data-lead-id]="lead.id"
              (click)="selectLead(lead)"
              (mouseenter)="highlightMapMarker(lead)"
              (mouseleave)="resetMapMarkerHighlight()"
              class="p-2.5 rounded-xl border transition-colors cursor-pointer space-y-1.5 select-none"
              [ngClass]="prospecting.selectedLead()?.id === lead.id
                ? 'bg-surface-elevated border-cyan-400/70 shadow-sm'
                : 'bg-app/70 border-border-subtle hover:bg-surface-elevated/70 hover:border-border-focus'"
            >
              <!-- ROW 1: BUSINESS NAME + RATING + ESTIMATED TICKET -->
              <div class="flex items-center justify-between gap-2">
                <h3 class="font-bold text-xs text-content-primary truncate">
                  {{ lead.name }}
                </h3>
                <div class="flex items-center gap-1.5 shrink-0 font-mono text-[11px] tabular-nums">
                  <span class="text-amber-400 font-semibold">{{ lead.rating || '—' }} ★</span>
                  @if (lead.estimatedTicketUsd) {
                    <span class="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold text-[10px]">
                      ~&#36;{{ lead.estimatedTicketUsd }}
                    </span>
                  }
                </div>
              </div>

              <!-- ROW 2: OWNERSHIP + DIRECT CHANNEL + COOLDOWN + CITY -->
              <div class="flex items-center justify-between gap-1.5 text-[10px]">
                <div class="flex items-center gap-1 min-w-0">
                  @if (checkChain(lead)) {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-semibold shrink-0">
                      <svg lucideBuilding2 class="w-2.5 h-2.5"></svg>
                      <span class="truncate max-w-[105px]">{{ lead.corporateBrand?.name || 'Franquicia' }}</span>
                    </span>
                  } @else {
                    <span class="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-badge-high-bg text-badge-high-text border border-emerald-500/30 font-semibold shrink-0">
                      <svg lucideStore class="w-2.5 h-2.5"></svg>
                      <span>Independiente</span>
                    </span>
                  }

                  @if (lead.phoneType === 'MOBILE') {
                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-surface-elevated text-badge-high-text border border-border-subtle font-medium shrink-0">
                      <svg lucideSmartphone class="w-2.5 h-2.5"></svg>
                      <span>WA</span>
                    </span>
                  } @else if (lead.phone) {
                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-surface-elevated text-content-secondary border border-border-subtle font-medium shrink-0">
                      <svg lucidePhone class="w-2.5 h-2.5"></svg>
                      <span>Fijo</span>
                    </span>
                  }

                  @if (checkCooldown(lead)) {
                    <span class="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-badge-med-bg text-badge-med-text border border-amber-500/30 font-mono tabular-nums shrink-0">
                      <svg lucideClock class="w-2.5 h-2.5"></svg>
                      <span>{{ cooldownDays(lead) }}d</span>
                    </span>
                  }
                </div>

                <span class="text-content-muted truncate max-w-[95px]">
                  {{ lead.city }}
                </span>
              </div>

              <!-- ROW 3: PRIMARY PAIN BADGE + SUGGESTED COMMERCIAL OFFER -->
              <div class="flex items-center justify-between gap-2">
                <span
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold shrink-0"
                  [ngClass]="painBadge(lead.primaryPain)"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="painDot(lead.primaryPain)"></span>
                  <span>{{ painTitle(lead.primaryPain) }}</span>
                </span>

                <span class="text-[10px] text-content-muted truncate">
                  {{ lead.suggestedOffer || 'Consultoría Digital B2B' }} {{ priceTier(lead.priceLevel) }}
                </span>
              </div>
            </article>
          }
        </div>
      </aside>

      <!-- =====================================================================
           COLUMN 2 (CENTER): INTERACTIVE DARK MAP + FLOATING BAR + GPU DOCK
           ===================================================================== -->
      <main class="flex-1 relative flex flex-col min-w-0 overflow-hidden bg-app">
        <div #mapContainer class="w-full h-full z-0"></div>

        <!-- TOP-RIGHT FLOATING TACTICAL BAR (ZERO COLLISION WITH TOP-LEFT ZOOM/GEOMAN) -->
        <div class="absolute top-3.5 right-3.5 z-10 flex items-center gap-1.5">
          <button
            type="button"
            (click)="recenterRadar()"
            title="Centrar mapa en zona activa"
            class="press-scale px-2.5 py-1.5 rounded-xl bg-surface/90 hover:bg-surface-elevated border border-border-subtle text-content-secondary hover:text-content-primary text-xs font-medium backdrop-blur-md shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <svg lucideRefreshCw class="w-3.5 h-3.5 text-cyan-400"></svg>
            <span>Centrar</span>
          </button>

          <button
            type="button"
            data-testid="btn-corredores-tacticos"
            (click)="isPolygonModalOpen.set(true)"
            class="press-scale px-3 py-1.5 rounded-xl bg-surface/90 hover:bg-surface-elevated border border-border-subtle text-cyan-300 text-xs font-semibold backdrop-blur-md shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <svg lucideLayers class="w-3.5 h-3.5"></svg>
            <span>Corredores Tácticos ({{ tacticalPolygons().length }})</span>
          </button>

          <div class="hidden xl:flex px-3 py-1.5 rounded-xl bg-surface/90 border border-border-subtle text-xs text-content-secondary backdrop-blur-md shadow-lg items-center gap-2">
            <span class="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[10px] font-bold">
              {{ activeCountryCode() }}
            </span>
            <span class="font-medium text-content-primary truncate max-w-[200px]">
              {{ selectedCity() }}, {{ selectedState() }}
            </span>
          </div>
        </div>

        <!-- GPU-COMPOSITED TELESCOPIC DOCK SHEET -->
        <app-geo-prospects-dock
          [leads]="sortedTableLeads()"
          [selectedLeadId]="prospecting.selectedLead()?.id || null"
          [totalPipelineUsd]="totalPipelineUsd()"
          [mode]="dockMode()"
          [sortOrder]="sortOrder()"
          [currentPage]="currentPage()"
          [pageSize]="pageSize()"
          (modeChanged)="setDockMode($event)"
          (sortToggled)="toggleSortDirection()"
          (pageChanged)="onPageChanged($event)"
          (leadSelected)="selectLead($event)"
          (rowHovered)="highlightMapMarker($event)"
          (rowHoverLeft)="resetMapMarkerHighlight()"
        />
      </main>

      <!-- =====================================================================
           COLUMN 3 (RIGHT): MASTER-DETAIL FULL-HEIGHT CRM INSPECTOR (ZERO OVERLAP)
           ===================================================================== -->
      @if (prospecting.selectedLead(); as activeLead) {
        <app-geo-lead-inspector
          [lead]="activeLead"
          [activePains]="activeBusinessPains()"
          [currentPain]="currentActivePain()"
          [selectedTone]="selectedPitchTone()"
          [suggestedOfferText]="currentSuggestedOffer(activeLead)"
          [pitchText]="currentPitchText(activeLead)"
          [whatsappUrl]="buildWhatsappUrl(activeLead)"
          [copiedPitch]="copiedPitch()"
          [contacts]="prospecting.selectedLeadContacts()"
          [contactChannel]="contactChannelInput()"
          [contactOutcome]="contactOutcomeInput()"
          [contactNotes]="contactNotesInput()"
          [isSavingContact]="isSavingContact()"
          [isEnrichingDeep]="isEnrichingDeep()"
          [isGeneratingDemo]="isGeneratingDemo()"
          [feedbackMessage]="crmFeedbackMessage()"
          [contactError]="contactErrorMessage()"
          [isConfirmingBlacklist]="isConfirmingBlacklist()"
          (painSelected)="selectedPainId.set($event)"
          (painDismissed)="dismissPainAsFalsePositive(activeLead, $event.pain, $event.event)"
          (pitchToneChanged)="selectedPitchTone.set($event)"
          (copyRequested)="copyPitch(currentPitchText(activeLead))"
          (enrichRequested)="triggerDeepEnrichment(activeLead, true)"
          (generateDemoRequested)="triggerDemoGeneration(activeLead)"
          (channelChanged)="contactChannelInput.set($event)"
          (outcomeChanged)="contactOutcomeInput.set($event)"
          (notesChanged)="contactNotesInput.set($event)"
          (submitContactRequested)="submitContactLog(activeLead)"
          (requestBlacklistConfirmation)="isConfirmingBlacklist.set(true)"
          (confirmBlacklistRequested)="blacklistCurrentLead(activeLead)"
          (cancelBlacklistRequested)="isConfirmingBlacklist.set(false)"
          (closeRequested)="closeInspector()"
        />
      }

      <!-- =====================================================================
           DYNAMIC TACTICAL POLYGONS & GEOJSON MODAL (THEME-TOKEN ALIGNED)
           ===================================================================== -->
      @if (isPolygonModalOpen()) {
        <div
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          (click)="isPolygonModalOpen.set(false)"
        >
          <div
            class="bg-surface border border-border-subtle rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4"
            (click)="$event.stopPropagation()"
          >
            <div class="flex items-center justify-between border-b border-border-subtle pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <svg lucideLayers class="w-4 h-4"></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-content-primary tracking-wide">
                    Corredores & Polígonos Tácticos B2B
                  </h3>
                  <p class="text-[11px] text-content-secondary">
                    {{ tacticalPolygons().length }} distritos industriales, financieros y comerciales listos para auditar
                  </p>
                </div>
              </div>
              <button
                type="button"
                (click)="isPolygonModalOpen.set(false)"
                class="press-scale w-7 h-7 rounded-lg bg-surface-elevated hover:bg-surface-hover text-content-secondary hover:text-content-primary flex items-center justify-center cursor-pointer"
                title="Cerrar (Esc)"
              >
                <svg lucideX class="w-4 h-4"></svg>
              </button>
            </div>

            <div class="space-y-1.5">
              <div class="text-[10px] font-semibold text-content-secondary uppercase tracking-wider flex justify-between">
                <span>Corredores Estratégicos</span>
                <span class="text-cyan-400 font-mono">1-Clic para delimitar</span>
              </div>
              <div class="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                @for (preset of tacticalPolygons(); track preset.slug) {
                  <button
                    type="button"
                    (click)="applyPresetPolygon(preset)"
                    class="press-scale p-2.5 rounded-xl bg-app hover:bg-surface-elevated border border-border-subtle hover:border-cyan-500/50 text-left group cursor-pointer"
                  >
                    <div class="flex items-center gap-1.5">
                      <span class="px-1.5 py-0.2 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-mono text-[9px] font-bold shrink-0">
                        {{ preset.countryCode }}
                      </span>
                      <span class="text-[11px] font-bold text-content-primary group-hover:text-cyan-300 truncate">
                        {{ preset.name }}
                      </span>
                    </div>
                    <div class="text-[10px] text-content-muted font-mono mt-1 truncate">
                      {{ preset.state }} · {{ preset.category }}
                    </div>
                  </button>
                }
              </div>
            </div>

            <div class="space-y-1.5">
              <label class="text-[10px] font-semibold text-content-secondary uppercase tracking-wider flex justify-between">
                <span>Pegar Coordenadas o GeoJSON</span>
                <span class="text-content-muted font-mono">[[lat, lng], ...] o Feature</span>
              </label>
              <textarea
                [(ngModel)]="rawPolygonInput"
                placeholder="Pega coordenadas [[lat, lng], ...] o un Feature GeoJSON..."
                rows="3"
                class="w-full bg-app border border-border-subtle rounded-xl p-2.5 text-xs font-mono text-cyan-300 placeholder-content-muted focus:outline-none focus:border-cyan-500"
              ></textarea>
              @if (polygonParseError()) {
                <p class="inline-flex items-center gap-1 text-[11px] text-badge-low-text font-mono">
                  <svg lucideAlertCircle class="w-3.5 h-3.5 shrink-0"></svg>
                  <span>{{ polygonParseError() }}</span>
                </p>
              }
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-border-subtle">
              <button
                type="button"
                (click)="loadSamplePolygonToTextarea()"
                class="text-[11px] text-cyan-400 hover:underline cursor-pointer"
              >
                Insertar plantilla de coordenadas
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="isPolygonModalOpen.set(false)"
                  class="press-scale px-3.5 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-hover text-xs font-semibold text-content-secondary hover:text-content-primary cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="applyPastedPolygon()"
                  class="press-scale px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer"
                >
                  Aplicar al Mapa
                </button>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class GeoRadarComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly prospecting = inject(ProspectingService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');
  private readonly leadListContainer = viewChild<ElementRef<HTMLDivElement>>('leadListContainer');

  // Route Path & Query Inputs (via withComponentInputBinding)
  readonly countryCode = input<string>();
  readonly stateSlug = input<string>();
  readonly citySlug = input<string>();
  readonly leadId = input<string>();
  readonly sector = input<string>();
  readonly tone = input<string>();
  readonly dock = input<string>();
  readonly excludeChainsParam = input<string>();
  readonly onlyMobileParam = input<string>();
  readonly painParam = input<string>();
  readonly pageParam = input<string>();
  readonly pageSizeParam = input<string>();

  // Leaflet layers
  private map?: LeafletESM.Map;
  private circleLayer?: LeafletESM.Circle;
  private centerMarker?: LeafletESM.Marker;
  private cityPolygonLayer?: LeafletESM.GeoJSON;
  private customPolygonLayer?: LeafletESM.Polygon;
  private leadMarkersLayer = L.layerGroup();

  // Dynamic Geo-Presets State
  readonly selectedCountry = signal<string>('United States');
  readonly selectedState = signal<string>('California');
  readonly selectedCity = signal<string>('San Francisco');
  readonly isZoneCollapsed = signal<boolean>(true);
  currentCenter = { lat: INITIAL_BOOT_PRESET.latitude, lng: INITIAL_BOOT_PRESET.longitude };

  // Scan parameters
  readonly selectedSector = signal<string>('Dentistas');
  readonly popularSectors = [
    'Dentistas',
    'Clínicas',
    'Talleres Mecánicos',
    'Restaurantes',
    'Notarías',
    'Logística',
  ];
  readonly radiusKm = signal<number>(5);

  readonly scanMode = signal<'RADIUS' | 'POLYGON'>('RADIUS');
  readonly customPolygon = signal<[number, number][] | null>(null);
  readonly isPolygonModalOpen = signal<boolean>(false);
  readonly polygonParseError = signal<string | null>(null);
  rawPolygonInput = '';

  // Enterprise Filters
  readonly excludeChains = signal<boolean>(false);
  readonly excludeCooldown = signal<boolean>(false);
  readonly onlyMobileWhatsapp = signal<boolean>(false);
  readonly selectedPainFilter = signal<string>('');
  readonly isPainDropdownOpen = signal<boolean>(false);

  // GPU Telescopic Dock & Datagrid State
  readonly dockMode = signal<DockViewMode>('PEEK');
  readonly sortOrder = signal<'ASC' | 'DESC'>('DESC');
  readonly highlightedLeadId = signal<string | null>(null);
  readonly currentPage = signal<number>(1);
  readonly pageSize = signal<number>(25);

  // Right Master-Detail CRM Inspector State
  readonly selectedPainId = signal<string | null>(null);
  readonly selectedPitchTone = signal<PitchToneKey>('OWNER');
  readonly copiedPitch = signal<boolean>(false);
  readonly isSavingContact = signal<boolean>(false);
  readonly isEnrichingDeep = signal<boolean>(false);
  readonly isGeneratingDemo = signal<boolean>(false);
  readonly crmFeedbackMessage = signal<string | null>(null);
  readonly contactErrorMessage = signal<string | null>(null);
  readonly isConfirmingBlacklist = signal<boolean>(false);
  readonly contactChannelInput = signal<ContactChannel>('WHATSAPP');
  readonly contactOutcomeInput = signal<ContactOutcome>('CONNECTED_PITCHED');
  readonly contactNotesInput = signal<string>('');

  // Computed Geo Catalogs from DB
  private readonly effectiveGeoPresets = computed<GeoPresetDto[]>(() => {
    const loaded = this.prospecting.geoPresets();
    return loaded.length > 0 ? loaded : [INITIAL_BOOT_PRESET];
  });

  readonly totalPresetsCount = computed(() => this.prospecting.geoPresets().length);

  readonly countries = computed<CountryOption[]>(() => {
    const map = new Map<string, CountryOption>();
    for (const row of this.effectiveGeoPresets()) {
      if (!map.has(row.countryName)) {
        const label =
          row.countryCode === 'MX'
            ? 'México'
            : row.countryCode === 'CO'
              ? 'Colombia'
              : row.countryCode === 'US'
                ? 'EE. UU.'
                : row.countryName;
        map.set(row.countryName, {
          countryCode: row.countryCode,
          countryName: row.countryName,
          label,
        });
      }
    }
    return Array.from(map.values());
  });

  readonly activeCountryCode = computed<string>(() => {
    return (
      this.countries().find((c) => c.countryName === this.selectedCountry())?.countryCode || 'US'
    );
  });

  readonly countryCities = computed<CityOption[]>(() => {
    const country = this.selectedCountry();
    return this.effectiveGeoPresets()
      .filter((row) => row.countryName === country)
      .map((row) => ({
        id: row.id || row.slug,
        name: row.city,
        state: row.state,
        countryName: row.countryName,
        countryCode: row.countryCode,
        lat: row.latitude,
        lng: row.longitude,
        zoom: row.zoom || 13,
        isTactical: row.isTactical,
        category: row.category,
        polygonCoordinates: Array.isArray(row.polygonCoordinates)
          ? (row.polygonCoordinates as [number, number][])
          : undefined,
      }));
  });

  readonly tacticalPolygons = computed<TacticalPolygonOption[]>(() => {
    const currentCountry = this.selectedCountry();
    return this.effectiveGeoPresets()
      .filter(
        (r) => r.isTactical && Array.isArray(r.polygonCoordinates) && r.polygonCoordinates.length >= 3,
      )
      .sort((a, b) => Number(b.countryName === currentCountry) - Number(a.countryName === currentCountry))
      .map((r) => ({
        slug: r.slug,
        name: r.city,
        state: r.state,
        countryName: r.countryName,
        countryCode: r.countryCode,
        category: r.category || 'Comercial',
        polygon: r.polygonCoordinates as [number, number][],
      }));
  });

  readonly polygonAreaKm2 = computed(() => {
    const poly = this.customPolygon();
    if (!poly || poly.length < 3) return 0;
    return this.calculateAreaKm2(poly);
  });

  readonly hasActiveFilters = computed(
    () =>
      this.excludeChains() ||
      this.excludeCooldown() ||
      this.onlyMobileWhatsapp() ||
      Boolean(this.selectedPainFilter()),
  );

  readonly activePainFilterLabel = computed(() => {
    const code = this.selectedPainFilter();
    if (!code) return 'Dolencia: Todas las categorías';
    const match = this.prospecting.painCatalog().find((p) => p.code === code);
    return match ? `Dolencia: ${match.name}` : `Dolencia: ${code}`;
  });

  readonly mismatchLeadsCity = computed<string | null>(() => {
    const leads = this.prospecting.leads();
    if (leads.length === 0) return null;
    const targetCity = normalizeGeoText(this.selectedCity());
    const targetState = normalizeGeoText(this.selectedState());
    const anyMatchesViewport = leads.some(
      (l) =>
        normalizeGeoText(l.city) === targetCity ||
        (this.scanMode() === 'POLYGON' && normalizeGeoText(l.state) === targetState),
    );
    if (anyMatchesViewport) return null;

    const counts = new Map<string, number>();
    for (const lead of leads) {
      if (lead.city) {
        counts.set(lead.city, (counts.get(lead.city) || 0) + 1);
      }
    }
    let dominant: string | null = null;
    let best = 0;
    for (const [city, count] of counts.entries()) {
      if (count > best) {
        best = count;
        dominant = city;
      }
    }
    return dominant;
  });

  readonly activeBusinessPains = computed<ProspectedBusinessPainItem[]>(() => {
    const detailed = this.prospecting.selectedLeadPains();
    const activeStatuses = new Set(['DETECTED', 'VERIFIED', 'PITCHED']);
    if (detailed.length > 0) {
      return detailed.filter((p) => activeStatuses.has(p.status));
    }
    const lead = this.prospecting.selectedLead();
    return (lead?.detectedPains || []).filter((p) => activeStatuses.has(p.status));
  });

  readonly currentActivePain = computed<ProspectedBusinessPainItem | null>(() => {
    const list = this.activeBusinessPains();
    if (list.length === 0) return null;
    const explicitId = this.selectedPainId();
    if (explicitId) {
      const found = list.find((p) => p.id === explicitId);
      if (found) return found;
    }
    return list.find((p) => p.isPrimary) || list[0];
  });

  readonly sortedTableLeads = computed(() => {
    const list = [...this.prospecting.leads()];
    const order = this.sortOrder();
    return list.sort((a, b) => {
      const ticketA = Number(a.estimatedTicketUsd) || 0;
      const ticketB = Number(b.estimatedTicketUsd) || 0;
      return order === 'DESC' ? ticketB - ticketA : ticketA - ticketB;
    });
  });

  readonly totalPipelineUsd = computed(() => {
    return this.prospecting
      .leads()
      .reduce((sum, l) => sum + (Number(l.estimatedTicketUsd) || 450), 0);
  });

  ngOnInit(): void {
    this.hydrateFromRouteParams();

    this.prospecting
      .getGeoPresets()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rows) => {
          if (rows.length > 0) {
            this.ensureValidSelectionAfterPresetsLoad();
          }
        },
      });
    this.prospecting
      .getPainCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.prospecting
      .getFunnelAnalytics()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.refreshLeadsFromBackend();
  }

  private hydrateFromRouteParams(): void {
    if (this.sector()) {
      this.selectedSector.set(this.sector()!);
    }
    if (this.tone()) {
      const t = this.tone()!.toUpperCase() as PitchToneKey;
      if (t === 'OWNER' || t === 'GATEKEEPER' || t === 'ENTERPRISE') {
        this.selectedPitchTone.set(t);
      }
    }
    if (this.dock()) {
      const d = this.dock()!.toUpperCase() as DockViewMode;
      if (d === 'PEEK' || d === 'SPLIT' || d === 'MAXIMIZED') {
        this.dockMode.set(d);
      }
    }
    if (this.excludeChainsParam() === 'true') {
      this.excludeChains.set(true);
    }
    if (this.onlyMobileParam() === 'true') {
      this.onlyMobileWhatsapp.set(true);
    }
    if (this.painParam()) {
      this.selectedPainFilter.set(this.painParam()!);
    }
    if (this.pageParam()) {
      const parsedPage = parseInt(this.pageParam()!, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        this.currentPage.set(parsedPage);
      }
    }
    if (this.pageSizeParam()) {
      const parsedSize = parseInt(this.pageSizeParam()!, 10);
      if (!isNaN(parsedSize) && parsedSize > 0) {
        this.pageSize.set(parsedSize);
      }
    }
  }

  private syncUrlState(replaceUrl: boolean = true): void {
    const country = this.selectedCountry();
    const countryMatch = this.countries().find((c) => c.countryName === country);
    const countryCode = (countryMatch?.countryCode || this.activeCountryCode() || 'us').toLowerCase();
    const stateSlug = this.selectedState().toLowerCase().replace(/\s+/g, '-');
    const citySlug = this.selectedCity().toLowerCase().replace(/\s+/g, '-');

    const lead = this.prospecting.selectedLead();
    const queryParams: Record<string, string | null> = {
      leadId: lead ? lead.id : null,
      sector: this.selectedSector() !== 'Dentistas' ? this.selectedSector() : null,
      tone: this.selectedPitchTone() !== 'OWNER' ? this.selectedPitchTone() : null,
      dock: this.dockMode() !== 'PEEK' ? this.dockMode() : null,
      excludeChains: this.excludeChains() ? 'true' : null,
      onlyMobile: this.onlyMobileWhatsapp() ? 'true' : null,
      pain: this.selectedPainFilter() || null,
      page: this.currentPage() > 1 ? String(this.currentPage()) : null,
      pageSize: this.pageSize() !== 25 ? String(this.pageSize()) : null,
    };

    const targetUrl = ['/radar/geo', countryCode, stateSlug, citySlug];
    this.router.navigate(targetUrl, {
      queryParams,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  // ===========================================================================
  // ZERO-MOUSE SDR KEYBOARD ENGINE (J/K, 1/2/3, C, W, ESC PRIORITY STACK)
  // ===========================================================================
  @HostListener('document:keydown', ['$event'])
  handleGlobalKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.isPolygonModalOpen()) {
        event.preventDefault();
        this.isPolygonModalOpen.set(false);
        return;
      }
      if (this.isPainDropdownOpen()) {
        event.preventDefault();
        this.isPainDropdownOpen.set(false);
        return;
      }
      if (this.isConfirmingBlacklist()) {
        event.preventDefault();
        this.isConfirmingBlacklist.set(false);
        return;
      }
      if (this.prospecting.selectedLead()) {
        event.preventDefault();
        this.closeInspector();
        return;
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }

    const list = this.prospecting.leads();
    const activeLead = this.prospecting.selectedLead();

    if (event.key === 'j' || event.key === 'J' || event.key === 'ArrowDown') {
      if (list.length === 0) return;
      event.preventDefault();
      const currentIdx = activeLead ? list.findIndex((item) => item.id === activeLead.id) : -1;
      const nextIdx = currentIdx < 0 ? 0 : Math.min(list.length - 1, currentIdx + 1);
      const nextLead = list[nextIdx];
      this.selectLead(nextLead);
      this.scrollLeadCardIntoView(nextLead.id);
      return;
    }

    if (event.key === 'k' || event.key === 'K' || event.key === 'ArrowUp') {
      if (list.length === 0) return;
      event.preventDefault();
      const currentIdx = activeLead ? list.findIndex((item) => item.id === activeLead.id) : -1;
      const prevIdx = currentIdx <= 0 ? 0 : currentIdx - 1;
      const prevLead = list[prevIdx];
      this.selectLead(prevLead);
      this.scrollLeadCardIntoView(prevLead.id);
      return;
    }

    if (!activeLead) return;

    if (event.key === '1') {
      event.preventDefault();
      this.selectedPitchTone.set('OWNER');
    } else if (event.key === '2') {
      event.preventDefault();
      this.selectedPitchTone.set('GATEKEEPER');
    } else if (event.key === '3') {
      event.preventDefault();
      this.selectedPitchTone.set('ENTERPRISE');
    } else if (event.key === 'c' || event.key === 'C') {
      event.preventDefault();
      this.copyPitch(this.currentPitchText(activeLead));
    } else if (event.key === 'i' || event.key === 'I') {
      event.preventDefault();
      this.triggerDeepEnrichment(activeLead, true);
    } else if (event.key === 'w' || event.key === 'W') {
      if (activeLead.phoneType === 'MOBILE' && (activeLead.phoneE164 || activeLead.phone)) {
        event.preventDefault();
        window.open(this.buildWhatsappUrl(activeLead), '_blank', 'noopener,noreferrer');
      }
    }
  }

  private scrollLeadCardIntoView(leadId: string): void {
    requestAnimationFrame(() => {
      const container = this.leadListContainer()?.nativeElement;
      if (!container) return;
      const card = container.querySelector<HTMLElement>(`[data-lead-id="${leadId}"]`);
      card?.scrollIntoView({ block: 'nearest' });
    });
  }

  private scheduleMapResize(): void {
    requestAnimationFrame(() => {
      setTimeout(() => {
        this.map?.invalidateSize({ pan: false });
      }, 40);
    });
  }

  toggleZoneCollapse(): void {
    this.isZoneCollapsed.update((v) => !v);
  }

  private ensureValidSelectionAfterPresetsLoad(): void {
    // If route path params were provided, check for city match first
    const pathCitySlug = this.citySlug();
    const pathStateSlug = this.stateSlug();
    const pathCountryCode = this.countryCode();

    if (pathCitySlug) {
      const match = this.effectiveGeoPresets().find((p) => {
        const cSlug = p.city.toLowerCase().replace(/\s+/g, '-');
        const sSlug = p.state.toLowerCase().replace(/\s+/g, '-');
        const code = p.countryCode.toLowerCase();
        return (
          cSlug === pathCitySlug.toLowerCase() &&
          (!pathStateSlug || sSlug === pathStateSlug.toLowerCase()) &&
          (!pathCountryCode || code === pathCountryCode.toLowerCase())
        );
      });

      if (match) {
        this.selectedCountry.set(match.countryName);
        this.selectedState.set(match.state);
        this.selectedCity.set(match.city);
        this.currentCenter = { lat: match.latitude, lng: match.longitude };
        return;
      }
    }

    const cities = this.countryCities();
    if (cities.length > 0 && !cities.some((c) => c.name === this.selectedCity())) {
      const preferred = cities.find((c) => !c.isTactical) || cities[0];
      this.selectedState.set(preferred.state);
      this.selectedCity.set(preferred.name);
      this.currentCenter = { lat: preferred.lat, lng: preferred.lng };
    }
  }

  onCountrySelected(countryName: string): void {
    this.selectedCountry.set(countryName);
    const cities = this.countryCities();
    const preferred = cities.find((c) => !c.isTactical) || cities[0];
    if (preferred) {
      this.selectedCountry.set(preferred.countryName);
      this.selectedState.set(preferred.state);
      this.selectedCity.set(preferred.name);
      this.currentCenter = { lat: preferred.lat, lng: preferred.lng };

      if (preferred.isTactical && preferred.polygonCoordinates && preferred.polygonCoordinates.length >= 3) {
        this.setPolygonOnMap(preferred.polygonCoordinates);
      } else {
        if (this.scanMode() === 'POLYGON') {
          this.clearPolygon();
        }
        this.fetchCityBoundary(preferred.name, preferred.state, preferred.countryName);
        this.updateMapPosition(preferred.zoom || 13);
      }
      // Keep panel expanded if user was already interacting with it
      // this.syncUrlState(true);
    }
  }

  onCityOptionSelected(cityObj: CityOption): void {
    this.selectedCountry.set(cityObj.countryName);
    this.selectedState.set(cityObj.state);
    this.selectedCity.set(cityObj.name);
    this.currentCenter = { lat: cityObj.lat, lng: cityObj.lng };

    if (cityObj.isTactical && cityObj.polygonCoordinates && cityObj.polygonCoordinates.length >= 3) {
      this.setPolygonOnMap(cityObj.polygonCoordinates);
    } else {
      if (this.scanMode() === 'POLYGON') {
        this.clearPolygon();
      }
      this.fetchCityBoundary(cityObj.name, cityObj.state, cityObj.countryName);
      this.updateMapPosition(cityObj.zoom || 13);
    }

    this.syncUrlState(false);
  }

  onRadiusChange(newRadius: number): void {
    this.radiusKm.set(Number(newRadius) || 5);
    this.updateRadarCircle();
  }

  toggleExcludeChains(): void {
    this.excludeChains.update((v) => !v);
    this.syncUrlState(true);
    this.refreshLeadsFromBackend();
  }

  toggleExcludeCooldown(): void {
    this.excludeCooldown.update((v) => !v);
    this.syncUrlState(true);
    this.refreshLeadsFromBackend();
  }

  toggleOnlyMobile(): void {
    this.onlyMobileWhatsapp.update((v) => !v);
    this.syncUrlState(true);
    this.refreshLeadsFromBackend();
  }

  togglePainDropdown(): void {
    this.isPainDropdownOpen.update((v) => !v);
  }

  selectPainFilter(painCode: string): void {
    this.selectedPainFilter.set(painCode);
    this.isPainDropdownOpen.set(false);
    this.syncUrlState(true);
    this.refreshLeadsFromBackend();
  }

  resetFilters(): void {
    this.excludeChains.set(false);
    this.excludeCooldown.set(false);
    this.onlyMobileWhatsapp.set(false);
    this.selectedPainFilter.set('');
    this.isPainDropdownOpen.set(false);
    this.syncUrlState(true);
    this.refreshLeadsFromBackend();
  }

  refreshLeadsFromBackend(): void {
    const phoneType: PhoneLineType | undefined = this.onlyMobileWhatsapp() ? 'MOBILE' : undefined;
    this.prospecting
      .fetchLeads({
        excludeChains: this.excludeChains() || undefined,
        excludeCooldown: this.excludeCooldown() || undefined,
        phoneType,
        painCode: this.selectedPainFilter() || undefined,
        limit: 150,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (leads) => {
          this.renderLeadMarkers(leads);
          // Auto-select lead if leadId param was provided and lead exists
          const targetLeadId = this.leadId();
          if (targetLeadId && (!this.prospecting.selectedLead() || this.prospecting.selectedLead()?.id !== targetLeadId)) {
            const matchedLead = leads.find((l) => l.id === targetLeadId);
            if (matchedLead) {
              this.selectLead(matchedLead);
            }
          }
        },
      });
  }

  focusMapOnSavedLeads(): void {
    if (!this.map) return;
    const coords = this.prospecting
      .leads()
      .map((l) => {
        const rawLat = l.latitude as unknown;
        const rawLng = l.longitude as unknown;
        const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
        const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));
        return isFinite(lat) && isFinite(lng) ? ([lat, lng] as [number, number]) : null;
      })
      .filter((coord): coord is [number, number] => coord !== null);
    if (coords.length === 0) return;

    const first = this.prospecting.leads()[0];
    if (first?.city && first?.state) {
      this.selectedCity.set(first.city);
      this.selectedState.set(first.state);
    }
    this.map.fitBounds(L.latLngBounds(coords), { padding: [56, 56], maxZoom: 14 });
  }

  setScanMode(mode: 'RADIUS' | 'POLYGON'): void {
    this.scanMode.set(mode);
    if (!this.map) return;

    if (mode === 'RADIUS') {
      if (this.circleLayer && !this.map.hasLayer(this.circleLayer)) {
        this.circleLayer.addTo(this.map);
      }
      if (this.centerMarker && !this.map.hasLayer(this.centerMarker)) {
        this.centerMarker.addTo(this.map);
      }
      this.updateRadarCircle();
    } else if (this.customPolygonLayer && this.map.hasLayer(this.customPolygonLayer)) {
      this.map.fitBounds(this.customPolygonLayer.getBounds(), { padding: [50, 50] });
    } else {
      this.isPolygonModalOpen.set(true);
    }
  }

  private initMap(): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    this.map = L.map(container, {
      center: [this.currentCenter.lat, this.currentCenter.lng],
      zoom: 13,
      zoomControl: false,
    });

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
        maxZoom: 18,
        maxNativeZoom: 16,
      },
    ).addTo(this.map);

    L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      {
        maxZoom: 18,
        maxNativeZoom: 16,
      },
    ).addTo(this.map);

    L.control.zoom({ position: 'topleft' }).addTo(this.map);
    this.leadMarkersLayer.addTo(this.map);

    const pmMap = this.map as LeafletESM.Map & {
      pm?: {
        addControls: (opts: Record<string, unknown>) => void;
      };
    };

    if (pmMap.pm) {
      pmMap.pm.addControls({
        position: 'topleft',
        drawCircle: false,
        drawMarker: false,
        drawCircleMarker: false,
        drawPolyline: false,
        drawPolygon: true,
        drawRectangle: true,
        editMode: true,
        dragMode: false,
        cutPolygon: false,
        removalMode: true,
      });

      this.map.on(
        'pm:create',
        (e: LeafletESM.LeafletEvent & { layer?: LeafletESM.Polygon; shape?: string }) => {
          if (e.layer && (e.shape === 'Polygon' || e.shape === 'Rectangle')) {
            this.handleGeomanDrawnLayer(e.layer);
          }
        },
      );

      this.map.on('pm:remove', (e: LeafletESM.LeafletEvent & { layer?: LeafletESM.Layer }) => {
        if (e.layer === this.customPolygonLayer) {
          this.clearPolygon();
        }
      });
    }

    this.updateRadarCircle();
    this.fetchCityBoundary(this.selectedCity(), this.selectedState(), this.selectedCountry());
    if (this.prospecting.leads().length > 0) {
      this.renderLeadMarkers(this.prospecting.leads());
    }
  }

  private handleGeomanDrawnLayer(layer: LeafletESM.Polygon): void {
    if (!this.map) return;

    if (this.customPolygonLayer && this.map.hasLayer(this.customPolygonLayer)) {
      this.map.removeLayer(this.customPolygonLayer);
    }

    this.customPolygonLayer = layer;
    layer.setStyle({
      color: '#06b6d4',
      weight: 2.5,
      dashArray: '4, 4',
      fillColor: '#0891b2',
      fillOpacity: 0.18,
    });

    const latlngs = layer.getLatLngs();
    const ring = (Array.isArray(latlngs[0]) ? latlngs[0] : latlngs) as LeafletESM.LatLng[];
    const coords: [number, number][] = ring.map((pt) => [
      Number(pt.lat.toFixed(6)),
      Number(pt.lng.toFixed(6)),
    ]);

    this.customPolygon.set(coords);
    this.scanMode.set('POLYGON');

    if (coords.length > 0) {
      let sumLat = 0;
      let sumLng = 0;
      for (const [lat, lng] of coords) {
        sumLat += lat;
        sumLng += lng;
      }
      this.currentCenter = {
        lat: Number((sumLat / coords.length).toFixed(6)),
        lng: Number((sumLng / coords.length).toFixed(6)),
      };
    }
  }

  updateRadarCircle(): void {
    if (!this.map) return;
    const radiusMeters = this.radiusKm() * 1000;

    if (!this.circleLayer) {
      this.circleLayer = L.circle([this.currentCenter.lat, this.currentCenter.lng], {
        radius: radiusMeters,
        color: '#06b6d4',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#0891b2',
        fillOpacity: 0.12,
      }).addTo(this.map);

      const centerIcon = L.divIcon({
        className: 'custom-center-marker',
        html: '<div class="geo-center-pin"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      this.centerMarker = L.marker([this.currentCenter.lat, this.currentCenter.lng], {
        icon: centerIcon,
        draggable: true,
      }).addTo(this.map);

      this.centerMarker.on('drag', (event: LeafletESM.LeafletEvent) => {
        const marker = event.target as LeafletESM.Marker;
        const newLatLng = marker.getLatLng();
        this.currentCenter = { lat: newLatLng.lat, lng: newLatLng.lng };
        this.circleLayer?.setLatLng(newLatLng);
      });
    } else {
      this.circleLayer.setLatLng([this.currentCenter.lat, this.currentCenter.lng]);
      this.circleLayer.setRadius(radiusMeters);
      this.centerMarker?.setLatLng([this.currentCenter.lat, this.currentCenter.lng]);
    }
  }

  private fetchCityBoundary(city: string, state: string, country: string = 'Mexico'): void {
    this.prospecting
      .geocodeCity(city, state, country)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res?.center && (!this.currentCenter.lat || !this.currentCenter.lng)) {
            this.currentCenter = res.center;
            this.updateRadarCircle();
          }
          if (this.map && res?.geojsonPolygon) {
            if (this.cityPolygonLayer) {
              this.map.removeLayer(this.cityPolygonLayer);
            }
            this.cityPolygonLayer = L.geoJSON(res.geojsonPolygon as GeoJSON.GeoJsonObject, {
              filter: (feature) => feature.geometry?.type !== 'Point',
              style: {
                color: '#38bdf8',
                weight: 1.5,
                dashArray: '4, 8',
                fillOpacity: 0.03,
                fillColor: '#38bdf8',
              },
            }).addTo(this.map);
          }
        },
      });
  }

  private updateMapPosition(zoom: number = 13): void {
    if (!this.map) return;
    this.map.flyTo([this.currentCenter.lat, this.currentCenter.lng], zoom, {
      duration: 1.0,
    });
    this.updateRadarCircle();
  }

  recenterRadar(): void {
    this.updateMapPosition();
  }

  applyPresetPolygon(preset: TacticalPolygonOption): void {
    if (typeof document !== 'undefined') {
      (document.activeElement as HTMLElement | null)?.blur();
    }
    this.selectedCountry.set(preset.countryName);
    this.selectedState.set(preset.state);
    this.selectedCity.set(preset.name);
    this.setPolygonOnMap(preset.polygon);
    this.isPolygonModalOpen.set(false);
    this.isZoneCollapsed.set(true);
  }

  loadSamplePolygonToTextarea(): void {
    const first = this.tacticalPolygons()[0];
    const sample = first?.polygon || [
      [20.97, -89.625],
      [21.002, -89.625],
      [21.002, -89.61],
      [20.97, -89.61],
    ];
    this.rawPolygonInput = JSON.stringify(sample, null, 2);
    this.polygonParseError.set(null);
  }

  applyPastedPolygon(): void {
    this.polygonParseError.set(null);
    if (!this.rawPolygonInput || !this.rawPolygonInput.trim()) {
      this.polygonParseError.set('Ingresa o pega al menos 3 coordenadas [lat, lng].');
      return;
    }

    const parsed = this.parseCoordinates(this.rawPolygonInput);
    if (!parsed || parsed.length < 3) {
      this.polygonParseError.set('Formato inválido: se requieren mínimo 3 vértices [lat, lng].');
      return;
    }

    this.setPolygonOnMap(parsed);
    this.isPolygonModalOpen.set(false);
    this.isZoneCollapsed.set(true);
    this.rawPolygonInput = '';
  }

  private setPolygonOnMap(coords: [number, number][]): void {
    if (!this.map) return;

    if (this.customPolygonLayer && this.map.hasLayer(this.customPolygonLayer)) {
      this.map.removeLayer(this.customPolygonLayer);
    }

    this.customPolygonLayer = L.polygon(coords, {
      color: '#06b6d4',
      weight: 2.5,
      dashArray: '4, 4',
      fillColor: '#0891b2',
      fillOpacity: 0.18,
    }).addTo(this.map);

    this.customPolygon.set(coords);
    this.scanMode.set('POLYGON');

    let sumLat = 0;
    let sumLng = 0;
    for (const [lat, lng] of coords) {
      sumLat += lat;
      sumLng += lng;
    }
    this.currentCenter = {
      lat: Number((sumLat / coords.length).toFixed(6)),
      lng: Number((sumLng / coords.length).toFixed(6)),
    };

    this.map.fitBounds(this.customPolygonLayer.getBounds(), { padding: [50, 50] });
  }

  clearPolygon(): void {
    if (this.customPolygonLayer && this.map?.hasLayer(this.customPolygonLayer)) {
      this.map.removeLayer(this.customPolygonLayer);
    }
    this.customPolygonLayer = undefined;
    this.customPolygon.set(null);
    this.scanMode.set('RADIUS');
    this.updateRadarCircle();
  }

  private parseCoordinates(input: string): [number, number][] | null {
    const trimmed = input.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'Feature' && parsed.geometry?.type === 'Polygon') {
        return parsed.geometry.coordinates[0].map((pt: number[]) => [Number(pt[1]), Number(pt[0])]);
      }
      if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates)) {
        return parsed.coordinates[0].map((pt: number[]) => [Number(pt[1]), Number(pt[0])]);
      }
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: unknown) => {
            if (Array.isArray(item) && item.length >= 2) return [Number(item[0]), Number(item[1])];
            if (item && typeof item === 'object' && 'lat' in item && 'lng' in item) {
              const obj = item as { lat: number; lng: number };
              return [Number(obj.lat), Number(obj.lng)];
            }
            return null;
          })
          .filter((pt): pt is [number, number] => pt !== null && !isNaN(pt[0]) && !isNaN(pt[1]));
      }
    } catch {
      const lines = trimmed.split(/[\r\n]+/);
      const points: [number, number][] = [];
      for (const line of lines) {
        const parts = line.split(/[,\s\t]+/).filter(Boolean);
        if (parts.length >= 2) {
          const lat = parseFloat(parts[0]);
          const lng = parseFloat(parts[1]);
          if (!isNaN(lat) && !isNaN(lng)) {
            points.push([lat, lng]);
          }
        }
      }
      if (points.length >= 3) return points;
    }
    return null;
  }

  private calculateAreaKm2(polygon: [number, number][]): number {
    if (!polygon || polygon.length < 3) return 0;
    const R = 6378.137;
    let total = 0;
    for (let i = 0; i < polygon.length; i++) {
      const j = (i + 1) % polygon.length;
      const p1 = polygon[i];
      const p2 = polygon[j];
      const lat1 = (p1[0] * Math.PI) / 180;
      const lat2 = (p2[0] * Math.PI) / 180;
      const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;
      total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }
    return Number(Math.abs((total * R * R) / 2).toFixed(2));
  }

  setDockMode(mode: DockViewMode): void {
    this.dockMode.set(mode);
    this.syncUrlState(true);
  }

  toggleSortDirection(): void {
    this.sortOrder.update((curr) => (curr === 'DESC' ? 'ASC' : 'DESC'));
  }

  onPageChanged(page: number): void {
    this.currentPage.set(page);
    this.syncUrlState(true);
    this.renderLeadMarkers(this.prospecting.leads());
  }

  triggerDeepEnrichment(lead: ProspectedBusiness, force = false): void {
    if (this.isEnrichingDeep()) return;
    const shouldForce = force || Boolean(lead.rawGoogleData?.deepIntelligence);
    this.isEnrichingDeep.set(true);
    this.crmFeedbackMessage.set(null);
    this.contactErrorMessage.set(null);

    this.prospecting
      .enrichLeadDeeply(lead.id, shouldForce)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isEnrichingDeep.set(false);
          this.crmFeedbackMessage.set('Inteligencia ejecutiva y catálogo completados');
        },
        error: (err) => {
          this.isEnrichingDeep.set(false);
          const msg = err?.error?.message || 'Error al enriquecer prospecto.';
          this.contactErrorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  triggerDemoGeneration(lead: ProspectedBusiness): void {
    if (this.isGeneratingDemo()) return;
    this.isGeneratingDemo.set(true);
    this.crmFeedbackMessage.set(null);
    this.contactErrorMessage.set(null);

    this.prospecting
      .generateDemoForLead(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (demo) => {
          this.isGeneratingDemo.set(false);
          this.crmFeedbackMessage.set('¡Demo web interactivo generado con éxito en Cloudflare R2!');
          setTimeout(() => this.crmFeedbackMessage.set(null), 4000);
        },
        error: (err) => {
          this.isGeneratingDemo.set(false);
          const msg = err?.error?.message || err?.message || 'Error al fabricar demo web.';
          this.contactErrorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  highlightMapMarker(lead: ProspectedBusiness): void {
    this.highlightedLeadId.set(lead.id);
    this.renderLeadMarkers(this.prospecting.leads());
  }

  resetMapMarkerHighlight(): void {
    this.highlightedLeadId.set(null);
    this.renderLeadMarkers(this.prospecting.leads());
  }

  triggerScan(): void {
    const isPolygon = this.scanMode() === 'POLYGON' && Boolean(this.customPolygon()?.length);
    const scanId = `radar_${Date.now()}`;

    this.isZoneCollapsed.set(true);
    if (this.dockMode() === 'PEEK') {
      this.dockMode.set('SPLIT');
    }
    this.syncUrlState(true);

    const centerLat = Number(this.currentCenter.lat) || 37.7749;
    const centerLng = Number(this.currentCenter.lng) || -122.4194;

    this.prospecting
      .scanArea({
        sector: this.selectedSector(),
        center: { lat: centerLat, lng: centerLng },
        radiusKm: Number(this.radiusKm()) || 5,
        city: this.selectedCity(),
        state: this.selectedState(),
        country: this.selectedCountry(),
        polygon: isPolygon ? this.customPolygon()! : undefined,
        scanId,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (this.hasActiveFilters()) {
            this.refreshLeadsFromBackend();
          } else {
            this.renderLeadMarkers(res.leads || this.prospecting.leads());
          }
        },
      });
  }

  private renderLeadMarkers(leads: ProspectedBusiness[]): void {
    if (!this.map) return;
    this.leadMarkersLayer.clearLayers();

    const selectedId = this.prospecting.selectedLead()?.id || null;
    const hoveredId = this.highlightedLeadId();

    for (const lead of leads) {
      const rawLat = lead.latitude as unknown;
      const rawLng = lead.longitude as unknown;
      const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
      const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));
      if (!isFinite(lat) || !isFinite(lng)) continue;

      const painMod = getPinModifierClass(lead.primaryPain);
      const chainMod = isChainLead(lead) ? 'geo-lead-pin--chain' : '';
      const isActive = selectedId === lead.id || hoveredId === lead.id;
      const activeMod = isActive ? 'geo-lead-pin--active' : '';
      const label = isChainLead(lead) ? 'HQ' : lead.phoneType === 'MOBILE' ? 'WA' : 'B2B';

      const icon = L.divIcon({
        className: 'custom-lead-pin',
        html: `<div class="geo-lead-pin ${painMod} ${chainMod} ${activeMod}">${label}</div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([lat, lng], { icon });
      marker.on('click', () => this.selectLead(lead));

      const ticketLabel = lead.estimatedTicketUsd ? ` · ~$${lead.estimatedTicketUsd} USD` : '';
      marker.bindTooltip(
        `<div class="text-xs font-semibold">${escapeHtml(lead.name)}</div><div class="text-[10px] opacity-80 font-mono">${escapeHtml(formatPainTitle(lead.primaryPain))}${escapeHtml(ticketLabel)}</div>`,
        {
          direction: 'top',
          className: 'geo-map-tooltip',
        },
      );

      this.leadMarkersLayer.addLayer(marker);
    }
  }

  selectLead(lead: ProspectedBusiness): void {
    const wasInspectorClosed = !this.prospecting.selectedLead();
    this.prospecting.selectedLead.set(lead);
    this.selectedPainId.set(null);
    this.crmFeedbackMessage.set(null);
    this.contactErrorMessage.set(null);
    this.isConfirmingBlacklist.set(false);
    this.prospecting.selectedLeadPains.set(lead.detectedPains || []);
    this.prospecting.selectedLeadContacts.set([]);

    if (isChainLead(lead)) {
      this.selectedPitchTone.set('ENTERPRISE');
    } else if (lead.phoneType === 'LANDLINE' || lead.phoneType === 'TOLL_FREE') {
      this.selectedPitchTone.set('GATEKEEPER');
    } else {
      this.selectedPitchTone.set('OWNER');
    }

    this.contactChannelInput.set(lead.phoneType === 'MOBILE' ? 'WHATSAPP' : 'PHONE_CALL');

    this.prospecting
      .getLeadPains(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
    this.prospecting
      .getLeadContacts(lead.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    this.renderLeadMarkers(this.prospecting.leads());

    if (wasInspectorClosed) {
      this.scheduleMapResize();
    }

    this.scrollLeadCardIntoView(lead.id);

    const rawLat = lead.latitude as unknown;
    const rawLng = lead.longitude as unknown;
    const lat = typeof rawLat === 'number' ? rawLat : parseFloat(String(rawLat));
    const lng = typeof rawLng === 'number' ? rawLng : parseFloat(String(rawLng));

    if (this.map && isFinite(lat) && isFinite(lng)) {
      const targetZoom = 15;
      // Camera Viewport Projection Offset:
      // When Inspector is open on the right (w-[410px]), offset center so pin sits in visible center
      const targetPoint = this.map.project([lat, lng], targetZoom);
      const offsetPoint = L.point(targetPoint.x + 205, targetPoint.y);
      const compensatedLatLng = this.map.unproject(offsetPoint, targetZoom);
      this.map.flyTo(compensatedLatLng, targetZoom, {
        duration: 0.8,
        easeLinearity: 0.25,
      });
    }

    this.syncUrlState(false);
  }

  closeInspector(): void {
    this.isConfirmingBlacklist.set(false);
    this.prospecting.selectedLead.set(null);
    this.renderLeadMarkers(this.prospecting.leads());
    this.scheduleMapResize();
    this.syncUrlState(true);
  }

  dismissPainAsFalsePositive(
    lead: ProspectedBusiness,
    painItem: ProspectedBusinessPainItem,
    event: MouseEvent,
  ): void {
    event.stopPropagation();
    this.crmFeedbackMessage.set(null);

    this.prospecting
      .updateLeadPainStatus(lead.id, painItem.id, {
        status: 'FALSE_POSITIVE',
        dismissReason: 'Descartado manualmente desde Geo-Radar CRM',
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.selectedPainId.set(null);
          this.crmFeedbackMessage.set(
            res.activePainsRemaining > 0
              ? `Falso positivo descartado (${res.activePainsRemaining} activa[s])`
              : 'Dolencia descartada',
          );
          this.prospecting
            .getLeadPains(lead.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
          this.refreshLeadsFromBackend();
        },
      });
  }

  submitContactLog(lead: ProspectedBusiness): void {
    this.isSavingContact.set(true);
    this.contactErrorMessage.set(null);
    this.crmFeedbackMessage.set(null);

    const activePain = this.currentActivePain();
    const recipientRole =
      this.selectedPitchTone() === 'GATEKEEPER'
        ? 'GATEKEEPER_RECEPTION'
        : this.selectedPitchTone() === 'ENTERPRISE'
          ? 'CORPORATE_DECISION_MAKER'
          : 'BUSINESS_OWNER';

    this.prospecting
      .recordContact(lead.id, {
        channel: this.contactChannelInput(),
        recipientRole,
        painCode: activePain?.painCatalog.code,
        pitchToneUsed: this.selectedPitchTone(),
        outcome: this.contactOutcomeInput(),
        notes: this.contactNotesInput().trim() || undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isSavingContact.set(false);
          this.contactNotesInput.set('');
          this.crmFeedbackMessage.set('Contacto registrado y cooldown actualizado');
          this.prospecting
            .getLeadContacts(lead.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
          this.prospecting
            .getFunnelAnalytics()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe();
          this.refreshLeadsFromBackend();
        },
        error: (err) => {
          this.isSavingContact.set(false);
          const msg =
            err?.error?.message ||
            'No se pudo registrar el contacto (verifica si el prospecto está en enfriamiento activo).';
          this.contactErrorMessage.set(Array.isArray(msg) ? msg.join(', ') : msg);
        },
      });
  }

  blacklistCurrentLead(lead: ProspectedBusiness): void {
    this.isConfirmingBlacklist.set(false);
    this.prospecting
      .blacklistLead(lead.id, 'Marcado como No Contactar desde Geo-Radar CRM')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.renderLeadMarkers(this.prospecting.leads());
          this.scheduleMapResize();
        },
      });
  }

  currentSuggestedOffer(lead: ProspectedBusiness): string {
    const activePain = this.currentActivePain();
    return activePain?.painCatalog.suggestedOffer || lead.suggestedOffer || 'Consultoría Digital B2B';
  }

  buildDecisionMakerGreeting(lead: ProspectedBusiness): string {
    const primaryContact = lead.contacts?.find((c) => c.isPrimary) || lead.contacts?.[0];
    const legacyDm = lead.rawGoogleData?.deepIntelligence?.decisionMakers?.[0];

    if (primaryContact) {
      if (primaryContact.honorific && primaryContact.fullName) {
        return `Hola, ${primaryContact.honorific} ${primaryContact.fullName}.`;
      }
      return `Hola, ${primaryContact.fullName}.`;
    }

    if (legacyDm?.name) {
      return `Hola, ${legacyDm.name}.`;
    }

    return `Hola equipo de ${lead.name},`;
  }

  currentPitchText(lead: ProspectedBusiness): string {
    const activePain = this.currentActivePain();
    const tone = this.selectedPitchTone();
    let pitch = '';

    if (activePain) {
      if (tone === 'GATEKEEPER' && activePain.customPitchGatekeeper) {
        pitch = activePain.customPitchGatekeeper;
      } else if (tone === 'ENTERPRISE' && activePain.customPitchEnterprise) {
        pitch = activePain.customPitchEnterprise;
      } else if (activePain.customPitchOwner) {
        const greeting = this.buildDecisionMakerGreeting(lead);
        pitch = activePain.customPitchOwner.replace(/^Hola[^,\n.]*[,.]/i, greeting);
      }
    }

    if (!pitch) {
      const greeting = this.buildDecisionMakerGreeting(lead);
      if (lead.salesPitchDraft) {
        pitch = lead.salesPitchDraft.replace(/^Hola[^,\n.]*[,.]/i, greeting);
      } else {
        pitch = `${greeting} revisamos su presencia en Google Maps en ${lead.city} y preparamos una propuesta para optimizar su captación digital. ¿Con quién podemos compartirla?`;
      }
    }

    if (lead.painAnalysis?.websiteDemo?.demoUrl) {
      pitch += `\n\nAquí pueden ver un demo interactivo exclusivo que preparamos para ustedes: ${lead.painAnalysis.websiteDemo.demoUrl}`;
    }

    return pitch;
  }

  buildWhatsappUrl(lead: ProspectedBusiness): string {
    const digits = cleanPhoneDigits(lead.phoneE164 || lead.phone || '');
    const text = encodeURIComponent(this.currentPitchText(lead));
    return `https://wa.me/${digits}?text=${text}`;
  }

  copyPitch(text?: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    this.copiedPitch.set(true);
    setTimeout(() => this.copiedPitch.set(false), 2500);
  }

  // Template delegators
  checkChain(lead: ProspectedBusiness): boolean {
    return isChainLead(lead);
  }

  checkCooldown(lead: ProspectedBusiness): boolean {
    return isLeadInCooldown(lead);
  }

  cooldownDays(lead: ProspectedBusiness): number {
    return getCooldownDaysLeft(lead);
  }

  painBadge(pain?: CompanyPainCategory | null): string {
    return getPainBadgeClass(pain);
  }

  painDot(pain?: CompanyPainCategory | null): string {
    return getPainDotClass(pain);
  }

  painTitle(pain?: CompanyPainCategory | null): string {
    return formatPainTitle(pain);
  }

  priceTier(priceLevel?: number | null): string {
    return formatPriceTier(priceLevel);
  }
}
