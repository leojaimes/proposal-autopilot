import {
  CompanyPainCategory,
  ContactChannel,
  ContactOutcome,
  ProspectedBusiness,
} from '../../../core/services/prospecting.service';

export type DockViewMode = 'PEEK' | 'SPLIT' | 'MAXIMIZED';

export interface CountryOption {
  countryCode: string;
  countryName: string;
  label: string;
}

export interface CityOption {
  id: string;
  name: string;
  state: string;
  countryName: string;
  countryCode: string;
  lat: number;
  lng: number;
  zoom: number;
  isTactical: boolean;
  category?: string;
  polygonCoordinates?: [number, number][];
}

export interface TacticalPolygonOption {
  slug: string;
  name: string;
  state: string;
  countryName: string;
  countryCode: string;
  category: string;
  polygon: [number, number][];
}

export function isChainLead(lead: ProspectedBusiness): boolean {
  return lead.ownershipType === 'CHAIN_BRANCH' || lead.ownershipType === 'CORPORATE_HQ';
}

export function isLeadInCooldown(lead: ProspectedBusiness): boolean {
  if (!lead.contactCooldownUntil) return false;
  return new Date(lead.contactCooldownUntil).getTime() > Date.now();
}

export function getCooldownDaysLeft(lead: ProspectedBusiness): number {
  if (!lead.contactCooldownUntil) return 0;
  const diffMs = new Date(lead.contactCooldownUntil).getTime() - Date.now();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function formatPriceTier(priceLevel?: number | null): string {
  if (!priceLevel || priceLevel < 1) return '';
  return '(' + '$'.repeat(Math.min(4, priceLevel)) + ')';
}

export function cleanPhoneDigits(phone?: string | null): string {
  return (phone || '').replace(/\D/g, '');
}

export function normalizeGeoText(text?: string | null): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function formatPainTitle(pain?: CompanyPainCategory | null): string {
  switch (pain) {
    case 'WEBSITE_DOWN_OR_EXPIRED':
      return 'Web Caída / Expirada';
    case 'NO_WEBSITE':
      return 'Sin Sitio Web';
    case 'NO_ONLINE_BOOKING':
      return 'Sin Agenda Online';
    case 'UNRESPONSIVE_CUSTOMER_SERVICE':
      return 'Atención Desatendida';
    case 'MANUAL_INVENTORY_OR_CATALOG':
      return 'Cotización Manual';
    case 'LACK_OF_ECOMMERCE':
      return 'Sin Tienda Online';
    case 'GENERAL_REPUTATION_ISSUE':
      return 'Fricción Post-Venta';
    case 'OUTDATED_OR_SLOW_WEB':
      return 'Web Lenta / Antigua';
    default:
      return 'Oportunidad B2B';
  }
}

export function getPainBadgeClass(pain?: CompanyPainCategory | null): string {
  switch (pain) {
    case 'WEBSITE_DOWN_OR_EXPIRED':
      return 'bg-badge-low-bg text-badge-low-text border-rose-500/40';
    case 'NO_WEBSITE':
      return 'bg-badge-low-bg text-badge-low-text border-rose-500/30';
    case 'NO_ONLINE_BOOKING':
      return 'bg-badge-med-bg text-badge-med-text border-amber-500/30';
    case 'UNRESPONSIVE_CUSTOMER_SERVICE':
      return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
    case 'MANUAL_INVENTORY_OR_CATALOG':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
    case 'LACK_OF_ECOMMERCE':
      return 'bg-badge-high-bg text-badge-high-text border-emerald-500/30';
    default:
      return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  }
}

export function getPainDotClass(pain?: CompanyPainCategory | null): string {
  switch (pain) {
    case 'WEBSITE_DOWN_OR_EXPIRED':
      return 'bg-rose-400 animate-pulse';
    case 'NO_WEBSITE':
      return 'bg-rose-400';
    case 'NO_ONLINE_BOOKING':
      return 'bg-amber-400';
    case 'UNRESPONSIVE_CUSTOMER_SERVICE':
      return 'bg-violet-400';
    case 'MANUAL_INVENTORY_OR_CATALOG':
      return 'bg-sky-400';
    case 'LACK_OF_ECOMMERCE':
      return 'bg-emerald-400';
    default:
      return 'bg-cyan-400';
  }
}

export function getPinModifierClass(pain?: CompanyPainCategory | null): string {
  switch (pain) {
    case 'WEBSITE_DOWN_OR_EXPIRED':
      return 'geo-lead-pin--critical';
    case 'NO_WEBSITE':
      return 'geo-lead-pin--rose';
    case 'NO_ONLINE_BOOKING':
      return 'geo-lead-pin--amber';
    case 'UNRESPONSIVE_CUSTOMER_SERVICE':
      return 'geo-lead-pin--violet';
    case 'LACK_OF_ECOMMERCE':
      return 'geo-lead-pin--emerald';
    default:
      return 'geo-lead-pin--cyan';
  }
}

export function formatChannelLabel(channel: ContactChannel): string {
  switch (channel) {
    case 'WHATSAPP':
      return 'WhatsApp';
    case 'PHONE_CALL':
      return 'Llamada';
    case 'EMAIL':
      return 'Correo';
    case 'LINKEDIN':
      return 'LinkedIn';
    case 'IN_PERSON':
      return 'Visita';
    default:
      return channel;
  }
}

export function formatOutcomeLabel(outcome: ContactOutcome): string {
  switch (outcome) {
    case 'CONNECTED_PITCHED':
      return 'Propuesta enviada';
    case 'GATEKEEPER_BLOCKED':
      return 'Recado en recepción';
    case 'MEETING_SCHEDULED':
      return 'Reunión agendada';
    case 'EMAIL_SENT':
      return 'Correo enviado';
    case 'VOICEMAIL':
      return 'Buzón de voz';
    case 'NO_ANSWER':
      return 'Sin respuesta';
    case 'NOT_INTERESTED':
      return 'No interesado';
    case 'CLOSED_WON':
      return 'Venta cerrada';
    case 'OPT_OUT_BLACKLIST':
      return 'No contactar';
    default:
      return outcome;
  }
}
