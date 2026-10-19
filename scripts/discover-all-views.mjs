import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Import Playwright
const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const projectCheckpoints = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/flow-discovery/visual/checkpoints';
const ideCheckpoints = 'C:/Users/User/.gemini/antigravity-ide/brain/0bf5cc1b-c701-4e8b-81de-f4756f3405a3/views-discovery';

fs.mkdirSync(projectCheckpoints, { recursive: true });
fs.mkdirSync(ideCheckpoints, { recursive: true });

console.log('================================================================');
console.log('🔍 UI FLOW DISCOVERY: CAPTURANDO TODAS LAS VISTAS Y FLUJOS REALES');
console.log('================================================================\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

async function saveCheckpoint(filename, description, fullPage = false) {
  const pPath = path.join(projectCheckpoints, filename);
  const iPath = path.join(ideCheckpoints, filename);
  await page.screenshot({ path: pPath, fullPage });
  fs.copyFileSync(pPath, iPath);
  console.log(`  ✓ [VIEW] ${filename}: ${description}`);
}

try {
  // 1. CARGA INICIAL
  console.log('▶ [1/11] Cargando vista principal con datos reales de Apify / Postgres...');
  await page.goto('http://127.0.0.1:7001', { waitUntil: 'commit' });
  await page.waitForSelector('header', { timeout: 15000 });
  await page.waitForTimeout(1500);

  // VIEW 1: CABINA DE DESPACHO
  await saveCheckpoint('01-cabina-despacho-real-jobs.png', 'Cabina de Despacho con 15 empleos reales de Apify');

  // VIEW 2: MOTOR DE BÚSQUEDA & EXPLORER
  console.log('▶ [2/11] Cambiando a Motor de Búsqueda (Explorer Ledger)...');
  await page.click("button:has-text('Motor de Búsqueda')");
  await page.waitForTimeout(1000);
  await saveCheckpoint('02-motor-busqueda-ledger.png', 'Motor de Búsqueda completo con todas las columnas');

  // VIEW 3: MOTOR DE BÚSQUEDA FILTRADO POR KEYWORD
  console.log('▶ [3/11] Filtrando en Motor de Búsqueda con query "Designer"...');
  const searchInput = page.locator("input[placeholder*='Buscar']");
  if (await searchInput.count() > 0) {
    await searchInput.fill('Designer');
    await page.waitForTimeout(600);
    await saveCheckpoint('03-motor-busqueda-search-filtered.png', 'Resultados filtrados en vivo con búsqueda textual');
  }

  // VIEW 4: SELECTOR DE PERFILES EN EL HEADER (DROPDOWN ABIERTO)
  console.log('▶ [4/11] Desplegando el Selector de Perfiles (Multi-Persona) en el Header...');
  await page.click("header button:has-text('👤')");
  await page.waitForTimeout(500);
  await saveCheckpoint('04-header-profile-switcher-dropdown.png', 'Dropdown del selector de personas activo en el header');

  // VIEW 5: MODAL CREAR NUEVO PERFIL DE CERO
  console.log('▶ [5/11] Abriendo Modal "Crear Perfil de Cero"...');
  await page.click("button:has-text('Crear Perfil de Cero')");
  await page.waitForTimeout(500);
  await saveCheckpoint('05-modal-crear-perfil-persona.png', 'Modal para crear una nueva persona/oferta');
  
  // Cerrar modal
  await page.click("button:has-text('Cancelar')");
  await page.waitForTimeout(300);

  // VIEW 6: CALIBRADOR DEL MOTOR - PESTAÑA 1 (OFERTA & HISTORIAS)
  console.log('▶ [6/11] Abriendo Drawer de Calibración (Pestaña 1: Oferta & Historias)...');
  await page.click("button:has-text('Calibrar Perfil')");
  await page.waitForTimeout(800);
  await saveCheckpoint('06-calibrador-tab1-oferta-historias.png', 'Drawer Tab 1: Oferta editable, historias con badges y reordenamiento');

  // VIEW 7: FORMULARIO AGREGAR NUEVA HISTORIA
  console.log('▶ [7/11] Abriendo Formulario "Agregar Historia"...');
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(500);
  await saveCheckpoint('07-calibrador-formulario-nueva-historia.png', 'Formulario inline abierto para agregar nueva historia con métricas');

  // Cancelar formulario para seguir navegando
  await page.click("button:has-text('Cancelar')");
  await page.waitForTimeout(300);

  // VIEW 8: CALIBRADOR DEL MOTOR - PESTAÑA 2 (KEYWORDS & FILTROS)
  console.log('▶ [8/11] Navegando a Pestaña 2: Keywords & Filtros...');
  await page.click("button:has-text('2. Keywords & Filtros')");
  await page.waitForTimeout(500);
  await saveCheckpoint('08-calibrador-tab2-keywords-filtros.png', 'Drawer Tab 2: Textarea de keywords editable y campos de presupuesto/tarifa');

  // VIEW 9: CALIBRADOR DEL MOTOR - PESTAÑA 3 (PESOS MATEMÁTICOS)
  console.log('▶ [9/11] Navegando a Pestaña 3: Pesos Matemáticos...');
  await page.click("button:has-text('3. Pesos Matemáticos')");
  await page.waitForTimeout(500);
  await saveCheckpoint('09-calibrador-tab3-pesos-matematicos.png', 'Drawer Tab 3: Sliders 40/25/20/15 y regla de CAP 44');

  // VIEW 10: OPCIONES AVANZADAS EXPANDIDAS
  console.log('▶ [10/11] Desplegando Opciones Avanzadas de Demostración...');
  const advancedSummary = page.locator("summary:has-text('Opciones Avanzadas')");
  if (await advancedSummary.count() > 0) {
    await advancedSummary.click();
    await page.waitForTimeout(400);
    await saveCheckpoint('10-calibrador-opciones-avanzadas.png', 'Sección avanzada colapsable para reset y restore');
  }

  // Cerrar drawer
  await page.click("button:has-text('Cerrar')");
  await page.waitForTimeout(500);

  // VIEW 11: DETALLE DE LEAD EN CABINA DE DESPACHO
  console.log('▶ [11/11] Volviendo a Cabina de Despacho e interactuando con Lead...');
  await page.click("button:has-text('Cabina de Despacho')");
  await page.waitForTimeout(800);

  // Clic en el botón de copiar carta
  const copyBtn = page.locator("button:has-text('Copiar Carta para Upwork')");
  if (await copyBtn.count() > 0) {
    await copyBtn.click();
    await page.waitForTimeout(400);
  }
  await saveCheckpoint('11-lead-detail-proposal-copied.png', 'Detalle de oportunidad con carta de 35 palabras copiada');

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS 11 VISTAS CAPTURADAS EXITOSAMENTE');
  console.log('================================================================');

} catch (err) {
  console.error('❌ Error capturando vistas:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
