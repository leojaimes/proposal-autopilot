import { Injectable, signal, computed } from '@angular/core';

export type SupportedLanguage = 'es' | 'en';
export type LanguageMode = 'auto' | 'manual';

export interface Translations {
  [key: string]: string;
}

export const ES_TRANSLATIONS: Translations = {
  // Navigation & Views
  'nav.terminal': 'Cabina de Despacho',
  'nav.explorer': 'Motor de Búsqueda',
  'nav.radar': 'Radar de Mercado',
  'nav.profile': 'Perfil & Ajustes',
  'nav.calibrate': 'Calibrar',
  'nav.scrape': 'Buscar Más Proyectos',
  'nav.scraping_active': 'Buscando en Upwork...',
  'nav.reprocess': 'Re-evaluar Leads ($0)',
  'nav.reprocessing_active': 'Re-evaluando...',
  
  // Profile
  'profile.title': 'Perfil Profesional & Preferencias',
  'profile.subtitle': 'Configuración de posicionamiento ICP, idioma del explorador e identidad',
  'profile.identity': 'Identidad Profesional',
  'profile.language_settings': 'Idioma & Regionalización',
  'profile.language_subtitle': 'Ajuste de idioma del explorador e interfaz',
  'profile.detected_system': 'Detectado del Explorador / SO',
  'profile.detection_explainer': 'La cabina detecta el idioma configurado en tu sistema operativo y navegador web para auto-calibrar la interfaz sin fricción.',
  'profile.preference_label': 'Preferencia de Visualización',
  'profile.mode_auto': 'Automático (Detectar del Explorador / SO)',
  'profile.auto_resolves_to': 'Auto-resuelve a:',
  'profile.mode_manual_es': 'Español (Latinoamérica / España)',
  'profile.mode_manual_es_desc': 'Español nativo para toda la cabina y herramientas',
  'profile.mode_manual_en': 'English (United States / Global)',
  'profile.mode_manual_en_desc': 'Interfaz en inglés para operaciones globales',
  'profile.live_preview_label': 'Vista previa inmediata de etiquetas:',
  'profile.save_success': 'Preferencias guardadas exitosamente',
  'profile.active_persona': 'Persona Activa',
  'profile.offer_headline': 'Oferta Específica',
  'profile.offer_subtitle': 'Propuesta de valor inyectada en propuestas Upwork',
  'profile.no_offer': 'Sin oferta configurada. Abre el cajón de calibración para definir tu oferta específica.',
  'profile.min_rate': 'Tarifa Mínima',
  'profile.min_budget': 'Presupuesto Fijo',
  'profile.target_audience': 'Audiencia Objetivo',
  'profile.proof_stories': 'Historias de Autoridad Calibradas',
  'profile.proof_subtitle': 'Casos de éxito verificados para scoring de autoridad',
  'profile.proof_active': 'activas',
  'profile.counters_icp': 'Perfiles ICP',
  'profile.counters_proof': 'Proof Stories',
  'profile.counters_lang': 'Idioma Activo',

  // Job Explorer
  'explorer.title': 'Motor de Búsqueda & Explorador Completo',
  'explorer.subtitle': 'Cuadrícula analítica interactiva estilo Excel con ordenamiento, multi-selección de valores y reglas numéricas por columna.',
  'explorer.col.score': 'Score',
  'explorer.col.title': 'Título & Rol Estratégico',
  'explorer.col.budget': 'Presupuesto',
  'explorer.col.country': 'País del Cliente',
  'explorer.col.rating': 'Rating Cliente',
  'explorer.col.spent': 'Gasto Total',
  'explorer.col.bids': 'Bids',
  'explorer.col.story': 'Historia Inyectada',
  'explorer.col.status': 'Estado',
  'explorer.col.posted': 'Publicado',
  'explorer.col.actions': 'Acciones',
  'explorer.empty': 'No se encontraron empleos que coincidan con la combinación de filtros de Excel aplicada.',
  'explorer.copy_letter': 'Copiar Carta',
  'explorer.copied': '¡Copiado!',

  // Market Radar
  'radar.title': 'Radar de Mercado & Oportunidades Upwork',
  'radar.subtitle': 'Monitoreo en tiempo real de categorías, densidad de competencia y demanda',
  'radar.rank': 'Ranking',
  'radar.category': 'Categoría de Mercado',
  'radar.demand': 'Demanda 7d',
  'radar.competition': 'Bids Medios',
  'radar.budget': 'Presupuesto Medio',
  'radar.verified_clients': 'Clientes Verificados',
  'radar.ai_leverage': 'Apalancamiento IA',
  'radar.status': 'Estado',
  'radar.refresh': 'Actualizar Radar',
  'radar.live': 'En Vivo',

  // Workbench
  'workbench.title': 'Taller de Postulación 1:1 & Ingesta Universal',
  'workbench.subtitle': 'Analiza cualquier vacante por URL o texto crudo, diagnostica el fit y adapta tu CV ATS y propuesta con edición humana.',

  // Engine Settings Drawer
  'drawer.title': 'Calibración de Motor de Posicionamiento',
  'drawer.tab_positioning': '1. Oferta & Historias',
  'drawer.tab_roles': '2. Roles & Taxonomía',
  'drawer.tab_scraping': '3. Keywords & Filtros',
  'drawer.tab_geo': '4. Regiones & Países',
  'drawer.tab_weights': '5. Pesos Matemáticos',
  'drawer.hourly_rate': 'Tarifa Horaria Mínima ($/hr)',
  'drawer.fixed_budget': 'Presupuesto Fijo Mínimo ($)',
  'drawer.close': 'Cerrar',
  'drawer.save': 'Guardar Calibración',

  // Dispatch Terminal
  'terminal.search_placeholder': 'Buscar por título, país, skill o rol...',
  'terminal.tier_high': 'High',
  'terminal.tier_all': 'Todos',
  'terminal.tier_capped': 'Capped',
  'terminal.queue_title': 'Cola de Despacho',
  'terminal.shortcuts': 'Atajos:',
  'terminal.scraping_leads': 'Buscando vacantes en Upwork...',
  'terminal.updating_leads': 'Actualizando lote en segundo plano...',
  'terminal.status_approved': 'Aprobado',
  'terminal.status_skipped': 'Descartado',
  'terminal.empty_title': 'No se encontraron leads',
  'terminal.empty_desc': 'Prueba ajustando los filtros o el término de búsqueda.',
  'terminal.engine_savings': 'Ahorro Motor:',
  'terminal.verified_payment': 'Pago Verificado',
  'terminal.view_upwork': 'Ver en Upwork',
  'terminal.first_bidder': 'Primer Postor',
  'terminal.proposals_active': 'propuestas activas',
  'terminal.diagnostic_title': 'Diagnóstico Algorítmico Cuantitativo:',
  'terminal.authority_case': 'Caso Autoridad:',
  'terminal.golden_match_title': 'Oportunidad Golden Match — Despacho Inmediato Recomendado',
  'terminal.high_priority': 'Prioridad Alta',
  'terminal.draft_proposal_now': 'Redactar Propuesta Ahora [G]',
  'terminal.qualified_title': 'Oportunidad Calificada — Revisión Recomendada',
  'terminal.force_ai': 'Forzar con IA',
  'terminal.safety_ceiling_title': '⚠️ Lead de Riesgo o Fuera de Nicho — Gasto de Connects No Recomendado',
  'terminal.safety_ceiling_badge': 'Techo de Seguridad',
  'terminal.discard_lead': 'Descartar Lead',
  'terminal.decision_audit_title': 'Auditoría Decisional del Algoritmo',
  'terminal.safety_activated': 'Techo de Seguridad Activado',
  'terminal.unrestricted_score': 'Puntuación Sin Restricciones',
  'terminal.drivers_title': 'Ventajas Competitivas (Drivers)',
  'terminal.drivers_identified': 'IDENTIFICADOS',
  'terminal.no_drivers': 'Sin ventajas competitivas diferenciales detectadas para este lead.',
  'terminal.drags_title': 'Factores de Fricción (Drags - Riesgo)',
  'terminal.drags_detected': 'DETECTADOS',
  'terminal.no_drags': 'Ningún factor de fricción registrado: cliente solvente, rol compatible y pago verificado.',
  'terminal.proposal_optimized': 'Propuesta Optimizada',
  'terminal.copy_letter': 'Copiar Carta para Upwork',
  'terminal.copied': '¡Copiado al Portapapeles!',
  'terminal.regenerate': 'Regenerar con IA',
  'terminal.synthesizing': 'Sintetizando...',
  'terminal.download_pdf': 'Descargar PDF',
  'terminal.generating_pdf': 'Generando PDF...',
  'terminal.view_proposal': 'Ver Propuesta Técnica',
  'terminal.hide_proposal': 'Ocultar Propuesta',
  'terminal.open_upwork': 'Abrir en Upwork',
  'terminal.discard': 'Descartar',
  'terminal.estimated_cost': 'Costo estimado:',
  'terminal.synthesis_time': 'Tiempo de síntesis:',
  'terminal.waste_protection': 'Protección anti-desperdicio activa',
  'terminal.ondemand_title': 'Propuesta Bajo Demanda Lista para Redacción',
  'terminal.ondemand_desc': 'Genera al instante la propuesta personalizada de 30-35 palabras, el roadmap ejecutivo y el diagrama Mermaid con Google Gemini para este cliente.',
  'terminal.generate_proposal': 'Generar Propuesta con Gemini',
  'terminal.generating_with_gemini': 'Redactando con Gemini (~1.5s)...',
  'terminal.select_lead_title': 'Selecciona un lead de la lista',
  'terminal.select_lead_desc': 'Haz clic en cualquier vacante del panel izquierdo o navega con las teclas J / K.',
  'terminal.gateway_synced': 'Sincronizado',
};

export const EN_TRANSLATIONS: Translations = {
  // Navigation & Views
  'nav.terminal': 'Dispatch Terminal',
  'nav.explorer': 'Job Explorer',
  'nav.radar': 'Market Radar',
  'nav.profile': 'Profile & Settings',
  'nav.calibrate': 'Calibrate',
  'nav.scrape': 'Find More Projects',
  'nav.scraping_active': 'Searching Upwork...',
  'nav.reprocess': 'Re-evaluate Leads ($0)',
  'nav.reprocessing_active': 'Re-evaluating...',
  
  // Profile
  'profile.title': 'Professional Profile & Preferences',
  'profile.subtitle': 'ICP positioning setup, browser language, and identity',
  'profile.identity': 'Professional Identity',
  'profile.language_settings': 'Language & Localization',
  'profile.language_subtitle': 'Browser & cockpit language adjustment',
  'profile.detected_system': 'Detected from Browser / OS',
  'profile.detection_explainer': 'The cockpit detects the language configured in your operating system and web browser to auto-calibrate the interface seamlessly.',
  'profile.preference_label': 'Display Preference',
  'profile.mode_auto': 'Automatic (Detect from Browser / OS)',
  'profile.auto_resolves_to': 'Auto-resolves to:',
  'profile.mode_manual_es': 'Español (Latin America / Spain)',
  'profile.mode_manual_es_desc': 'Native Spanish for cockpit and all tools',
  'profile.mode_manual_en': 'English (United States / Global)',
  'profile.mode_manual_en_desc': 'English interface for global operations',
  'profile.live_preview_label': 'Live label preview:',
  'profile.save_success': 'Preferences saved successfully',
  'profile.active_persona': 'Active Persona',
  'profile.offer_headline': 'Specific Offer',
  'profile.offer_subtitle': 'Value proposition injected into Upwork proposals',
  'profile.no_offer': 'No offer configured. Open the engine calibration drawer to define your specific offer.',
  'profile.min_rate': 'Minimum Rate',
  'profile.min_budget': 'Fixed Budget',
  'profile.target_audience': 'Target Audience',
  'profile.proof_stories': 'Calibrated Proof Stories',
  'profile.proof_subtitle': 'Verified success cases for authority scoring',
  'profile.proof_active': 'active',
  'profile.counters_icp': 'ICP Profiles',
  'profile.counters_proof': 'Proof Stories',
  'profile.counters_lang': 'Active Language',

  // Job Explorer
  'explorer.title': 'Job Explorer & Complete Analytical Ledger',
  'explorer.subtitle': 'Interactive Excel-style analytical grid with sorting, multi-value filters, and numeric rules per column.',
  'explorer.col.score': 'Score',
  'explorer.col.title': 'Job Title & Strategic Role',
  'explorer.col.budget': 'Budget',
  'explorer.col.country': 'Client Country',
  'explorer.col.rating': 'Client Rating',
  'explorer.col.spent': 'Total Spent',
  'explorer.col.bids': 'Bids',
  'explorer.col.story': 'Injected Story',
  'explorer.col.status': 'Status',
  'explorer.col.posted': 'Posted',
  'explorer.col.actions': 'Actions',
  'explorer.empty': 'No jobs found matching the applied Excel filter combination.',
  'explorer.copy_letter': 'Copy Cover Letter',
  'explorer.copied': 'Copied!',

  // Market Radar
  'radar.title': 'Market Radar & Upwork Opportunities',
  'radar.subtitle': 'Real-time monitoring of categories, competition density, and market demand',
  'radar.rank': 'Ranking',
  'radar.category': 'Market Category',
  'radar.demand': '7d Demand',
  'radar.competition': 'Median Bids',
  'radar.budget': 'Median Budget',
  'radar.verified_clients': 'Verified Clients',
  'radar.ai_leverage': 'AI Leverage',
  'radar.status': 'Status',
  'radar.refresh': 'Refresh Radar',
  'radar.live': 'Live',

  // Engine Settings Drawer
  'drawer.title': 'Positioning Engine Calibration',
  'drawer.tab_positioning': '1. Offer & Stories',
  'drawer.tab_roles': '2. Roles & Taxonomy',
  'drawer.tab_scraping': '3. Keywords & Filters',
  'drawer.tab_geo': '4. Regions & Countries',
  'drawer.tab_weights': '5. Mathematical Weights',
  'drawer.hourly_rate': 'Minimum Hourly Rate ($/hr)',
  'drawer.fixed_budget': 'Minimum Fixed Budget ($)',
  'drawer.close': 'Close',
  'drawer.save': 'Save Calibration',

  // Dispatch Terminal
  'terminal.search_placeholder': 'Search by title, country, skill or role...',
  'terminal.tier_high': 'High',
  'terminal.tier_all': 'All',
  'terminal.tier_capped': 'Capped',
  'terminal.queue_title': 'Dispatch Queue',
  'terminal.shortcuts': 'Shortcuts:',
  'terminal.scraping_leads': 'Searching jobs on Upwork...',
  'terminal.updating_leads': 'Updating batch in background...',
  'terminal.status_approved': 'Approved',
  'terminal.status_skipped': 'Skipped',
  'terminal.empty_title': 'No leads found',
  'terminal.empty_desc': 'Try adjusting your filters or search terms.',
  'terminal.engine_savings': 'Engine Savings:',
  'terminal.verified_payment': 'Payment Verified',
  'terminal.view_upwork': 'View on Upwork',
  'terminal.first_bidder': 'First Bidder',
  'terminal.proposals_active': 'active proposals',
  'terminal.diagnostic_title': 'Quantitative Algorithmic Diagnostic:',
  'terminal.authority_case': 'Authority Case:',
  'terminal.golden_match_title': 'Golden Match Opportunity — Immediate Dispatch Recommended',
  'terminal.high_priority': 'High Priority',
  'terminal.draft_proposal_now': 'Draft Proposal Now [G]',
  'terminal.qualified_title': 'Qualified Opportunity — Review Recommended',
  'terminal.force_ai': 'Force with AI',
  'terminal.safety_ceiling_title': '⚠️ High Risk or Out of Niche Lead — Connects Spend Not Recommended',
  'terminal.safety_ceiling_badge': 'Safety Ceiling',
  'terminal.discard_lead': 'Discard Lead',
  'terminal.decision_audit_title': 'Algorithmic Decision Audit',
  'terminal.safety_activated': 'Safety Ceiling Activated',
  'terminal.unrestricted_score': 'Unrestricted Scoring',
  'terminal.drivers_title': 'Competitive Advantages (Drivers)',
  'terminal.drivers_identified': 'IDENTIFIED',
  'terminal.no_drivers': 'No differential competitive advantages detected for this lead.',
  'terminal.drags_title': 'Friction Factors (Drags - Risk)',
  'terminal.drags_detected': 'DETECTED',
  'terminal.no_drags': 'No friction factors recorded: solvent client, compatible role, and verified payment.',
  'terminal.proposal_optimized': 'Optimized Proposal',
  'terminal.copy_letter': 'Copy Cover Letter for Upwork',
  'terminal.copied': 'Copied to Clipboard!',
  'terminal.regenerate': 'Regenerate with AI',
  'terminal.synthesizing': 'Synthesizing...',
  'terminal.download_pdf': 'Download PDF',
  'terminal.generating_pdf': 'Generating PDF...',
  'terminal.view_proposal': 'View Technical Proposal',
  'terminal.hide_proposal': 'Hide Proposal',
  'terminal.open_upwork': 'Open on Upwork',
  'terminal.discard': 'Discard',
  'terminal.estimated_cost': 'Estimated cost:',
  'terminal.synthesis_time': 'Synthesis time:',
  'terminal.waste_protection': 'Anti-waste protection active',
  'terminal.ondemand_title': 'On-Demand Proposal Ready to Draft',
  'terminal.ondemand_desc': 'Instantly generate the tailored 30-35 word proposal, executive roadmap, and Mermaid diagram with Google Gemini for this client.',
  'terminal.generate_proposal': 'Generate Proposal with Gemini',
  'terminal.generating_with_gemini': 'Drafting with Gemini (~1.5s)...',
  'terminal.select_lead_title': 'Select a lead from the list',
  'terminal.select_lead_desc': 'Click on any job in the left queue or navigate using J / K.',
  'terminal.gateway_synced': 'Synchronized',
};

const STORAGE_LANG_KEY = 'pa_selected_lang';
const STORAGE_MODE_KEY = 'pa_lang_mode';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly defaultLang: SupportedLanguage = 'en';

  public readonly systemLocale = signal<string>(this.detectBrowserLocale());
  public readonly languageMode = signal<LanguageMode>(this.getStoredMode());
  public readonly currentLang = signal<SupportedLanguage>(this.resolveInitialLanguage());

  public readonly isAuto = computed(() => this.languageMode() === 'auto');

  public readonly translations = computed<Translations>(() => {
    return this.currentLang() === 'es' ? ES_TRANSLATIONS : EN_TRANSLATIONS;
  });

  private detectBrowserLocale(): string {
    if (typeof window !== 'undefined' && window.navigator) {
      return (window.navigator.languages && window.navigator.languages[0]) || window.navigator.language || 'en';
    }
    return 'en';
  }

  public detectSystemLanguage(): SupportedLanguage {
    const locale = this.detectBrowserLocale().toLowerCase();
    return locale.startsWith('es') ? 'es' : 'en';
  }

  private getStoredMode(): LanguageMode {
    if (typeof localStorage !== 'undefined') {
      const mode = localStorage.getItem(STORAGE_MODE_KEY);
      if (mode === 'manual' || mode === 'auto') return mode;
    }
    return 'auto';
  }

  private resolveInitialLanguage(): SupportedLanguage {
    const mode = this.getStoredMode();
    if (mode === 'manual' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_LANG_KEY) as SupportedLanguage;
      if (stored === 'es' || stored === 'en') return stored;
    }
    return this.detectSystemLanguage();
  }

  public setLanguage(lang: SupportedLanguage): void {
    this.languageMode.set('manual');
    this.currentLang.set(lang);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_MODE_KEY, 'manual');
      localStorage.setItem(STORAGE_LANG_KEY, lang);
    }
  }

  public setAutoDetect(): void {
    this.languageMode.set('auto');
    const detected = this.detectSystemLanguage();
    this.currentLang.set(detected);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_MODE_KEY, 'auto');
      localStorage.removeItem(STORAGE_LANG_KEY);
    }
  }

  public t(key: string, fallback?: string): string {
    const dict = this.translations();
    return dict[key] || fallback || key;
  }
}
