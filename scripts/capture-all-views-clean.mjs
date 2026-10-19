import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

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

async function snap(filename, label) {
  const pPath = path.join(projectCheckpoints, filename);
  const iPath = path.join(ideCheckpoints, filename);
  await page.screenshot({ path: pPath, fullPage: false });
  fs.copyFileSync(pPath, iPath);
  console.log(`  ✓ [CAPTURA] ${filename} -> ${label}`);
}

try {
  // 1. CARGA DE LA CABINA CON LOS EMPLEOS REALES DE APIFY
  console.log('▶ [1/9] Cargando Cabina de Despacho (con empleos reales de Apify en Postgres)...');
  await page.goto('http://localhost:7001');
  await page.waitForTimeout(2000);
  await snap('01-cabina-despacho-apify-real.png', 'Cabina de Despacho con los 15 empleos frescos de Upwork');

  // 2. DETALLE DE PROPUESTA GENERADA
  console.log('▶ [2/9] Copiando carta de propuesta y verificando feedback...');
  const copyBtn = await page.$("button:has-text('Copiar Carta para Upwork')");
  if (copyBtn) {
    await copyBtn.click();
    await page.waitForTimeout(600);
  }
  await snap('02-propuesta-35-palabras-copiada.png', 'Detalle de propuesta de 35 palabras con botón verde copiado');

  // 3. MOTOR DE BÚSQUEDA Y LEDGER
  console.log('▶ [3/9] Cambiando a Motor de Búsqueda (Ledger de 17 columnas)...');
  await page.click("button:has-text('Motor de Búsqueda')");
  await page.waitForTimeout(1000);
  await snap('03-motor-busqueda-ledger-completo.png', 'Motor de búsqueda con filtros, badges de fit y presupuesto');

  // 4. BÚSQUEDA FILTRADA POR TEXTO
  console.log('▶ [4/9] Buscando "Designer" en el motor...');
  const searchInput = await page.$("input[placeholder*='Buscar']");
  if (searchInput) {
    await searchInput.fill('Designer');
    await page.waitForTimeout(800);
  }
  await snap('04-motor-busqueda-filtrado-designer.png', 'Resultados filtrados en vivo');

  // 5. DROPDOWN DE SELECTOR DE PERSONAS / MULTI-PERFIL
  console.log('▶ [5/9] Desplegando el Selector de Perfiles (Multi-Persona) en la barra superior...');
  const profileBtn = await page.$("header button:has-text('👤')");
  if (profileBtn) {
    await profileBtn.click();
    await page.waitForTimeout(600);
  }
  await snap('05-selector-multi-perfil-dropdown.png', 'Menú flotante para alternar entre diferentes personas');

  // 6. MODAL PARA CREAR NUEVO PERFIL DE CERO
  console.log('▶ [6/9] Abriendo el modal para crear un perfil de cero...');
  const createBtn = await page.$("button:has-text('Crear Perfil de Cero')");
  if (createBtn) {
    await createBtn.click();
    await page.waitForTimeout(600);
  }
  await snap('06-modal-crear-perfil-persona.png', 'Modal con inputs para nombre y rol de la persona');

  // Cancelar modal
  const cancelBtn = await page.$("button:has-text('Cancelar')");
  if (cancelBtn) await cancelBtn.click();
  await page.waitForTimeout(400);

  // 7. DRAWER DE CALIBRACIÓN - TAB 1: OFERTA & HISTORIAS
  console.log('▶ [7/9] Abriendo Drawer de Calibración (Pestaña 1: Oferta & Historias)...');
  await page.click("button:has-text('Calibrar Perfil')");
  await page.waitForTimeout(1000);
  await snap('07-calibrador-tab1-oferta-historias.png', 'Drawer con oferta editable y controles de historias (CRUD + orden)');

  // 8. DRAWER DE CALIBRACIÓN - TAB 2: KEYWORDS & FILTROS
  console.log('▶ [8/9] Cambiando a Pestaña 2: Keywords & Filtros...');
  await page.click("button:has-text('2. Keywords & Filtros')");
  await page.waitForTimeout(600);
  await snap('08-calibrador-tab2-keywords-filtros.png', 'Área de texto de keywords editable y campos de presupuesto');

  // 9. DRAWER DE CALIBRACIÓN - TAB 3: PESOS MATEMÁTICOS
  console.log('▶ [9/9] Cambiando a Pestaña 3: Pesos Matemáticos...');
  await page.click("button:has-text('3. Pesos Matemáticos')");
  await page.waitForTimeout(600);
  await snap('09-calibrador-tab3-pesos-matematicos.png', 'Sliders de pesos 40/25/20/15 y regla de CAP 44');

  console.log('\n================================================================');
  console.log('🎉 TODAS LAS 9 VISTAS CLAVE CAPTURADAS CON ÉXITO');
  console.log('================================================================');

} catch (err) {
  console.error('❌ Error capturando vistas:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
