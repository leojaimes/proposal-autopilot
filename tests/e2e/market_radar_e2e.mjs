import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Import Playwright
const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const checkpointsDir = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/market-radar-e2e/visual/checkpoints';
fs.mkdirSync(checkpointsDir, { recursive: true });

console.log('========================================================================');
console.log('🚀 SANDBOX QA E2E: VERIFICACIÓN DEL RADAR DE MERCADO & PROCEDENCIA');
console.log('   Target: http://localhost:7001 -> Vista Radar de Mercado');
console.log('   Datos: 290 vacantes reales en PostgreSQL & Perfil Activo');
console.log('========================================================================\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  // PASO 1: NAVEGAR A PROPOSAL AUTOPILOT
  console.log('▶ [PASO 1/4] Navegando a http://localhost:7001...');
  await page.goto('http://localhost:7001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // PASO 2: CLIC EN BOTÓN "RADAR DE MERCADO" EN EL HEADER
  console.log('▶ [PASO 2/4] Accediendo a la nueva vista "Radar de Mercado"...');
  const radarBtn = page.locator("header button:has-text('Radar de Mercado')");
  await radarBtn.click();
  await page.waitForTimeout(1200);

  // Esperar a que se rendericen los KPIs y la tabla
  await page.waitForSelector("text='Top Oportunidad #1'", { timeout: 15000 });
  await page.waitForTimeout(600);

  // CHECKPOINT 1: Vista Superior (KPIs y Cuadrantes)
  const cp1Path = path.join(checkpointsDir, '01-radar-kpis-and-quadrants.png');
  await page.screenshot({ path: cp1Path, fullPage: false });
  console.log(`  📸 Checkpoint 01 capturado: ${cp1Path}`);

  // PASO 3: SCROLL A LA TABLA CUANTITATIVA COMPLETA
  console.log('▶ [PASO 3/4] Capturando tabla completa de oportunidades...');
  const tableEl = page.locator("table");
  await tableEl.first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(600);

  const cp2Path = path.join(checkpointsDir, '02-radar-matrix-table.png');
  await page.screenshot({ path: cp2Path, fullPage: false });
  console.log(`  📸 Checkpoint 02 capturado: ${cp2Path}`);

  // PASO 4: SCROLL A LA SECCIÓN DE METODOLOGÍA & DE DÓNDE SALE CADA VALOR
  console.log('▶ [PASO 4/4] Capturando sección de Metodología y Procedencia de Datos...');
  await page.evaluate(() => {
    document.querySelectorAll('*').forEach(el => {
      if (el.scrollHeight > el.clientHeight) {
        el.scrollTop = el.scrollHeight;
      }
    });
  });
  await page.waitForTimeout(1000);

  const cp3Path = path.join(checkpointsDir, '03-radar-data-provenance-methodology.png');
  await page.screenshot({ path: cp3Path, fullPage: false });
  console.log(`  📸 Checkpoint 03 capturado: ${cp3Path}`);

  console.log('\n========================================================================');
  console.log('✅ SANDBOX QA COMPLETADO CON ÉXITO: 3/3 CHECKPOINTS CAPTURADOS');
  console.log('========================================================================\n');

} catch (error) {
  console.error('❌ Error en Sandbox QA Radar:', error);
  const errorPath = path.join(checkpointsDir, 'error-screenshot.png');
  await page.screenshot({ path: errorPath, fullPage: true });
} finally {
  await browser.close();
}
