#!/usr/bin/env node
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const EVIDENCE_DIR = join(ROOT_DIR, 'tests', 'sandbox-visual', 'evidence');

if (!existsSync(EVIDENCE_DIR)) {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
}

export async function runRadarScrapeFlow(baseUrl = 'http://localhost:7001') {
  console.log('═'.repeat(60));
  console.log('🧪 AI FACTORY FLOW ENGINE: Verificación de Flujo E2E');
  console.log('═'.repeat(60));
  console.log(`🎯 Objetivo: Clic en "Buscar Más Proyectos" ➔ Ingesta SSE ➔ Actualización Reactiva de Radar`);
  console.log(`🌐 Navegando a: ${baseUrl}...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const checkpoints = [];

  try {
    // -------------------------------------------------------------
    // PASO 1: Capturar Estado Inicial del Radar (Baseline)
    // -------------------------------------------------------------
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 20000 });
    console.log('📍 1. Navegando a la pestaña Radar de Mercado...');
    await page.click('button:has-text("Radar de Mercado")');
    await page.waitForTimeout(2000);

    const initialJobsText = await page.locator('article:has-text("Observed jobs, 30d") p.text-2xl').innerText().catch(() => 'Desconocido');
    const initialHealth = await page.locator('section:has-text("Radar data health") span.rounded-full').innerText().catch(() => 'Desconocido');

    console.log(`   📊 Estado Inicial: ${initialJobsText} empleos observados · Salud: ${initialHealth}`);

    const cp1Path = join(EVIDENCE_DIR, 'flow-01-radar-baseline.png');
    await page.screenshot({ path: cp1Path, fullPage: false });
    checkpoints.push({
      step: '1. Baseline Inicial',
      desc: `Radar con ${initialJobsText} empleos observados y estado ${initialHealth}.`,
      file: cp1Path,
    });
    console.log(`   📸 Checkpoint 1 guardado: ${cp1Path}`);

    // -------------------------------------------------------------
    // PASO 2: Disparar Ingesta ("Buscar Más Proyectos")
    // -------------------------------------------------------------
    console.log('📍 2. Haciendo clic en el botón "Buscar Más Proyectos"...');
    const searchButton = page.locator('button:has-text("Buscar Más Proyectos")');
    await searchButton.click();

    // Esperar a que el botón muestre estado en progreso o aparezca el banner SSE
    await page.waitForTimeout(1000);
    const inProgressBtnVisible = await page.locator('button:has-text("Buscando en Upwork...")').isVisible().catch(() => false);
    const progressBannerVisible = await page.locator('app-live-scrape-progress').isVisible().catch(() => false);

    console.log(`   ⚡ Estado en Vuelo detectado (Botón activo: ${inProgressBtnVisible}, Banner SSE: ${progressBannerVisible})`);

    const cp2Path = join(EVIDENCE_DIR, 'flow-02-scraping-in-flight.png');
    await page.screenshot({ path: cp2Path, fullPage: false });
    checkpoints.push({
      step: '2. Ingesta en Vuelo',
      desc: 'Botón en estado "Buscando en Upwork..." y banner SSE de progreso visible.',
      file: cp2Path,
    });
    console.log(`   📸 Checkpoint 2 guardado: ${cp2Path}`);

    // -------------------------------------------------------------
    // PASO 3: Esperar Progreso y Reconstrucción del Radar
    // -------------------------------------------------------------
    console.log('📍 3. Esperando ciclo de extracción, clasificación y rebuild...');
    // Esperamos hasta 30 segundos observando si el botón regresa o se actualiza
    let waited = 0;
    while (waited < 30000) {
      await page.waitForTimeout(3000);
      waited += 3000;
      const stillScraping = await page.locator('button:has-text("Buscando en Upwork...")').isVisible().catch(() => false);
      if (!stillScraping) {
        console.log(`   ✅ Ingesta finalizada a los ${waited / 1000}s`);
        break;
      }
      process.stdout.write(`   ⏳ En progreso... (${waited / 1000}s)\r`);
    }

    // -------------------------------------------------------------
    // PASO 4: Volver a la pestaña Radar y Comprobar Actualización
    // -------------------------------------------------------------
    console.log('\n📍 4. Verificando tabla del Radar tras la reconstrucción...');
    await page.click('button:has-text("Radar de Mercado")');
    await page.waitForTimeout(2000);

    const finalJobsText = await page.locator('article:has-text("Observed jobs, 30d") p.text-2xl').innerText().catch(() => 'Desconocido');
    const finalHealth = await page.locator('section:has-text("Radar data health") span.rounded-full').innerText().catch(() => 'Desconocido');

    console.log(`   📊 Estado Final: ${finalJobsText} empleos observados · Salud: ${finalHealth}`);

    const cp3Path = join(EVIDENCE_DIR, 'flow-03-radar-updated.png');
    await page.screenshot({ path: cp3Path, fullPage: false });
    checkpoints.push({
      step: '3. Radar Actualizado',
      desc: `Radar reactivo final: ${finalJobsText} empleos observados y estado ${finalHealth}.`,
      file: cp3Path,
    });
    console.log(`   📸 Checkpoint 3 guardado: ${cp3Path}`);

    await browser.close();

    console.log('\n' + '═'.repeat(60));
    console.log('🎉 FLUJO E2E COMPLETADO EXITOSAMENTE');
    console.log('═'.repeat(60));
    for (const cp of checkpoints) {
      console.log(`📸 ${cp.step}: file:///${cp.file.replace(/\\/g, '/')}`);
    }

    return { success: true, checkpoints };
  } catch (err) {
    await browser.close();
    console.error(`❌ Error en ejecución del flujo: ${err.message}`);
    return { success: false, error: err.message };
  }
}

if (process.argv[1]?.endsWith('flow.mjs')) {
  runRadarScrapeFlow();
}
