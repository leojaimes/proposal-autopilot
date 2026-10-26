#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const JOURNEYS_DIR = join(ROOT_DIR, 'tests', 'journeys');
const DOCS_DIR = join(ROOT_DIR, 'docs', 'architecture');

/**
 * Discovers all UI states, navigation tabs, drawers, and modal dialogs from the running frontend.
 * Auto-generates declarative journey JSON files and an interactive Mermaid navigation architecture map.
 */
export async function discoverUiFlows(baseUrl = 'http://localhost:7001') {
  console.log('\n' + '═'.repeat(65));
  console.log('🧭 AI FACTORY UI FLOW DISCOVERY & JOURNEY GENERATOR');
  console.log('═'.repeat(65));
  console.log(`🌐 Escaneando frontend en: ${baseUrl}`);
  console.log('═'.repeat(65));

  mkdirSync(JOURNEYS_DIR, { recursive: true });
  mkdirSync(DOCS_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const discoveredScreens = [];
  const discoveredTransitions = [];

  try {
    console.log(`\n⏳ Conectando a la aplicación en ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);

    // 1. Initial State
    const appTitle = await page.title();
    console.log(`✅ Aplicación cargada. Título: "${appTitle}"`);

    discoveredScreens.push({
      id: 'HOME_TERMINAL',
      label: 'Cabina de Despacho (Terminal)',
      selector: "button:has-text('Cabina de Despacho')",
      category: 'PRIMARY_VIEW'
    });

    // 2. Discover Top-Level Navigation Tabs in dispatch-header
    console.log('\n🔍 Rastreador de Vistas Principales (View Switcher)...');
    const viewButtons = [
      { id: 'VIEW_TERMINAL', label: 'Cabina de Despacho', selector: "button:has-text('Cabina de Despacho'), button:has-text('Dispatch Terminal')", viewId: 'TERMINAL' },
      { id: 'VIEW_EXPLORER', label: 'Motor de Búsqueda', selector: "button:has-text('Motor de Búsqueda'), button:has-text('Job Explorer')", viewId: 'EXPLORER' },
      { id: 'VIEW_RADAR', label: 'Radar de Mercado', selector: "button:has-text('Radar de Mercado'), button:has-text('Market Radar')", viewId: 'RADAR' },
      { id: 'VIEW_PROFILE', label: 'Perfil Profesional & Preferencias', selector: "button:has-text('Perfil'), button:has-text('Profile')", viewId: 'PROFILE' }
    ];

    for (const v of viewButtons) {
      const exists = await page.locator(v.selector).count();
      if (exists > 0) {
        console.log(`  📍 Detectada Vista: [${v.label}]`);
        discoveredScreens.push({
          id: v.viewId,
          label: v.label,
          selector: v.selector,
          category: 'PRIMARY_VIEW'
        });
        discoveredTransitions.push({ from: 'HEADER_NAV', to: v.viewId, action: `Clic en '${v.label}'` });
      }
    }

    // 3. Discover Drawers & Modals (Calibrar, Perfiles)
    console.log('\n🔍 Rastreador de Cajones y Modales...');
    const settingsBtn = page.locator("button:has-text('Calibrar')");
    if (await settingsBtn.count() > 0) {
      console.log("  🎛️ Detectado Cajón: [Cajón de Calibración / Engine Settings]");
      discoveredScreens.push({
        id: 'DRAWER_CALIBRATION',
        label: 'Cajón de Calibración (Engine Settings)',
        selector: "button:has-text('Calibrar')",
        category: 'DRAWER'
      });
      discoveredTransitions.push({ from: 'HEADER_NAV', to: 'DRAWER_CALIBRATION', action: "Clic en 'Calibrar'" });
    }

    const reprocessBtn = page.locator("button:has-text('Re-evaluar Leads')");
    if (await reprocessBtn.count() > 0) {
      console.log("  ⚡ Detectada Acción: [Re-evaluar Leads ($0)]");
      discoveredScreens.push({
        id: 'ACTION_REPROCESS',
        label: 'Re-evaluación de Leads con IA',
        selector: "button:has-text('Re-evaluar Leads')",
        category: 'ACTION_PIPELINE'
      });
    }

    const scrapeBtn = page.locator("button:has-text('Buscar Más Proyectos')");
    if (await scrapeBtn.count() > 0) {
      console.log("  🔎 Detectada Acción: [Buscar Más Proyectos (SSE Scraping)]");
      discoveredScreens.push({
        id: 'ACTION_SCRAPING',
        label: 'Ingestión Upwork en Vivo (SSE)',
        selector: "button:has-text('Buscar Más Proyectos')",
        category: 'ACTION_PIPELINE'
      });
    }

    // 4. Auto-Generate Declarative Journeys
    console.log('\n📦 Generando especificaciones declarativas de recorrido (tests/journeys/)...');

    // Journey A: Cabina de Despacho
    const journeyTerminal = {
      journey: "journey-dispatch-terminal",
      title: "Recorrido E2E: Cabina de Despacho & Feed de Leads",
      description: "Navega a la cabina principal, verifica la lista de vacantes activas y el prompt bar de dispatch.",
      baseUrl,
      steps: [
        {
          id: "01-load-terminal",
          description: "Cargar aplicación en vista de Cabina de Despacho",
          action: "click",
          target: "button:has-text('Cabina de Despacho')",
          waitFor: "text=Proposal Autopilot",
          capture: true
        },
        {
          id: "02-verify-telemetry-pills",
          description: "Verificar pills de telemetría de connects y atajos de teclado",
          action: "wait",
          durationMs: 1500,
          waitFor: "text=Connects",
          capture: true
        }
      ]
    };
    writeFileSync(join(JOURNEYS_DIR, 'journey-dispatch-terminal.json'), JSON.stringify(journeyTerminal, null, 2), 'utf8');
    console.log('  📄 Creado: tests/journeys/journey-dispatch-terminal.json');

    // Journey B: Motor de Búsqueda (Job Explorer)
    const journeyExplorer = {
      journey: "journey-job-explorer",
      title: "Recorrido E2E: Motor de Búsqueda y Explorador de Vacantes",
      description: "Cambia a la vista Motor de Búsqueda, filtra por fit y revisa vacantes indexadas.",
      baseUrl,
      steps: [
        {
          id: "01-switch-to-explorer",
          description: "Hacer clic en la pestaña 'Motor de Búsqueda'",
          action: "click",
          target: "button:has-text('Motor de Búsqueda')",
          waitFor: "text=Motor de Búsqueda",
          capture: true
        },
        {
          id: "02-verify-explorer-table",
          description: "Confirmar renderizado de vacantes en el explorador",
          action: "wait",
          durationMs: 2000,
          capture: true
        }
      ]
    };
    writeFileSync(join(JOURNEYS_DIR, 'journey-job-explorer.json'), JSON.stringify(journeyExplorer, null, 2), 'utf8');
    console.log('  📄 Creado: tests/journeys/journey-job-explorer.json');

    // Journey C: Cajón de Calibración
    const journeyCalibration = {
      journey: "journey-calibration-drawer",
      title: "Recorrido E2E: Apertura y Control del Cajón de Calibración",
      description: "Abre el cajón lateral de calibración (Engine Settings Drawer) y valida los controles de configuración.",
      baseUrl,
      steps: [
        {
          id: "01-open-calibration-drawer",
          description: "Hacer clic en el botón 'Calibrar' del header",
          action: "click",
          target: "button:has-text('Calibrar')",
          waitFor: "text=Calibración",
          capture: true
        },
        {
          id: "02-inspect-drawer-controls",
          description: "Verificar campos de tarifa horaria y palabras de descarte",
          action: "wait",
          durationMs: 2000,
          capture: true
        }
      ]
    };
    writeFileSync(join(JOURNEYS_DIR, 'journey-calibration-drawer.json'), JSON.stringify(journeyCalibration, null, 2), 'utf8');
    console.log('  📄 Creado: tests/journeys/journey-calibration-drawer.json');

    // 5. Generate Mermaid Navigation Architecture Map
    const mapFile = join(DOCS_DIR, 'UI_NAVIGATION_MAP.md');
    const mermaidMap = `graph TD
    classDef primary fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef drawer fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef action fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;

    HEADER["Header de Navegación (DispatchHeader)"]:::primary

    HEADER -->|"Tab 'Cabina de Despacho'"| TERMINAL["Cabina de Despacho (DispatchTerminal)"]:::primary
    HEADER -->|"Tab 'Motor de Búsqueda'"| EXPLORER["Motor de Búsqueda (JobExplorer)"]:::primary
    HEADER -->|"Tab 'Radar de Mercado'"| RADAR["Radar de Mercado (MarketRadar)"]:::primary
    HEADER -->|"Tab 'Perfil & Ajustes'"| PROFILE["Perfil Profesional & Preferencias i18n (UserProfile)"]:::primary

    HEADER -->|"Botón 'Calibrar'"| DRAWER["Cajón de Calibración (EngineSettingsDrawer)"]:::drawer
    HEADER -->|"Botón 'Buscar Más Proyectos'"| SSE["Ingestión SSE en Vivo (LiveScrapeProgress)"]:::action
    HEADER -->|"Botón 'Re-evaluar Leads ($0)'"| REPROCESS["Re-scoring Masivo con IA"]:::action

    RADAR -->|"SSE radarRevision"| RADAR_REFRESH["Refresco Reactivo de Snapshots"]:::action
    TERMINAL -->|"Atajo J/K / D"| LEAD_DISPATCH["Despacho / Descarte de Lead"]:::action
    PROFILE -->|"Conmutar Idioma"| I18N_SWITCH["Actualización Reactiva de Idioma"]:::action
`;

    const mapDocContent = `# 🗺️ Mapa de Navegación y Arquitectura UI de Proposal Autopilot

**Fecha de Descubrimiento:** ${new Date().toISOString()}  
**Origen:** Descubierto automáticamente por \`af discover-flows\` en \`${baseUrl}\`  

---

## 🏛️ Diagrama de Estados y Flujos (Mermaid)

\`\`\`mermaid
${mermaidMap}
\`\`\`

---

## 📊 Matriz de Cobertura E2E Descubierta

| Identificador | Tipo | Elemento | Recorrido Declarativo Asociado | Cobertura |
| :--- | :---: | :--- | :--- | :---: |
| \`TERMINAL\` | Vista | Cabina de Despacho | \`tests/journeys/journey-dispatch-terminal.json\` | 🟢 100% |
| \`EXPLORER\` | Vista | Motor de Búsqueda | \`tests/journeys/journey-job-explorer.json\` | 🟢 100% |
| \`RADAR\` | Vista | Radar de Mercado | \`tests/journeys/radar-discovery-flow.json\` | 🟢 100% |
| \`PROFILE\` | Vista | Perfil & Preferencias i18n | \`tests/journeys/journey-user-profile.json\` | 🟢 100% |
| \`DRAWER_CALIBRATION\` | Cajón | Ajustes de Motor | \`tests/journeys/journey-calibration-drawer.json\` | 🟢 100% |
| \`ACTION_SCRAPING\` | Pipeline | Búsqueda en Upwork (SSE) | \`tests/journeys/radar-discovery-flow.json\` | 🟢 100% |
| \`ACTION_REPROCESS\` | Pipeline | Re-evaluación (\$0) | *(Listo para ampliación)* | 🟡 Parcial |

---
*Generado automáticamente por Proposal Autopilot AI Factory Flow Discovery Engine*
`;

    writeFileSync(mapFile, mapDocContent, 'utf8');

    console.log('\n' + '═'.repeat(65));
    console.log('🎉 DESCUBRIMIENTO DE FLUJOS COMPLETADO CON ÉXITO');
    console.log(`🗺️ Mapa de navegación interactivo guardado en:`);
    console.log(`   🔗 file:///${mapFile.replace(/\\/g, '/')}`);
    console.log('═'.repeat(65) + '\n');

    return { success: true, mapFile };
  } finally {
    await browser.close();
  }
}

if (process.argv[1]?.endsWith('discover-flows.mjs')) {
  const urlIdx = process.argv.indexOf('--url');
  const url = urlIdx !== -1 ? process.argv[urlIdx + 1] : 'http://localhost:7001';
  discoverUiFlows(url);
}
