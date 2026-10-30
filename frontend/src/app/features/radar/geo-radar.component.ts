import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ProspectingService,
  ProspectedBusiness,
  CompanyPainCategory,
} from '../../core/services/prospecting.service';
import {
  LucideMapPin,
  LucideSearch,
  LucideCrosshair,
  LucideSliders,
  LucideSparkles,
  LucideCopy,
  LucideCheck,
  LucidePhone,
  LucideGlobe,
  LucideLayers,
  LucideTrash2,
} from '@lucide/angular';

import * as L from 'leaflet';
import '@geoman-io/leaflet-geoman-free';

export interface StatePreset {
  name: string;
  cities: { name: string; lat: number; lng: number }[];
}

export interface TacticalPolygonPreset {
  name: string;
  city: string;
  country: string;
  flag: string;
  category: 'Industrial' | 'Comercial' | 'Financiero';
  polygon: [number, number][];
}

export interface CountryData {
  countryCode: 'MX' | 'US' | 'CO';
  countryName: string;
  flag: string;
  states: StatePreset[];
}

export const COUNTRIES_CONFIG: CountryData[] = [
  {
    countryCode: 'MX',
    countryName: 'Mexico',
    flag: '🇲🇽',
    states: [
      {
        name: 'Yucatán',
        cities: [
          { name: 'Mérida', lat: 20.9674, lng: -89.5926 },
          { name: 'Progreso', lat: 21.2833, lng: -89.6667 },
          { name: 'Valladolid', lat: 20.6897, lng: -88.2025 },
          { name: 'Kanasín', lat: 20.9333, lng: -89.5667 },
        ],
      },
      {
        name: 'Querétaro',
        cities: [
          { name: 'Querétaro', lat: 20.5888, lng: -100.3899 },
          { name: 'San Juan del Río', lat: 20.3889, lng: -99.9961 },
          { name: 'Corregidora', lat: 20.5317, lng: -100.4439 },
          { name: 'El Marqués', lat: 20.6667, lng: -100.3000 },
        ],
      },
      {
        name: 'Jalisco',
        cities: [
          { name: 'Guadalajara', lat: 20.6597, lng: -103.3496 },
          { name: 'Zapopan', lat: 20.7167, lng: -103.4000 },
          { name: 'Tlaquepaque', lat: 20.6394, lng: -103.3134 },
        ],
      },
      {
        name: 'Ciudad de México',
        cities: [
          { name: 'Cuauhtémoc (Centro)', lat: 19.4326, lng: -99.1332 },
          { name: 'Benito Juárez', lat: 19.3800, lng: -99.1600 },
          { name: 'Miguel Hidalgo', lat: 19.4200, lng: -99.1900 },
        ],
      },
      {
        name: 'Nuevo León',
        cities: [
          { name: 'Monterrey', lat: 25.6866, lng: -100.3161 },
          { name: 'San Pedro Garza García', lat: 25.6600, lng: -100.4000 },
          { name: 'Apodaca', lat: 25.7800, lng: -100.1900 },
        ],
      },
      {
        name: 'Quintana Roo',
        cities: [
          { name: 'Cancún', lat: 21.1619, lng: -86.8515 },
          { name: 'Playa del Carmen', lat: 20.6274, lng: -87.0799 },
          { name: 'Tulum', lat: 20.2114, lng: -87.4654 },
        ],
      },
    ],
  },
  {
    countryCode: 'CO',
    countryName: 'Colombia',
    flag: '🇨🇴',
    states: [
      {
        name: 'Bogotá D.C. / Cundinamarca',
        cities: [
          { name: 'Bogotá (Distrito Capital)', lat: 4.7110, lng: -74.0721 },
          { name: 'Chía', lat: 4.8633, lng: -74.0583 },
          { name: 'Soacha', lat: 4.5794, lng: -74.2169 },
          { name: 'Zipaquirá', lat: 5.0264, lng: -74.0040 },
        ],
      },
      {
        name: 'Antioquia',
        cities: [
          { name: 'Medellín', lat: 6.2442, lng: -75.5812 },
          { name: 'Envigado', lat: 6.1759, lng: -75.5917 },
          { name: 'Itagüí', lat: 6.1846, lng: -75.5991 },
          { name: 'Bello', lat: 6.3373, lng: -75.5579 },
          { name: 'Rionegro (Oriente)', lat: 6.1552, lng: -75.3737 },
          { name: 'Sabaneta', lat: 6.1514, lng: -75.6164 },
        ],
      },
      {
        name: 'Santander',
        cities: [
          { name: 'Bucaramanga', lat: 7.1193, lng: -73.1227 },
          { name: 'Floridablanca', lat: 7.0622, lng: -73.0864 },
          { name: 'Girón', lat: 7.0682, lng: -73.1698 },
          { name: 'Piedecuesta', lat: 6.9880, lng: -73.0498 },
          { name: 'Barrancabermeja', lat: 7.0653, lng: -73.8547 },
        ],
      },
      {
        name: 'Valle del Cauca',
        cities: [
          { name: 'Cali', lat: 3.4516, lng: -76.5320 },
          { name: 'Palmira', lat: 3.5394, lng: -76.3036 },
          { name: 'Yumbo (Industrial)', lat: 3.5822, lng: -76.4947 },
        ],
      },
      {
        name: 'Atlántico',
        cities: [
          { name: 'Barranquilla', lat: 10.9685, lng: -74.7813 },
          { name: 'Soledad', lat: 10.9184, lng: -74.7646 },
          { name: 'Puerto Colombia', lat: 10.9878, lng: -74.9547 },
        ],
      },
    ],
  },
  {
    countryCode: 'US',
    countryName: 'United States',
    flag: '🇺🇸',
    states: [
      {
        name: 'California',
        cities: [
          { name: 'San Francisco (SoMa & Tech Hub)', lat: 37.7785, lng: -122.3950 },
          { name: 'San Francisco (Financial District)', lat: 37.7946, lng: -122.3999 },
          { name: 'San Francisco (Mission District)', lat: 37.7599, lng: -122.4148 },
          { name: 'Palo Alto (Stanford / Sand Hill)', lat: 37.4419, lng: -122.1430 },
          { name: 'Mountain View (Google HQ & Castro)', lat: 37.3861, lng: -122.0839 },
          { name: 'Sunnyvale (Cloud & Telecom)', lat: 37.3688, lng: -122.0363 },
          { name: 'Santa Clara (Silicon & AI Hardware)', lat: 37.3541, lng: -121.9552 },
          { name: 'San Jose (Silicon Valley Capital)', lat: 37.3382, lng: -121.8863 },
          { name: 'Oakland (Downtown & Port)', lat: 37.8044, lng: -122.2712 },
          { name: 'Berkeley (Research & Biotech)', lat: 37.8715, lng: -122.2730 },
          { name: 'San Mateo (Enterprise SaaS)', lat: 37.5630, lng: -122.3255 },
          { name: 'Redwood City (Tech Campuses)', lat: 37.4852, lng: -122.2364 },
          { name: 'Los Angeles (Silicon Beach)', lat: 34.0195, lng: -118.4912 },
          { name: 'Irvine (Orange County Business)', lat: 33.6846, lng: -117.8265 },
          { name: 'San Diego (Biotech & Qualcomm)', lat: 32.8328, lng: -117.2713 },
        ],
      },
      {
        name: 'Texas',
        cities: [
          { name: 'Austin', lat: 30.2672, lng: -97.7431 },
          { name: 'Houston', lat: 29.7604, lng: -95.3698 },
          { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
          { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
        ],
      },
      {
        name: 'Florida',
        cities: [
          { name: 'Miami', lat: 25.7617, lng: -80.1918 },
          { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
          { name: 'Tampa', lat: 27.9506, lng: -82.4572 },
          { name: 'Fort Lauderdale', lat: 26.1224, lng: -80.1373 },
        ],
      },
      {
        name: 'New York',
        cities: [
          { name: 'New York City (Manhattan)', lat: 40.7128, lng: -74.0060 },
          { name: 'Brooklyn', lat: 40.6782, lng: -73.9442 },
          { name: 'Queens', lat: 40.7282, lng: -73.7949 },
        ],
      },
      {
        name: 'Illinois',
        cities: [
          { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
          { name: 'Naperville', lat: 41.7508, lng: -88.1535 },
        ],
      },
    ],
  },
];

export const TACTICAL_POLYGONS: TacticalPolygonPreset[] = [
  {
    name: 'Corredor Industrial Mérida - Progreso',
    city: 'Mérida',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Industrial',
    polygon: [
      [21.0100, -89.6500],
      [21.0550, -89.6500],
      [21.0550, -89.5950],
      [21.0100, -89.5950],
    ],
  },
  {
    name: 'Paseo de Montejo & Zona Hotelera',
    city: 'Mérida',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Comercial',
    polygon: [
      [20.9700, -89.6250],
      [21.0020, -89.6250],
      [21.0020, -89.6100],
      [20.9700, -89.6100],
    ],
  },
  {
    name: 'Zona Industrial Benito Juárez',
    city: 'Querétaro',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Industrial',
    polygon: [
      [20.6150, -100.4400],
      [20.6350, -100.4400],
      [20.6350, -100.4100],
      [20.6150, -100.4100],
    ],
  },
  {
    name: 'Corredor Comercial Bernardo Quintana',
    city: 'Querétaro',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Comercial',
    polygon: [
      [20.5900, -100.3850],
      [20.6300, -100.3850],
      [20.6300, -100.3650],
      [20.5900, -100.3650],
    ],
  },
  {
    name: 'Centro Histórico & Comercial',
    city: 'Querétaro',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Comercial',
    polygon: [
      [20.5850, -100.4050],
      [20.6020, -100.4050],
      [20.6020, -100.3800],
      [20.5850, -100.3800],
    ],
  },
  {
    name: 'Distrito Providencia / Américas',
    city: 'Guadalajara',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Financiero',
    polygon: [
      [20.6900, -103.3900],
      [20.7150, -103.3900],
      [20.7150, -103.3650],
      [20.6900, -103.3650],
    ],
  },
  {
    name: 'Brickell Financial District',
    city: 'Miami',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Financiero',
    polygon: [
      [25.7550, -80.1980],
      [25.7720, -80.1980],
      [25.7720, -80.1850],
      [25.7550, -80.1850],
    ],
  },
  {
    name: 'Austin Downtown Tech Corridor',
    city: 'Austin',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Financiero',
    polygon: [
      [30.2600, -97.7550],
      [30.2780, -97.7550],
      [30.2780, -97.7350],
      [30.2600, -97.7350],
    ],
  },
  {
    name: 'Silicon Valley Innovation Hub',
    city: 'San Jose (Silicon Valley)',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Industrial',
    polygon: [
      [37.3600, -121.9500],
      [37.4200, -121.9500],
      [37.4200, -121.8800],
      [37.3600, -121.8800],
    ],
  },
  {
    name: 'Corredor Corporativo Santa Fe',
    city: 'Ciudad de México',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Financiero',
    polygon: [
      [19.3550, -99.2700],
      [19.3780, -99.2700],
      [19.3780, -99.2450],
      [19.3550, -99.2450],
    ],
  },
  {
    name: 'Milla de Oro & El Poblado',
    city: 'Medellín',
    country: 'Colombia',
    flag: '🇨🇴',
    category: 'Financiero',
    polygon: [
      [6.2020, -75.5780],
      [6.2160, -75.5780],
      [6.2160, -75.5670],
      [6.2020, -75.5670],
    ],
  },
  {
    name: 'Distrito Financiero Calle 72 / Chicó',
    city: 'Bogotá (Distrito Capital)',
    country: 'Colombia',
    flag: '🇨🇴',
    category: 'Financiero',
    polygon: [
      [4.6530, -74.0620],
      [4.6750, -74.0620],
      [4.6750, -74.0480],
      [4.6530, -74.0480],
    ],
  },
  {
    name: 'Cabecera del Llano & Cra 33',
    city: 'Bucaramanga',
    country: 'Colombia',
    flag: '🇨🇴',
    category: 'Comercial',
    polygon: [
      [7.1120, -73.1180],
      [7.1260, -73.1180],
      [7.1260, -73.1060],
      [7.1120, -73.1060],
    ],
  },
  {
    name: 'SoMa & Financial District AI Tech Hub',
    city: 'San Francisco (SoMa & Tech Hub)',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Financiero',
    polygon: [
      [37.7810, -122.4080],
      [37.7980, -122.4080],
      [37.7980, -122.3920],
      [37.7810, -122.3920],
    ],
  },
  {
    name: 'Mission Bay Biotech & Life Sciences',
    city: 'San Francisco (Financial District)',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Industrial',
    polygon: [
      [37.7650, -122.3950],
      [37.7770, -122.3950],
      [37.7770, -122.3830],
      [37.7650, -122.3830],
    ],
  },
  {
    name: 'Sand Hill Road VC Alley & Stanford',
    city: 'Palo Alto (Stanford / Sand Hill)',
    country: 'United States',
    flag: '🇺🇸',
    category: 'Financiero',
    polygon: [
      [37.4080, -122.1850],
      [37.4280, -122.1850],
      [37.4280, -122.1480],
      [37.4080, -122.1480],
    ],
  },
  {
    name: 'Parque Industrial Apodaca',
    city: 'Monterrey',
    country: 'Mexico',
    flag: '🇲🇽',
    category: 'Industrial',
    polygon: [
      [25.7500, -100.2250],
      [25.7950, -100.2250],
      [25.7950, -100.1700],
      [25.7500, -100.1700],
    ],
  },
];

@Component({
  selector: 'app-geo-radar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideMapPin,
    LucideSearch,
    LucideCrosshair,
    LucideSliders,
    LucideSparkles,
    LucideCopy,
    LucideCheck,
    LucidePhone,
    LucideGlobe,
    LucideLayers,
    LucideTrash2,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex h-full w-full overflow-hidden bg-[#090d14] text-slate-100">
      <!-- PANEL LATERAL: CONTROLES & LEADS DISCOVERY (430px) -->
      <aside class="w-[430px] border-r border-slate-800/80 bg-[#0c111a]/95 flex flex-col z-20 shrink-0 shadow-2xl backdrop-blur-md">
        <!-- TOP: HEADER DE BÚSQUEDA & RADAR -->
        <div class="p-4 border-b border-slate-800 space-y-3.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)]">
                <svg lucideCrosshair class="w-4 h-4 animate-spin-slow"></svg>
              </div>
              <h2 class="font-bold text-sm tracking-wide text-white flex items-center gap-1.5">
                GEO-RADAR <span class="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800">B2B Intel</span>
              </h2>
            </div>
            <span class="text-xs text-slate-400 font-mono">
              {{ prospecting.leads().length }} leads en zona
            </span>
          </div>

          <!-- SECTOR SELECTION -->
          <div class="space-y-1.5">
            <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Sector / Giro</span>
              <span class="text-cyan-400 text-[10px]">Especialidad</span>
            </label>
            <div class="relative">
              <input
                type="text"
                [(ngModel)]="selectedSector"
                placeholder="ej: Dentistas, Talleres Mecánicos, Notarías..."
                class="w-full bg-[#131b29] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <!-- Quick Sector Chips -->
            <div class="flex flex-wrap gap-1 pt-1">
              @for (chip of popularSectors; track chip) {
                <button
                  type="button"
                  (click)="selectedSector = chip"
                  class="text-[10px] px-2 py-0.5 rounded-full border transition-all"
                  [ngClass]="selectedSector === chip ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm' : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:border-slate-700'"
                >
                  {{ chip }}
                </button>
              }
            </div>
          </div>

          <!-- LOCATION CONTROLS (PAÍS, ESTADO & CIUDAD) -->
          <div class="grid grid-cols-3 gap-2 pt-1">
            <div>
              <label class="text-[10px] font-semibold text-slate-400 uppercase">País</label>
              <select
                [(ngModel)]="selectedCountry"
                (change)="onCountryChange()"
                class="w-full mt-1 bg-[#131b29] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                @for (country of countries; track country.countryCode) {
                  <option [value]="country.countryName">{{ country.flag }} {{ country.countryCode === 'MX' ? 'México' : (country.countryCode === 'CO' ? 'Colombia' : 'USA') }}</option>
                }
              </select>
            </div>
            <div>
              <label class="text-[10px] font-semibold text-slate-400 uppercase">Estado</label>
              <select
                [(ngModel)]="selectedState"
                (change)="onStateChange()"
                class="w-full mt-1 bg-[#131b29] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                @for (state of currentStates(); track state.name) {
                  <option [value]="state.name">{{ state.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="text-[10px] font-semibold text-slate-400 uppercase">Ciudad</label>
              <select
                [(ngModel)]="selectedCity"
                (change)="onCityChange()"
                class="w-full mt-1 bg-[#131b29] border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                @for (city of currentCities(); track city.name) {
                  <option [value]="city.name">{{ city.name }}</option>
                }
              </select>
            </div>
          </div>

          <!-- MODO DE DELIMITACIÓN: RADIO VS POLÍGONO -->
          <div class="space-y-1.5 pt-1">
            <label class="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Modo de Delimitación</span>
              <span class="text-[10px] font-mono" [ngClass]="scanMode() === 'POLYGON' ? 'text-cyan-400 font-bold' : 'text-slate-500'">
                {{ scanMode() === 'POLYGON' ? 'Polígono Activo' : 'Radio Circular' }}
              </span>
            </label>
            <div class="grid grid-cols-2 gap-1.5 p-1 bg-[#131b29] rounded-lg border border-slate-800">
              <button
                type="button"
                (click)="setScanMode('RADIUS')"
                class="py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                [ngClass]="scanMode() === 'RADIUS' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'"
              >
                <svg lucideSliders class="w-3.5 h-3.5"></svg>
                <span>Radio Circular</span>
              </button>
              <button
                type="button"
                (click)="setScanMode('POLYGON')"
                class="py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                [ngClass]="scanMode() === 'POLYGON' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm' : 'text-slate-400 hover:text-white'"
              >
                <svg lucideLayers class="w-3.5 h-3.5"></svg>
                <span>Polígono Táctico</span>
              </button>
            </div>
          </div>

          <!-- CONTENIDO DEL MODO: RADIO SLIDER O POLÍGONO CONTROLS -->
          @if (scanMode() === 'RADIUS') {
            <!-- RADAR RADIUS SLIDER -->
            <div class="space-y-1.5 pt-1 animate-in fade-in duration-150">
              <div class="flex justify-between items-center text-xs">
                <span class="text-slate-400 flex items-center gap-1.5 text-[11px] font-semibold uppercase">
                  <svg lucideSliders class="w-3.5 h-3.5 text-cyan-400"></svg> Radio de Cobertura
                </span>
                <span class="font-mono text-cyan-400 font-bold text-xs bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                  {{ radiusKm }} km
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="20"
                step="0.5"
                [(ngModel)]="radiusKm"
                (input)="updateRadarCircle()"
                class="w-full accent-cyan-400 bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <div class="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 km (Colonia)</span>
                <span>5 km (Distrito)</span>
                <span>20 km (Metrópoli)</span>
              </div>
            </div>
          } @else {
            <!-- POLYGON CONTROLS & STATUS -->
            <div class="space-y-2 pt-1 animate-in fade-in duration-150">
              @if (customPolygon(); as poly) {
                <!-- Active Polygon Summary Card -->
                <div class="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 space-y-1.5">
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                      <span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
                      Polígono Táctico Delimitado
                    </span>
                    <button
                      type="button"
                      (click)="clearPolygon()"
                      class="text-[10px] text-rose-400 hover:text-rose-300 flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <svg lucideTrash2 class="w-3 h-3"></svg> Limpiar
                    </button>
                  </div>
                  <div class="flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>{{ poly.length }} vértices trazados</span>
                    <span class="text-cyan-400 font-bold">~{{ polygonAreaKm2() }} km²</span>
                  </div>
                  <button
                    type="button"
                    (click)="isPolygonModalOpen.set(true)"
                    class="w-full mt-1 py-1 text-[10px] text-center text-cyan-400 hover:text-cyan-300 bg-cyan-950/60 hover:bg-cyan-900/60 rounded border border-cyan-800/60 transition-colors"
                  >
                    Editar coordenadas / cambiar zona
                  </button>
                </div>
              } @else {
                <!-- Empty Polygon State -->
                <div class="p-3 rounded-lg bg-slate-900/60 border border-dashed border-slate-700/80 text-center space-y-2">
                  <p class="text-[11px] text-slate-400 leading-tight">
                    Dibuja un polígono con la barra <span class="text-cyan-400 font-semibold">Geoman</span> en la esquina superior del mapa o importa uno personalizado.
                  </p>
                  <button
                    type="button"
                    (click)="isPolygonModalOpen.set(true)"
                    class="w-full py-1.5 px-3 rounded-md bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <svg lucideLayers class="w-3.5 h-3.5"></svg>
                    <span>Ingresar Polígono (GeoJSON / Coords)</span>
                  </button>
                </div>
              }
            </div>
          }

          <!-- ACTION BUTTON -->
          <button
            type="button"
            (click)="triggerScan()"
            [disabled]="prospecting.isScanning()"
            class="w-full mt-2 py-2.5 px-4 rounded-lg font-bold text-xs tracking-wide uppercase transition-all duration-200 flex items-center justify-center gap-2 shadow-lg cursor-pointer"
            [ngClass]="prospecting.isScanning() ? 'bg-cyan-950 text-cyan-300 border border-cyan-700 cursor-not-allowed' : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-950/50 hover:shadow-cyan-500/20 active:scale-[0.99]'"
          >
            @if (prospecting.isScanning()) {
              <div class="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Analizando Google Maps & Dolencias...</span>
            } @else {
              <svg lucideSparkles class="w-4 h-4"></svg>
              <span>{{ scanMode() === 'POLYGON' ? 'Escanear Dentro del Polígono' : 'Escanear Negocios en Radar' }}</span>
            }
          </button>
        </div>

        <!-- LISTA DE LEADS ENCONTRADOS -->
        <div class="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar">
          @if (prospecting.leads().length === 0 && !prospecting.isScanning()) {
            <div class="text-center py-12 px-4 space-y-3">
              <div class="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/80 mx-auto flex items-center justify-center text-slate-500">
                <svg lucideMapPin class="w-6 h-6"></svg>
              </div>
              <h3 class="text-xs font-semibold text-slate-300">Zona lista para explorar</h3>
              <p class="text-[11px] text-slate-500 leading-relaxed max-w-[260px] mx-auto">
                Selecciona tu sector y haz clic en <span class="text-cyan-400 font-medium">Escanear</span> para identificar negocios y sus necesidades de software.
              </p>
            </div>
          }

          @for (lead of prospecting.leads(); track lead.id) {
            <div
              (click)="selectLead(lead)"
              class="p-3 rounded-xl border transition-all duration-150 cursor-pointer text-left relative overflow-hidden group"
              [ngClass]="prospecting.selectedLead()?.id === lead.id
                ? 'bg-[#152033] border-cyan-500/80 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/50'
                : 'bg-[#101724]/80 border-slate-800 hover:border-slate-700 hover:bg-[#131c2c]'"
            >
              <!-- Pain Indicator Badge Top -->
              <div class="flex items-center justify-between mb-2">
                <span
                  class="text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1"
                  [ngClass]="getPainBadgeClass(lead.primaryPain)"
                >
                  <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getPainDotClass(lead.primaryPain)"></span>
                  {{ formatPainTitle(lead.primaryPain) }}
                </span>
                <span class="text-[11px] font-mono text-amber-400 flex items-center gap-1">
                  ★ {{ lead.rating }} <span class="text-slate-500">({{ lead.reviewsCount }})</span>
                </span>
              </div>

              <!-- Name & Address -->
              <h4 class="font-bold text-xs text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                {{ lead.name }}
              </h4>
              <p class="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{{ lead.address }}</p>

              <!-- Opportunity Headline -->
              <div class="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between">
                <span class="text-[10px] text-cyan-400 font-medium truncate max-w-[240px]">
                  💡 {{ lead.suggestedOffer || 'Propuesta disponible' }}
                </span>
                <span class="text-[10px] text-slate-400 group-hover:text-cyan-300 transition-colors flex items-center gap-0.5">
                  Ver pitch ➜
                </span>
              </div>
            </div>
          }
        </div>
      </aside>

      <!-- ÁREA CENTRAL: MAPA TÁCTICO LEAFLET (FLEX-1) -->
      <main class="flex-1 relative flex flex-col min-w-0">
        <!-- MAP CONTAINER -->
        <div #mapContainer class="w-full h-full z-0 bg-[#060a10]"></div>

        <!-- MAP OVERLAY CONTROLS (Top Right) -->
        <div class="absolute top-4 right-16 z-10 flex items-center gap-2 bg-[#0c111a]/90 backdrop-blur-md border border-slate-800 p-1.5 rounded-xl shadow-xl">
          <button
            type="button"
            (click)="recenterRadar()"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Centrar mapa en el radar"
          >
            <svg lucideCrosshair class="w-3.5 h-3.5 text-cyan-400"></svg>
            <span>Centrar</span>
          </button>
          <div class="h-4 w-px bg-slate-800"></div>
          <button
            type="button"
            (click)="isPolygonModalOpen.set(true)"
            class="px-2.5 py-1 text-xs font-semibold rounded-lg text-cyan-300 hover:text-white hover:bg-cyan-950/60 transition-colors flex items-center gap-1.5 border border-cyan-800/40 cursor-pointer"
            title="Ingresar o gestionar polígono táctico"
          >
            <svg lucideLayers class="w-3.5 h-3.5"></svg>
            <span>Ingresar Polígono</span>
          </button>
          <div class="h-4 w-px bg-slate-800"></div>
          <span class="text-[11px] text-slate-400 font-mono px-1">
            📍 {{ selectedCity }}, {{ selectedState }} ({{ getCountryBadge() }})
          </span>
        </div>

        <!-- DRAWER / MODAL DEL LEAD SELECCIONADO (Bottom Overlay) -->
        @if (prospecting.selectedLead(); as activeLead) {
          <div class="absolute bottom-6 left-6 right-6 z-20 bg-[#0d1421]/95 border border-cyan-500/30 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom duration-200">
            <div class="flex items-start justify-between gap-4">
              <!-- Info Col -->
              <div class="space-y-1.5 max-w-xl">
                <div class="flex items-center gap-2">
                  <span
                    class="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                    [ngClass]="getPainBadgeClass(activeLead.primaryPain)"
                  >
                    {{ formatPainTitle(activeLead.primaryPain) }}
                  </span>
                  <span class="text-xs font-mono text-amber-400">★ {{ activeLead.rating }} ({{ activeLead.reviewsCount }} reviews)</span>
                  @if (activeLead.websiteUrl) {
                    <a [href]="activeLead.websiteUrl" target="_blank" class="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                      <svg lucideGlobe class="w-3 h-3"></svg> Sitio oficial
                    </a>
                  } @else {
                    <span class="text-xs text-rose-400 font-medium">⚠️ Sin sitio web oficial</span>
                  }
                </div>
                <h3 class="text-base font-bold text-white tracking-tight">{{ activeLead.name }}</h3>
                <p class="text-xs text-slate-300 leading-relaxed font-mono bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span class="text-cyan-400 font-bold block mb-1">💬 Pitch de Contacto Preparado:</span>
                  {{ activeLead.salesPitchDraft }}
                </p>
              </div>

              <!-- Actions Col -->
              <div class="flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  (click)="copyPitch(activeLead.salesPitchDraft)"
                  class="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-950/60 transition-all active:scale-95 cursor-pointer"
                >
                  @if (copiedPitch()) {
                    <svg lucideCheck class="w-4 h-4 text-emerald-300"></svg>
                    <span>¡Copiado al Portapapeles!</span>
                  } @else {
                    <svg lucideCopy class="w-4 h-4"></svg>
                    <span>Copiar Pitch WhatsApp</span>
                  }
                </button>
                @if (activeLead.phone) {
                  <a
                    [href]="'https://wa.me/' + cleanPhone(activeLead.phone)"
                    target="_blank"
                    class="px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <svg lucidePhone class="w-4 h-4"></svg>
                    <span>Abrir en WhatsApp</span>
                  </a>
                }
                <button
                  type="button"
                  (click)="prospecting.selectedLead.set(null)"
                  class="px-4 py-1.5 text-slate-400 hover:text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        }
      </main>

      <!-- MODAL INGRESOR DE POLÍGONOS TÁCTICOS -->
      @if (isPolygonModalOpen()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div class="bg-[#0f1522] border border-cyan-500/40 rounded-2xl w-full max-w-xl p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-slate-800 pb-3">
              <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                  <svg lucideLayers class="w-4 h-4"></svg>
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white tracking-wide">Ingresor de Polígonos Tácticos B2B</h3>
                  <p class="text-[11px] text-slate-400">Pega coordenadas, GeoJSON o selecciona zonas estratégicas</p>
                </div>
              </div>
              <button
                type="button"
                (click)="isPolygonModalOpen.set(false)"
                class="w-7 h-7 rounded-lg hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Presets Section -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Zonas & Corredores Predefinidos</span>
                <span class="text-cyan-400 text-[10px]">1-Clic para cargar</span>
              </label>
              <div class="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar pr-1">
                @for (preset of tacticalPresets; track preset.name) {
                  <button
                    type="button"
                    (click)="applyPresetPolygon(preset)"
                    class="p-2.5 rounded-xl bg-slate-900/80 hover:bg-[#152033] border border-slate-800 hover:border-cyan-500/50 text-left transition-all group cursor-pointer"
                  >
                    <div class="text-[11px] font-bold text-white group-hover:text-cyan-300 truncate">{{ preset.flag }} {{ preset.name }}</div>
                    <div class="text-[10px] text-slate-500 font-mono mt-0.5">{{ preset.city }} · {{ preset.category }}</div>
                  </button>
                }
              </div>
            </div>

            <!-- Raw Coordinate / GeoJSON Input -->
            <div class="space-y-1.5">
              <label class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Pegar Coordenadas o GeoJSON</span>
                <span class="text-slate-500 text-[10px] font-mono">[[lat, lng], ...] o Feature</span>
              </label>
              <textarea
                [(ngModel)]="rawPolygonInput"
                placeholder='Pega aquí coordenadas o GeoJSON, ej:&#10;[&#10;  [20.6150, -100.4400],&#10;  [20.6350, -100.4400],&#10;  [20.6350, -100.4100],&#10;  [20.6150, -100.4100]&#10;]'
                rows="5"
                class="w-full bg-[#131b29] border border-slate-700/80 rounded-xl p-3 text-xs font-mono text-cyan-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 custom-scrollbar"
              ></textarea>
              @if (polygonParseError()) {
                <p class="text-[11px] text-rose-400 font-mono flex items-center gap-1">
                  ⚠️ {{ polygonParseError() }}
                </p>
              }
            </div>

            <!-- Modal Footer Actions -->
            <div class="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                (click)="loadDemoQueretaroPolygon()"
                class="text-[11px] text-cyan-400 hover:underline cursor-pointer"
              >
                Cargar ejemplo Querétaro
              </button>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="isPolygonModalOpen.set(false)"
                  class="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  (click)="applyPastedPolygon()"
                  class="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold shadow-lg shadow-cyan-950/60 transition-all cursor-pointer active:scale-95"
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
  styles: [
    `
      .animate-spin-slow {
        animation: spin 8s linear infinite;
      }
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 5px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(15, 23, 42, 0.4);
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: rgba(51, 65, 85, 0.6);
        border-radius: 9999px;
      }
    `,
  ],
})
export class GeoRadarComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly prospecting = inject(ProspectingService);
  private readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  // Map layers
  private map?: L.Map;
  private circleLayer?: L.Circle;
  private centerMarker?: L.Marker;
  private cityPolygonLayer?: L.GeoJSON;
  private customPolygonLayer?: L.Polygon;
  private leadMarkersLayer = L.layerGroup();

  // Multi-Country & State & Cities presets
  readonly countries = COUNTRIES_CONFIG;
  selectedCountry = 'Mexico';
  selectedState = 'Yucatán';
  selectedCity = 'Mérida';
  currentCenter = { lat: 20.9674, lng: -89.5926 };

  // Inputs & Scanning mode
  selectedSector = 'Dentistas';
  readonly popularSectors = ['Dentistas', 'Talleres Mecánicos', 'Notarías', 'Restaurantes', 'Clínicas', 'Logística'];
  radiusKm = 5;

  readonly scanMode = signal<'RADIUS' | 'POLYGON'>('RADIUS');
  readonly customPolygon = signal<[number, number][] | null>(null);
  readonly isPolygonModalOpen = signal<boolean>(false);
  readonly polygonParseError = signal<string | null>(null);
  rawPolygonInput = '';

  readonly tacticalPresets = TACTICAL_POLYGONS;

  readonly polygonAreaKm2 = computed(() => {
    const poly = this.customPolygon();
    if (!poly || poly.length < 3) return 0;
    return this.calculateAreaKm2(poly);
  });

  readonly copiedPitch = signal<boolean>(false);
  readonly currentStates = signal<StatePreset[]>([]);
  readonly currentCities = signal<{ name: string; lat: number; lng: number }[]>([]);

  ngOnInit() {
    this.updateCurrentStates();
    this.updateCurrentCities();
  }

  ngAfterViewInit() {
    this.initMap();
  }

  ngOnDestroy() {
    if (this.map) {
      this.map.remove();
    }
  }

  setScanMode(mode: 'RADIUS' | 'POLYGON') {
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
    } else {
      // In polygon mode, if polygon exists, focus on it
      if (this.customPolygonLayer && this.map.hasLayer(this.customPolygonLayer)) {
        this.map.fitBounds(this.customPolygonLayer.getBounds(), { padding: [50, 50] });
      } else {
        // If no polygon yet, prompt opening the modal or hint
        this.isPolygonModalOpen.set(true);
      }
    }
  }

  onCountryChange() {
    this.updateCurrentStates();
    const firstState = this.currentStates()[0];
    if (firstState) {
      this.selectedState = firstState.name;
      this.onStateChange();
    }
  }

  onStateChange() {
    this.updateCurrentCities();
    const firstCity = this.currentCities()[0];
    if (firstCity) {
      this.selectedCity = firstCity.name;
      this.onCityChange();
    }
  }

  onCityChange() {
    const cityObj = this.currentCities().find((c) => c.name === this.selectedCity);
    if (cityObj) {
      this.currentCenter = { lat: cityObj.lat, lng: cityObj.lng };
      this.fetchCityBoundary(cityObj.name, this.selectedState, this.selectedCountry);
      this.updateMapPosition();
    }
  }

  private updateCurrentStates() {
    const countryObj = this.countries.find((c) => c.countryName === this.selectedCountry);
    if (countryObj) {
      this.currentStates.set(countryObj.states);
    }
  }

  private updateCurrentCities() {
    const states = this.currentStates();
    const stateObj = states.find((s) => s.name === this.selectedState) || states[0];
    if (stateObj) {
      this.currentCities.set(stateObj.cities);
    } else {
      this.currentCities.set([]);
    }
  }

  private initMap() {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    // CartoDB Dark Matter tiles (neon tactical look)
    this.map = L.map(container, {
      center: [this.currentCenter.lat, this.currentCenter.lng],
      zoom: 13,
      zoomControl: false,
    });

    // Basemap táctico oscuro de alta definición (Esri World Dark Gray Canvas) - 100% Gratuito, sin marcas de agua ni API Key
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
      maxZoom: 16,
    }).addTo(this.map);

    // Capa táctica de etiquetas de calles, avenidas y colonias
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 16,
    }).addTo(this.map);

    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.leadMarkersLayer.addTo(this.map);

    // Initialize Leaflet Geoman toolbar for manual polygon and rectangle drawing
    if ((this.map as any).pm) {
      (this.map as any).pm.addControls({
        position: 'topright',
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

      this.map.on('pm:create', (e: any) => {
        if (e.layer && (e.shape === 'Polygon' || e.shape === 'Rectangle')) {
          this.handleGeomanDrawnLayer(e.layer);
        }
      });

      this.map.on('pm:remove', (e: any) => {
        if (e.layer === this.customPolygonLayer) {
          this.clearPolygon();
        }
      });
    }

    this.updateRadarCircle();
    this.fetchCityBoundary(this.selectedCity, this.selectedState, this.selectedCountry);
  }

  private handleGeomanDrawnLayer(layer: any) {
    if (!this.map) return;

    // Remove old polygon layer if exists
    if (this.customPolygonLayer && this.map.hasLayer(this.customPolygonLayer)) {
      this.map.removeLayer(this.customPolygonLayer);
    }

    this.customPolygonLayer = layer;

    // Style the drawn polygon in neon tactical cyan
    layer.setStyle({
      color: '#06b6d4',
      weight: 2.5,
      dashArray: '4, 4',
      fillColor: '#0891b2',
      fillOpacity: 0.18,
    });

    const latlngs = layer.getLatLngs();
    const ring = Array.isArray(latlngs[0]) ? latlngs[0] : latlngs;
    const coords: [number, number][] = ring.map((pt: any) => [Number(pt.lat.toFixed(6)), Number(pt.lng.toFixed(6))]);

    this.customPolygon.set(coords);
    this.scanMode.set('POLYGON');

    // Update center to polygon centroid
    if (coords.length > 0) {
      let sumLat = 0, sumLng = 0;
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

  updateRadarCircle() {
    if (!this.map) return;

    const radiusMeters = this.radiusKm * 1000;

    if (!this.circleLayer) {
      this.circleLayer = L.circle([this.currentCenter.lat, this.currentCenter.lng], {
        radius: radiusMeters,
        color: '#06b6d4',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#0891b2',
        fillOpacity: 0.12,
      }).addTo(this.map);

      // Draggable center pin
      const centerIcon = L.divIcon({
        className: 'custom-center-marker',
        html: `<div style="width: 14px; height: 14px; background: #06b6d4; border: 2px solid white; border-radius: 50%; box-shadow: 0 0 12px #06b6d4;"></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      this.centerMarker = L.marker([this.currentCenter.lat, this.currentCenter.lng], {
        icon: centerIcon,
        draggable: true,
      }).addTo(this.map);

      this.centerMarker.on('drag', (event: any) => {
        const newLatLng = event.target.getLatLng();
        this.currentCenter = { lat: newLatLng.lat, lng: newLatLng.lng };
        this.circleLayer?.setLatLng(newLatLng);
      });
    } else {
      this.circleLayer.setLatLng([this.currentCenter.lat, this.currentCenter.lng]);
      this.circleLayer.setRadius(radiusMeters);
      this.centerMarker?.setLatLng([this.currentCenter.lat, this.currentCenter.lng]);
    }
  }

  private fetchCityBoundary(city: string, state: string, country: string = 'Mexico') {
    this.prospecting.geocodeCity(city, state, country).subscribe({
      next: (res) => {
        if (res?.center) {
          this.currentCenter = res.center;
          this.updateRadarCircle();
        }

        if (this.map && res?.geojsonPolygon) {
          if (this.cityPolygonLayer) {
            this.map.removeLayer(this.cityPolygonLayer);
          }

          this.cityPolygonLayer = L.geoJSON(res.geojsonPolygon, {
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

  private updateMapPosition() {
    if (!this.map) return;
    this.map.flyTo([this.currentCenter.lat, this.currentCenter.lng], 13, {
      duration: 1.2,
    });
    this.updateRadarCircle();
  }

  recenterRadar() {
    this.updateMapPosition();
  }

  applyPresetPolygon(preset: TacticalPolygonPreset) {
    this.setPolygonOnMap(preset.polygon);
    this.selectedCity = preset.city;
    if (preset.country) {
      this.selectedCountry = preset.country;
      this.updateCurrentStates();
      const stateObj = this.currentStates().find((s) => s.cities.some((c) => c.name === preset.city));
      if (stateObj) {
        this.selectedState = stateObj.name;
        this.updateCurrentCities();
      }
    }
    this.isPolygonModalOpen.set(false);
  }

  loadDemoQueretaroPolygon() {
    const demo = TACTICAL_POLYGONS[0];
    this.rawPolygonInput = JSON.stringify(demo.polygon, null, 2);
    this.polygonParseError.set(null);
  }

  applyPastedPolygon() {
    this.polygonParseError.set(null);
    if (!this.rawPolygonInput || !this.rawPolygonInput.trim()) {
      this.polygonParseError.set('Por favor ingresa o pega coordenadas.');
      return;
    }

    const parsed = this.parseCoordinates(this.rawPolygonInput);
    if (!parsed || parsed.length < 3) {
      this.polygonParseError.set('No se detectaron al menos 3 coordenadas válidas [lat, lng].');
      return;
    }

    this.setPolygonOnMap(parsed);
    this.isPolygonModalOpen.set(false);
    this.rawPolygonInput = '';
  }

  private setPolygonOnMap(coords: [number, number][]) {
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

    // Calculate centroid and center map
    let sumLat = 0, sumLng = 0;
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

  clearPolygon() {
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
      // GeoJSON Feature
      if (parsed.type === 'Feature' && parsed.geometry?.type === 'Polygon') {
        const ring = parsed.geometry.coordinates[0];
        return ring.map((pt: any[]) => [Number(pt[1]), Number(pt[0])]);
      }
      // GeoJSON Polygon
      if (parsed.type === 'Polygon' && Array.isArray(parsed.coordinates)) {
        const ring = parsed.coordinates[0];
        return ring.map((pt: any[]) => [Number(pt[1]), Number(pt[0])]);
      }
      // Array of arrays [[lat, lng], ...]
      if (Array.isArray(parsed)) {
        return parsed
          .map((item: any) => {
            if (Array.isArray(item) && item.length >= 2) return [Number(item[0]), Number(item[1])];
            if (item && 'lat' in item && 'lng' in item) return [Number(item.lat), Number(item.lng)];
            return null;
          })
          .filter((pt): pt is [number, number] => pt !== null && !isNaN(pt[0]) && !isNaN(pt[1]));
      }
    } catch {
      // Line by line fallback
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
      if (points.length >= 3) {
        return points;
      }
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
    const area = Math.abs((total * R * R) / 2);
    return Number(area.toFixed(2));
  }

  triggerScan() {
    const isPolygon = this.scanMode() === 'POLYGON' && Boolean(this.customPolygon()?.length);

    this.prospecting
      .scanArea({
        sector: this.selectedSector,
        center: this.currentCenter,
        radiusKm: this.radiusKm,
        city: this.selectedCity,
        state: this.selectedState,
        country: this.selectedCountry,
        polygon: isPolygon ? this.customPolygon()! : undefined,
      })
      .subscribe({
        next: (res) => {
          this.renderLeadMarkers(res.leads);
        },
      });
  }

  private renderLeadMarkers(leads: ProspectedBusiness[]) {
    if (!this.map) return;
    this.leadMarkersLayer.clearLayers();

    leads.forEach((lead) => {
      const color = this.getMarkerColor(lead.primaryPain);
      const icon = L.divIcon({
        className: 'custom-lead-pin',
        html: `<div style="
          width: 22px; height: 22px;
          background: ${color};
          border: 2px solid white;
          border-radius: 50%;
          box-shadow: 0 0 14px ${color};
          display: flex; align-items: center; justify-content: center;
          font-size: 10px; font-weight: bold; color: white;">
          ★
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });

      const marker = L.marker([lead.latitude, lead.longitude], { icon });
      marker.on('click', () => {
        this.selectLead(lead);
      });
      marker.bindTooltip(`<b>${lead.name}</b><br><span style="font-size: 10px;">${this.formatPainTitle(lead.primaryPain)}</span>`, {
        direction: 'top',
        className: 'bg-slate-900 text-white border border-slate-700 text-xs px-2 py-1 rounded shadow',
      });

      this.leadMarkersLayer.addLayer(marker);
    });
  }

  selectLead(lead: ProspectedBusiness) {
    this.prospecting.selectedLead.set(lead);
    if (this.map) {
      this.map.panTo([lead.latitude, lead.longitude]);
    }
  }

  copyPitch(text?: string) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    this.copiedPitch.set(true);
    setTimeout(() => this.copiedPitch.set(false), 2500);
  }

  cleanPhone(phone?: string): string {
    return (phone || '').replace(/\D/g, '');
  }

  getPainBadgeClass(pain?: CompanyPainCategory): string {
    switch (pain) {
      case 'NO_WEBSITE':
        return 'bg-rose-950/80 text-rose-300 border-rose-800/80';
      case 'NO_ONLINE_BOOKING':
        return 'bg-amber-950/80 text-amber-300 border-amber-800/80';
      case 'UNRESPONSIVE_CUSTOMER_SERVICE':
        return 'bg-violet-950/80 text-violet-300 border-violet-800/80';
      case 'MANUAL_INVENTORY_OR_CATALOG':
        return 'bg-blue-950/80 text-blue-300 border-blue-800/80';
      default:
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
    }
  }

  getPainDotClass(pain?: CompanyPainCategory): string {
    switch (pain) {
      case 'NO_WEBSITE':
        return 'bg-rose-400';
      case 'NO_ONLINE_BOOKING':
        return 'bg-amber-400';
      case 'UNRESPONSIVE_CUSTOMER_SERVICE':
        return 'bg-violet-400';
      case 'MANUAL_INVENTORY_OR_CATALOG':
        return 'bg-blue-400';
      default:
        return 'bg-cyan-400';
    }
  }

  private getMarkerColor(pain?: CompanyPainCategory): string {
    switch (pain) {
      case 'NO_WEBSITE':
        return '#f43f5e'; // rose-500
      case 'NO_ONLINE_BOOKING':
        return '#f59e0b'; // amber-500
      case 'UNRESPONSIVE_CUSTOMER_SERVICE':
        return '#8b5cf6'; // violet-500
      case 'MANUAL_INVENTORY_OR_CATALOG':
        return '#3b82f6'; // blue-500
      default:
        return '#06b6d4'; // cyan-500
    }
  }

  formatPainTitle(pain?: CompanyPainCategory): string {
    switch (pain) {
      case 'NO_WEBSITE':
        return '🚨 Sin Sitio Web Oficial';
      case 'NO_ONLINE_BOOKING':
        return '📅 Demora en Citas';
      case 'UNRESPONSIVE_CUSTOMER_SERVICE':
        return '🤖 WhatsApp Desatendido';
      case 'MANUAL_INVENTORY_OR_CATALOG':
        return '📋 Catálogo Manual';
      case 'OUTDATED_OR_SLOW_WEB':
        return '⚡ Web Obsoleta / Lenta';
      case 'LACK_OF_ECOMMERCE':
        return '🛒 Falta Tienda Online';
      default:
        return '💡 Oportunidad Detectada';
    }
  }

  getCountryBadge(): string {
    if (this.selectedCountry === 'Colombia') return '🇨🇴 CO';
    if (this.selectedCountry === 'United States') return '🇺🇸 US';
    return '🇲🇽 MX';
  }
}
