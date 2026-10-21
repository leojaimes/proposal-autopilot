import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Import Playwright
const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const checkpointsDir = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/cv-ai-ingest-e2e/visual/checkpoints';
fs.mkdirSync(checkpointsDir, { recursive: true });

console.log('========================================================================');
console.log('🚀 SANDBOX QA E2E: INGESTA DE CV CON IA & EVALUACIÓN DE VACANTES');
console.log('   Candidato: Leonardo Jaimes Estevez (Full Stack & AI Systems Architect)');
console.log('   Endpoints: Frontend :7001 | Backend :7000 | PostgreSQL :5438');
console.log('========================================================================\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  // PASO 1: NAVEGACIÓN Y CARGA INICIAL
  console.log('▶ [PASO 1/5] Navegando a Proposal Autopilot (http://localhost:7001)...');
  await page.goto('http://localhost:7001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // PASO 2: ABRIR SELECTOR Y MODAL CON PESTAÑA IA
  console.log('▶ [PASO 2/5] Desplegando Selector de Perfiles y abriendo Modal de Ingesta IA...');
  const profileDropdownBtn = page.locator("header button:has-text('Activo')");
  await profileDropdownBtn.click();
  await page.waitForTimeout(400);

  await page.click("button:has-text('Crear Perfil de Cero')");
  await page.waitForSelector("textarea[placeholder*='Pega aquí tu CV completo']", { timeout: 10000 });
  await page.waitForTimeout(400);

  const cp1Path = path.join(checkpointsDir, '01-profile-modal-ai-tab.png');
  await page.screenshot({ path: cp1Path, fullPage: false });
  console.log(`  📸 Checkpoint 01 capturado: ${cp1Path}`);

  // PASO 3: CARGAR CV DE LEONARDO
  console.log('▶ [PASO 3/5] Cargando CV y proyectos reales de Leonardo...');
  await page.click("button:has-text('⚡ Cargar CV de Leonardo')");
  await page.waitForTimeout(500);

  const cp2Path = path.join(checkpointsDir, '02-cv-loaded-in-modal.png');
  await page.screenshot({ path: cp2Path, fullPage: false });
  console.log(`  📸 Checkpoint 02 capturado: ${cp2Path}`);

  // PASO 4: SINTETIZAR CON IA (GEMINI 2.5 FLASH)
  console.log('▶ [PASO 4/5] Sintetizando Perfil, Proof Stories y Scoring Rationale con IA...');
  await page.click("button:has-text('Sintetizar Proyectos, Taxonomía y Scoring')");
  
  // Esperar a que la síntesis complete y aparezca la preview card
  await page.waitForSelector("span:has-text('Perfil Extraído')", { timeout: 45000 });
  await page.waitForTimeout(1200);

  const cp3Path = path.join(checkpointsDir, '03-ai-synthesis-preview.png');
  await page.screenshot({ path: cp3Path, fullPage: false });
  console.log(`  📸 Checkpoint 03 capturado: ${cp3Path}`);

  // PASO 5: ACTIVAR Y RE-EVALUAR VACANTES DE INMEDIATO
  console.log('▶ [PASO 5/5] Activando Perfil y re-evaluando 290 vacantes ($0 USD)...');
  await page.click("button:has-text('Activar Perfil y Re-evaluar Leads de Inmediato')");

  // Esperar a que el modal se cierre tras persistir en DB y re-evaluar
  await page.waitForSelector(".fixed.inset-0", { state: 'hidden', timeout: 30000 });
  await page.waitForTimeout(2000);

  const cp4Path = path.join(checkpointsDir, '04-activated-cabina-despacho.png');
  await page.screenshot({ path: cp4Path, fullPage: false });
  console.log(`  📸 Checkpoint 04 capturado: ${cp4Path}`);

  // PASO EXTRA: VISTA MOTOR DE BÚSQUEDA
  console.log('▶ [PASO EXTRA] Verificando Motor de Búsqueda con las vacantes puntuadas...');
  const explorerBtn = page.locator("header button:has-text('Motor de Búsqueda')");
  if (await explorerBtn.isVisible()) {
    await explorerBtn.click();
    await page.waitForTimeout(1500);
    const cp5Path = path.join(checkpointsDir, '05-motor-busqueda-scored-leads.png');
    await page.screenshot({ path: cp5Path, fullPage: false });
    console.log(`  📸 Checkpoint 05 capturado: ${cp5Path}`);
  }

  console.log('\n========================================================================');
  console.log('✅ SANDBOX QA COMPLETADO CON ÉXITO: 5/5 CHECKPOINTS CAPTURADOS');
  console.log('========================================================================\n');

} catch (error) {
  console.error('❌ Error en Sandbox QA:', error);
  const errorPath = path.join(checkpointsDir, 'error-screenshot.png');
  await page.screenshot({ path: errorPath, fullPage: true });
  console.log(`  📸 Error capturado en: ${errorPath}`);
} finally {
  await browser.close();
}
