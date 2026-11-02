import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAlertCircle,
  LucideBan,
  LucideBuilding2,
  LucideCheck,
  LucideCheckCircle2,
  LucideClock,
  LucideCopy,
  LucideExternalLink,
  LucideGlobe,
  LucideMail,
  LucidePhone,
  LucideSearch,
  LucideSmartphone,
  LucideSparkles,
  LucideStore,
  LucideUserCheck,
  LucideX,
} from '@lucide/angular';
import {
  ContactChannel,
  ContactOutcome,
  PitchToneKey,
  ProspectContactLogItem,
  ProspectedBusiness,
  ProspectedBusinessPainItem,
} from '../../../core/services/prospecting.service';
import {
  cleanPhoneDigits,
  formatChannelLabel,
  formatOutcomeLabel,
  formatPriceTier,
  getCooldownDaysLeft,
  isChainLead,
  isLeadInCooldown,
} from './geo-radar.models';

@Component({
  selector: 'app-geo-lead-inspector',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideBuilding2,
    LucideStore,
    LucideSmartphone,
    LucidePhone,
    LucideClock,
    LucideBan,
    LucideCopy,
    LucideCheck,
    LucideExternalLink,
    LucideGlobe,
    LucideMail,
    LucideAlertCircle,
    LucideCheckCircle2,
    LucideSearch,
    LucideSparkles,
    LucideUserCheck,
    LucideX,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside
      data-testid="geo-crm-inspector"
      class="w-[410px] h-full border-l border-border-subtle bg-surface flex flex-col shrink-0 z-20 select-none"
    >
      <!-- TOP INSPECTOR HEADER -->
      <div class="p-3.5 border-b border-border-subtle flex items-start justify-between gap-2 bg-surface-elevated/50">
        <div class="min-w-0 space-y-1">
          <div class="flex flex-wrap items-center gap-1.5">
            @if (isChain()) {
              <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <svg lucideBuilding2 class="w-3 h-3"></svg>
                <span>Franquicia: {{ lead().corporateBrand?.name || 'Multi-Sede' }}</span>
              </span>
            } @else {
              <span class="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-badge-high-bg text-badge-high-text border border-emerald-500/30">
                <svg lucideStore class="w-3 h-3"></svg>
                <span>Negocio Independiente</span>
              </span>
            }

            <span class="text-[11px] font-mono text-amber-400 tabular-nums">
              {{ lead().rating || '—' }} ★ ({{ lead().reviewsCount }})
            </span>

            @if (lead().estimatedTicketUsd) {
              <span class="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 rounded-md tabular-nums">
                ~&#36;{{ lead().estimatedTicketUsd }} USD {{ priceTier() }}
              </span>
            }
          </div>

          <h3 class="text-sm font-bold text-content-primary leading-snug break-words">
            {{ lead().name }}
          </h3>

          <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-content-secondary">
            <span class="truncate max-w-[240px]">{{ lead().address || (lead().city + ', ' + lead().state) }}</span>
            @if (lead().phoneE164 || lead().phone) {
              <span class="font-mono text-content-primary tabular-nums">{{ lead().phoneE164 || lead().phone }}</span>
            }
            @if (lead().email) {
              <a
                [href]="'mailto:' + lead().email"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-cyan-400 hover:underline font-mono text-[11px]"
                title="Email comercial verificado"
              >
                <svg lucideMail class="w-3 h-3"></svg>
                <span class="truncate max-w-[170px]">{{ lead().email }}</span>
                @if (lead().emailDeliverability === 'VERIFIED') {
                  <span class="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-300 font-bold">MX OK</span>
                }
              </a>
            }
            @if (lead().websiteUrl) {
              <a
                [href]="lead().websiteUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-cyan-400 hover:underline font-medium"
              >
                <svg lucideGlobe class="w-3 h-3"></svg>
                <span>Web{{ lead().websiteHttpStatus ? ' (' + lead().websiteHttpStatus + ')' : '' }}</span>
                <svg lucideExternalLink class="w-2.5 h-2.5"></svg>
              </a>
            } @else {
              <span class="text-badge-low-text font-medium">Sin dominio propio</span>
            }
          </div>
        </div>

        <button
          type="button"
          (click)="closeRequested.emit()"
          title="Cerrar Panel (Esc)"
          class="press-scale px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-hover border border-border-subtle text-content-secondary hover:text-content-primary text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <span>Cerrar Panel</span>
          <kbd class="kbd-shortcut px-1 py-0.2 rounded text-[9px] bg-app text-content-muted">Esc</kbd>
        </button>
      </div>

      <!-- SCROLLABLE BODY -->
      <div class="flex-1 overflow-y-auto p-3.5 space-y-3.5">
        <!-- SECTION 1: M:N PAINS & FALSE POSITIVE DISMISSAL -->
        <section class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-content-secondary">
              Dolencias Activas ({{ activePains().length }})
            </span>
            @if (feedbackMessage()) {
              <span class="inline-flex items-center gap-1 text-[10px] font-mono text-badge-high-text">
                <svg lucideCheckCircle2 class="w-3 h-3"></svg>
                <span>{{ feedbackMessage() }}</span>
              </span>
            }
          </div>

          @if (activePains().length > 0) {
            <div class="flex flex-wrap gap-1.5">
              @for (painItem of activePains(); track painItem.id) {
                <div
                  (click)="painSelected.emit(painItem.id)"
                  class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] transition-colors cursor-pointer"
                  [ngClass]="currentPain()?.id === painItem.id
                    ? 'bg-cyan-500/15 border-cyan-400/60 text-content-primary'
                    : 'bg-app border-border-subtle text-content-secondary hover:text-content-primary'"
                >
                  @if (painItem.isPrimary) {
                    <span class="text-[9px] font-mono font-bold uppercase px-1 rounded bg-cyan-500/25 text-cyan-200">1ª</span>
                  }
                  <span class="font-medium">{{ painItem.painCatalog.name }}</span>
                  <span class="text-[10px] font-mono text-cyan-300 tabular-nums">
                    {{ (painItem.confidence * 100) | number:'1.0-0' }}%
                  </span>
                  <button
                    type="button"
                    (click)="onDismissClick(painItem, $event)"
                    title="Marcar dolencia como Falso Positivo (promueve la siguiente)"
                    class="ml-0.5 p-0.5 rounded hover:bg-rose-500/25 text-content-muted hover:text-rose-300 cursor-pointer"
                  >
                    <svg lucideX class="w-3 h-3"></svg>
                  </button>
                </div>
              }
            </div>
          } @else {
            <div class="text-[11px] text-content-muted bg-app border border-border-subtle rounded-lg px-3 py-2">
              {{ lead().suggestedOffer || 'Todas las dolencias automáticas fueron descartadas o resueltas.' }}
            </div>
          }
        </section>

        <!-- SECTION 1.5: GOOGLE SERP & CHATGPT-STYLE EXECUTIVE INTELLIGENCE -->
        <section class="p-3 rounded-xl bg-surface-elevated/70 border border-cyan-500/30 space-y-2.5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5">
              <svg lucideSparkles class="w-3.5 h-3.5 text-cyan-400"></svg>
              <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                Inteligencia Ejecutiva (Web & Google SERP)
              </span>
            </div>
            <button
              type="button"
              data-testid="btn-deep-enrich"
              (click)="enrichRequested.emit()"
              [disabled]="isEnrichingDeep()"
              class="press-scale px-2 py-0.5 rounded-md bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
              title="Actualizar datos con Chromium Stealth y Google SERP (I)"
            >
              @if (isEnrichingDeep()) {
                <span class="w-2.5 h-2.5 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin"></span>
                <span>Rastreando…</span>
              } @else {
                <svg lucideSearch class="w-3 h-3"></svg>
                <span>{{ deepIntelligence() ? 'Actualizar' : 'Investigar a Fondo' }}</span>
                <kbd class="kbd-shortcut px-1 text-[8px] bg-black/30">I</kbd>
              }
            </button>
          </div>

          @if (contactError()) {
            <div data-testid="orion-error-banner" class="p-2 rounded-lg bg-rose-500/15 border border-rose-500/30 text-[11px] text-rose-300 flex items-center gap-2">
              <svg lucideAlertCircle class="w-3.5 h-3.5 text-rose-400 shrink-0"></svg>
              <span class="leading-tight">{{ contactError() }}</span>
            </div>
          }

          @if (deepIntelligence(); as intel) {
            <div class="space-y-2.5 text-[11px]">

              <!-- CHATGPT-STYLE KNOWLEDGE CARD -->
              <div class="p-2.5 rounded-lg bg-black/40 border border-cyan-500/20 space-y-1.5">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <h4 class="font-bold text-white text-[12px] leading-tight">
                      {{ intel.knowledgePanel?.title || lead().name }}
                    </h4>
                    <p class="text-[10px] text-content-muted">
                      {{ intel.knowledgePanel?.subtitle || (lead().city + ', ' + lead().country) }}
                    </p>
                  </div>
                  @if (lead().rating) {
                    <div class="flex items-center gap-1 text-[10px] text-amber-400 font-mono font-bold shrink-0">
                      <span>⭐ {{ lead().rating }}</span>
                      <span class="text-content-muted text-[9px]">({{ lead().reviewsCount }} reseñas)</span>
                    </div>
                  }
                </div>

                <div class="space-y-0.5 text-[10px] text-content-secondary">
                  <div class="flex items-center gap-1.5">
                    <span class="text-content-muted">Dirección:</span>
                    <span class="text-content-primary truncate">{{ intel.knowledgePanel?.address || lead().address }}</span>
                  </div>
                  @if (intel.knowledgePanel?.phone || lead().phone) {
                    <div class="flex items-center gap-1.5">
                      <span class="text-content-muted">Teléfono:</span>
                      <span class="font-mono text-cyan-300 font-semibold">{{ intel.knowledgePanel?.phone || lead().phone }}</span>
                    </div>
                  }
                  @if (intel.knowledgePanel?.hours) {
                    <div class="flex items-center gap-1.5">
                      <span class="text-content-muted">Horario:</span>
                      <span class="text-emerald-400 font-medium">{{ intel.knowledgePanel?.hours }}</span>
                    </div>
                  }
                </div>

                @if (lead().websiteUrl || intel.foundChannels.websiteUrl) {
                  <div class="pt-1 border-t border-border-subtle/40 flex items-center justify-between">
                    <a
                      [href]="lead().websiteUrl || intel.foundChannels.websiteUrl"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-[10px] text-cyan-300 hover:text-cyan-200 font-semibold flex items-center gap-1"
                    >
                      <span>Sitio web oficial</span>
                      <svg lucideExternalLink class="w-2.5 h-2.5"></svg>
                    </a>
                  </div>
                }
              </div>

              <!-- DECISION MAKER (DIRECTOR CLÍNICO) CHATGPT PILL -->
              @if (verifiedContacts().length > 0) {
                <div class="p-2 rounded-lg bg-surface/80 border border-border-subtle/80 space-y-1.5">
                  <div class="flex items-center gap-1.5 text-content-secondary leading-snug">
                    <svg lucideUserCheck class="w-3.5 h-3.5 text-cyan-400 shrink-0"></svg>
                    <span>La clínica está dirigida por:</span>
                    <span class="font-bold text-cyan-300">
                      {{ verifiedContacts()[0].honorific ? verifiedContacts()[0].honorific + ' ' : '' }}{{ verifiedContacts()[0].name }}
                    </span>
                  </div>
                  @if (verifiedContacts().length > 1) {
                    <div class="flex flex-wrap gap-1 items-center">
                      <span class="text-[9px] text-content-muted">Equipo asociado:</span>
                      @for (dm of verifiedContacts().slice(1); track dm.id || dm.name) {
                        <span class="text-[9px] px-1.5 py-0.2 rounded bg-app border border-border-subtle text-content-secondary">
                          {{ dm.name }} ({{ dm.role || 'Especialista' }})
                        </span>
                      }
                    </div>
                  }
                </div>
              }

              <!-- HIGH-TICKET SERVICES CATALOG (¿Qué servicios ofrece?) -->
              @if (intel.servicesCatalog && intel.servicesCatalog.length > 0) {
                <div class="space-y-1.5">
                  <span class="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                    ¿Qué servicios ofrece?
                  </span>
                  <div class="space-y-1.5">
                    @for (srv of intel.servicesCatalog; track srv.category) {
                      <div class="p-2 rounded-lg bg-surface-elevated border border-border-subtle flex items-start gap-2">
                        <span class="text-base leading-none shrink-0 mt-0.5">
                          {{ srv.category.includes('Estética') ? '✨' : srv.category.includes('Implantes') ? '🦷' : srv.category.includes('Ortodoncia') ? '💎' : '🩺' }}
                        </span>
                        <div class="min-w-0">
                          <p class="font-bold text-white text-[11px] leading-tight">{{ srv.category }}</p>
                          <p class="text-[10px] text-content-secondary leading-snug">{{ srv.summary }}</p>
                        </div>
                      </div>
                    }
                  </div>
                </div>
              }

              <!-- Canales Rescatados (WhatsApp, Redes, Email, Titular) -->
              <div class="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                @if (intel.foundChannels.whatsappUrl) {
                  <a
                    [href]="intel.foundChannels.whatsappUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5 hover:bg-emerald-500/25"
                  >
                    <svg lucideSmartphone class="w-3 h-3"></svg>
                    <span class="truncate">WhatsApp Hallado</span>
                    <svg lucideExternalLink class="w-2.5 h-2.5 ml-auto"></svg>
                  </a>
                }
                @if (lead().email || intel.foundChannels.email) {
                  <a
                    [href]="'mailto:' + (lead().email || intel.foundChannels.email)"
                    class="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1.5 hover:bg-cyan-500/25"
                    title="Enviar correo directo"
                  >
                    <svg lucideMail class="w-3 h-3"></svg>
                    <span class="truncate">{{ lead().email || intel.foundChannels.email }}</span>
                    <svg lucideExternalLink class="w-2.5 h-2.5 ml-auto"></svg>
                  </a>
                }
                @if (intel.foundChannels.facebookUrl) {
                  <a
                    [href]="intel.foundChannels.facebookUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 flex items-center gap-1.5 hover:bg-sky-500/25"
                  >
                    <span class="font-bold text-[9px] px-1 rounded bg-sky-400/20">FB</span>
                    <span class="truncate">Fanpage</span>
                    <svg lucideExternalLink class="w-2.5 h-2.5 ml-auto"></svg>
                  </a>
                }
                @if (intel.foundChannels.instagramUrl) {
                  <a
                    [href]="intel.foundChannels.instagramUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1.5 rounded-lg bg-fuchsia-500/15 border border-fuchsia-500/30 text-fuchsia-300 flex items-center gap-1.5 hover:bg-fuchsia-500/25"
                  >
                    <span class="font-bold text-[9px] px-1 rounded bg-fuchsia-400/20">IG</span>
                    <span class="truncate">Instagram</span>
                    <svg lucideExternalLink class="w-2.5 h-2.5 ml-auto"></svg>
                  </a>
                }
                @if (intel.foundChannels.linkedinUrl) {
                  <a
                    [href]="intel.foundChannels.linkedinUrl"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="p-1.5 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 flex items-center gap-1.5 hover:bg-blue-500/25"
                  >
                    <span class="font-bold text-[9px] px-1 rounded bg-blue-400/20">IN</span>
                    <span class="truncate">LinkedIn</span>
                    <svg lucideExternalLink class="w-2.5 h-2.5 ml-auto"></svg>
                  </a>
                }
              </div>

              <!-- Ángulo Sugerido -->
              <p class="text-[10px] text-content-secondary leading-snug bg-app/80 p-2 rounded border border-border-subtle/60 italic">
                "{{ intel.suggestedAngle }}"
              </p>
            </div>
          } @else {
            <p class="text-[10px] text-content-muted leading-relaxed">
              ¿Sin teléfono o sin web en Google Maps? Pulsa <strong>Investigar a Fondo</strong> para rastrear Google SERP, Knowledge Panel, directores clínicos y catálogo de servicios con Chromium Stealth.
            </p>
          }
        </section>

        <!-- SECTION 2: 3-TONE COMMERCIAL PITCH & QUICK CTAS -->
        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] font-semibold uppercase tracking-wider text-content-secondary">
              Tono del Pitch Comercial:
            </span>
            <span class="text-[10px] font-mono text-content-muted">
              Tono: {{ activePitchToneLabel() }}
            </span>
          </div>

          <div class="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-app border border-border-subtle">
            <button
              type="button"
              (click)="pitchToneChanged.emit('OWNER')"
              class="press-scale py-1 px-2 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              [ngClass]="selectedTone() === 'OWNER'
                ? 'bg-cyan-600 text-white'
                : 'text-content-secondary hover:text-content-primary'"
            >
              <kbd class="kbd-shortcut px-1 rounded text-[9px] bg-black/25">1</kbd>
              <span class="truncate">Dueño / Decisor</span>
            </button>
            <button
              type="button"
              (click)="pitchToneChanged.emit('GATEKEEPER')"
              class="press-scale py-1 px-2 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              [ngClass]="selectedTone() === 'GATEKEEPER'
                ? 'bg-amber-600 text-white'
                : 'text-content-secondary hover:text-content-primary'"
            >
              <kbd class="kbd-shortcut px-1 rounded text-[9px] bg-black/25">2</kbd>
              <span class="truncate">Recepción / Fijo</span>
            </button>
            <button
              type="button"
              (click)="pitchToneChanged.emit('ENTERPRISE')"
              class="press-scale py-1 px-2 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
              [ngClass]="selectedTone() === 'ENTERPRISE'
                ? 'bg-indigo-600 text-white'
                : 'text-content-secondary hover:text-content-primary'"
            >
              <kbd class="kbd-shortcut px-1 rounded text-[9px] bg-black/25">3</kbd>
              <span class="truncate">Corporativo</span>
            </button>
          </div>

          <div class="p-3 rounded-xl bg-app border border-border-subtle space-y-1.5">
            <div class="text-[10px] font-mono font-bold text-cyan-400">
              Oferta: {{ suggestedOfferText() }}
            </div>
            <p class="text-xs text-content-primary leading-relaxed font-mono whitespace-pre-line select-text">{{ pitchText() }}</p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <button
              type="button"
              (click)="copyRequested.emit()"
              class="press-scale px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              @if (copiedPitch()) {
                <svg lucideCheck class="w-3.5 h-3.5"></svg>
                <span>Pitch Copiado</span>
              } @else {
                <svg lucideCopy class="w-3.5 h-3.5"></svg>
                <span>Copiar Pitch</span>
                <kbd class="kbd-shortcut px-1 rounded text-[9px] bg-black/25">C</kbd>
              }
            </button>

            @if (lead().phoneType === 'MOBILE' && (lead().phoneE164 || lead().phone)) {
              <a
                [href]="whatsappUrl()"
                target="_blank"
                rel="noopener noreferrer"
                class="press-scale px-3 py-2 rounded-xl bg-badge-high-bg hover:bg-emerald-500/25 text-badge-high-text border border-emerald-500/30 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg lucideSmartphone class="w-3.5 h-3.5"></svg>
                <span>WhatsApp 1-Clic</span>
                <kbd class="kbd-shortcut px-1 rounded text-[9px] bg-black/20">W</kbd>
              </a>
            } @else if (lead().phone) {
              <a
                [href]="'tel:' + (lead().phoneE164 || cleanPhone())"
                class="press-scale px-3 py-2 rounded-xl bg-badge-med-bg hover:bg-amber-500/25 text-badge-med-text border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <svg lucidePhone class="w-3.5 h-3.5"></svg>
                <span>Llamar Fijo</span>
              </a>
            } @else {
              <span class="px-3 py-2 rounded-xl bg-app text-content-muted border border-border-subtle text-[11px] flex items-center justify-center">
                Sin teléfono
              </span>
            }
          </div>
        </section>

        <!-- SECTION 3: ANTI-SPAM COOLDOWN BANNER & OMNICHANNEL LOG -->
        <section class="space-y-2 pt-1 border-t border-border-subtle">
          @if (inCooldown()) {
            <div class="px-3 py-2 rounded-lg bg-badge-med-bg border border-amber-500/30 text-[11px] text-badge-med-text flex items-center justify-between gap-2">
              <span class="inline-flex items-center gap-1.5 font-medium">
                <svg lucideClock class="w-3.5 h-3.5 shrink-0"></svg>
                <span>En enfriamiento anti-spam ({{ cooldownDays() }} días restantes)</span>
              </span>
              <span class="font-mono text-[10px] tabular-nums shrink-0">{{ lead().contactAttemptsCount || 1 }} toque(s)</span>
            </div>
          }

          <div class="p-2.5 rounded-xl bg-surface-elevated/60 border border-border-subtle space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-bold uppercase tracking-wider text-content-secondary">
                Registrar Toque en Bitácora CRM
              </span>
            </div>

            <!-- Segmented Channel Pills (Zero Native OS Select) -->
            <div class="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-app border border-border-subtle">
              @for (ch of channelOptions; track ch.value) {
                <button
                  type="button"
                  (click)="channelChanged.emit(ch.value)"
                  class="press-scale py-1 px-1.5 rounded text-[10px] font-semibold cursor-pointer"
                  [ngClass]="contactChannel() === ch.value
                    ? 'bg-surface-elevated text-cyan-300 border border-cyan-500/40'
                    : 'text-content-muted hover:text-content-primary'"
                >
                  {{ ch.label }}
                </button>
              }
            </div>

            <!-- Outcome Pills -->
            <div class="flex flex-wrap gap-1">
              @for (out of outcomeOptions; track out.value) {
                <button
                  type="button"
                  (click)="outcomeChanged.emit(out.value)"
                  class="press-scale px-2 py-0.5 rounded-md text-[10px] border cursor-pointer"
                  [ngClass]="contactOutcome() === out.value
                    ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40 font-semibold'
                    : 'bg-app text-content-secondary border-border-subtle hover:text-content-primary'"
                >
                  {{ out.label }}
                </button>
              }
            </div>

            <div class="flex items-center gap-1.5">
              <input
                type="text"
                [ngModel]="contactNotes()"
                (ngModelChange)="notesChanged.emit($event)"
                placeholder="Nota rápida (ej. pidió llamar jueves, correo de compras...)"
                class="flex-1 bg-app border border-border-subtle rounded-lg px-2.5 py-1.5 text-[11px] text-content-primary placeholder-content-muted focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                (click)="submitContactRequested.emit()"
                [disabled]="isSavingContact()"
                class="press-scale px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] shrink-0 cursor-pointer"
              >
                {{ isSavingContact() ? '...' : 'Registrar' }}
              </button>
            </div>

            @if (contactError()) {
              <p class="inline-flex items-center gap-1 text-[10px] text-badge-low-text font-mono">
                <svg lucideAlertCircle class="w-3 h-3 shrink-0"></svg>
                <span>{{ contactError() }}</span>
              </p>
            }
          </div>

          <!-- REAL VERTICAL CONTACT TIMELINE -->
          @if (contacts().length > 0) {
            <div class="space-y-1.5 pt-1">
              <span class="text-[10px] font-semibold uppercase tracking-wider text-content-muted">
                Historial de Toques ({{ contacts().length }})
              </span>
              <div class="space-y-1.5">
                @for (entry of contacts(); track entry.id) {
                  <div class="p-2 rounded-lg bg-app border border-border-subtle text-[11px] space-y-0.5">
                    <div class="flex items-center justify-between font-mono text-[10px]">
                      <span class="text-cyan-300 font-semibold">
                        {{ formatChannel(entry.channel) }} · {{ formatOutcome(entry.outcome) }}
                      </span>
                      <span class="text-content-muted tabular-nums">
                        {{ entry.contactedAt | date:'dd/MM HH:mm' }}
                      </span>
                    </div>
                    @if (entry.notes) {
                      <p class="text-content-secondary text-[11px] leading-snug">{{ entry.notes }}</p>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </section>
      </div>

      <!-- FOOTER: 2-STEP SAFE BLACKLIST CONFIRMATION -->
      <div class="p-3 border-t border-border-subtle bg-surface-elevated/40">
        @if (isConfirmingBlacklist()) {
          <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-badge-low-bg border border-rose-500/40">
            <span class="text-[11px] font-semibold text-badge-low-text">
              ¿Confirmar bloqueo permanente?
            </span>
            <div class="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                (click)="cancelBlacklistRequested.emit()"
                class="press-scale px-2.5 py-1 rounded-md bg-surface hover:bg-surface-hover text-content-secondary text-[10px] font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                (click)="confirmBlacklistRequested.emit()"
                class="press-scale px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold cursor-pointer"
              >
                Sí, bloquear
              </button>
            </div>
          </div>
        } @else {
          <div class="flex items-center justify-between">
            <button
              type="button"
              (click)="requestBlacklistConfirmation.emit()"
              class="press-scale inline-flex items-center gap-1.5 text-[11px] text-badge-low-text hover:underline font-semibold cursor-pointer"
            >
              <svg lucideBan class="w-3.5 h-3.5"></svg>
              <span>No Contactar (Lista Negra)</span>
            </button>
            <span class="text-[10px] font-mono text-content-muted">
              <kbd class="kbd-shortcut px-1 py-0.2 rounded bg-app">J</kbd>/<kbd class="kbd-shortcut px-1 py-0.2 rounded bg-app">K</kbd> siguiente
            </span>
          </div>
        }
      </div>
    </aside>
  `,
})
export class GeoLeadInspectorComponent {
  readonly lead = input.required<ProspectedBusiness>();
  readonly activePains = input.required<ProspectedBusinessPainItem[]>();
  readonly currentPain = input.required<ProspectedBusinessPainItem | null>();
  readonly selectedTone = input.required<PitchToneKey>();
  readonly suggestedOfferText = input.required<string>();
  readonly pitchText = input.required<string>();
  readonly whatsappUrl = input.required<string>();
  readonly copiedPitch = input.required<boolean>();
  readonly contacts = input.required<ProspectContactLogItem[]>();

  readonly contactChannel = input.required<ContactChannel>();
  readonly contactOutcome = input.required<ContactOutcome>();
  readonly contactNotes = input.required<string>();
  readonly isSavingContact = input.required<boolean>();
  readonly feedbackMessage = input.required<string | null>();
  readonly contactError = input.required<string | null>();
  readonly isConfirmingBlacklist = input.required<boolean>();
  readonly isEnrichingDeep = input<boolean>(false);

  readonly painSelected = output<string>();
  readonly painDismissed = output<{ pain: ProspectedBusinessPainItem; event: MouseEvent }>();
  readonly pitchToneChanged = output<PitchToneKey>();
  readonly copyRequested = output<void>();
  readonly enrichRequested = output<void>();
  readonly channelChanged = output<ContactChannel>();
  readonly outcomeChanged = output<ContactOutcome>();
  readonly notesChanged = output<string>();
  readonly submitContactRequested = output<void>();
  readonly requestBlacklistConfirmation = output<void>();
  readonly confirmBlacklistRequested = output<void>();
  readonly cancelBlacklistRequested = output<void>();
  readonly closeRequested = output<void>();

  readonly channelOptions: ReadonlyArray<{ value: ContactChannel; label: string }> = [
    { value: 'WHATSAPP', label: 'WhatsApp' },
    { value: 'PHONE_CALL', label: 'Llamada' },
    { value: 'EMAIL', label: 'Correo' },
    { value: 'IN_PERSON', label: 'Visita' },
  ];

  readonly outcomeOptions: ReadonlyArray<{ value: ContactOutcome; label: string }> = [
    { value: 'CONNECTED_PITCHED', label: 'Propuesta enviada' },
    { value: 'GATEKEEPER_BLOCKED', label: 'Recado recepción' },
    { value: 'MEETING_SCHEDULED', label: 'Reunión agendada' },
    { value: 'EMAIL_SENT', label: 'Correo enviado' },
    { value: 'NO_ANSWER', label: 'Sin respuesta' },
    { value: 'NOT_INTERESTED', label: 'No interesado' },
  ];

  readonly isChain = computed(() => isChainLead(this.lead()));
  readonly inCooldown = computed(() => isLeadInCooldown(this.lead()));
  readonly cooldownDays = computed(() => getCooldownDaysLeft(this.lead()));
  readonly priceTier = computed(() => formatPriceTier(this.lead().priceLevel));
  readonly cleanPhone = computed(() => cleanPhoneDigits(this.lead().phone));
  readonly deepIntelligence = computed(() => this.lead().rawGoogleData?.deepIntelligence || null);

  readonly verifiedContacts = computed(() => {
    const lead = this.lead();
    if (lead.contacts && lead.contacts.length > 0) {
      return lead.contacts.map((c) => ({
        id: c.id,
        name: c.fullName,
        honorific: c.honorific,
        role: c.titleRole || 'Titular / Especialista',
        sourceUrl: c.sourceUrl,
      }));
    }
    const legacyMakers = lead.rawGoogleData?.deepIntelligence?.decisionMakers || [];
    return legacyMakers.map((m) => ({
      id: m.name,
      name: m.name,
      honorific: undefined,
      role: m.role || 'Titular / Especialista',
      sourceUrl: m.sourceUrl,
    }));
  });

  readonly activePitchToneLabel = computed(() => {
    switch (this.selectedTone()) {
      case 'GATEKEEPER':
        return 'Recepción / Gatekeeper';
      case 'ENTERPRISE':
        return 'Corporativo / Multi-Sede';
      default:
        return 'Dueño / Decisor';
    }
  });

  onDismissClick(pain: ProspectedBusinessPainItem, event: MouseEvent): void {
    event.stopPropagation();
    this.painDismissed.emit({ pain, event });
  }

  formatChannel(ch: ContactChannel): string {
    return formatChannelLabel(ch);
  }

  formatOutcome(out: ContactOutcome): string {
    return formatOutcomeLabel(out);
  }
}
