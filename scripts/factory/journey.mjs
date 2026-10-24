#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROOT_DIR = resolve('.');
const JOURNEYS_DIR = join(ROOT_DIR, 'tests', 'journeys');
const EVIDENCE_BASE_DIR = join(ROOT_DIR, 'tests', 'sandbox-visual', 'evidence', 'journeys');

/**
 * Lists all declarative journeys available in tests/journeys.
 */
export function listJourneys() {
  if (!existsSync(JOURNEYS_DIR)) return [];
  return readdirSync(JOURNEYS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      try {
        const raw = readFileSync(join(JOURNEYS_DIR, f), 'utf8');
        const parsed = JSON.parse(raw);
        return {
          id: f.replace('.json', ''),
          title: parsed.title || f,
          description: parsed.description || '',
          stepsCount: parsed.steps?.length || 0
        };
      } catch {
        return { id: f.replace('.json', ''), title: f, description: '', stepsCount: 0 };
      }
    });
}

/**
 * Runs a declarative E2E journey using native Playwright.
 */
export async function runJourney(journeyNameOrPath, options = {}) {
  let filePath = journeyNameOrPath;
  if (!existsSync(filePath)) {
    filePath = join(JOURNEYS_DIR, `${journeyNameOrPath}.json`);
  }

  if (!existsSync(filePath)) {
    console.error(`❌ Recorrido no encontrado: '${journeyNameOrPath}'`);
    console.log('Recorridos disponibles:');
    for (const j of listJourneys()) {
      console.log(`  - ${j.id}: ${j.title} (${j.stepsCount} pasos)`);
    }
    process.exit(1);
  }

  const scenario = JSON.parse(readFileSync(filePath, 'utf8'));
  const journeyId = scenario.journey || basename(filePath, '.json');
  const baseUrl = options.url || scenario.baseUrl || 'http://localhost:7001';
  const headed = options.headed || false;

  console.log('\n' + '═'.repeat(65));
  console.log(`🚀 SIMULADOR DECLARATIVO DE RECORRIDOS (AI FACTORY JOURNEY)`);
  console.log('═'.repeat(65));
  console.log(`📍 Recorrido:    ${scenario.title || journeyId}`);
  console.log(`🌐 Base URL:      ${baseUrl}`);
  console.log(`📋 Pasos totales: ${scenario.steps.length}`);
  console.log('═'.repeat(65));

  const outputDir = join(EVIDENCE_BASE_DIR, journeyId);
  mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  const stepResults = [];
  let overallSuccess = true;

  try {
    // Navigate initially if baseUrl is defined
    console.log(`\n⏳ Navegando a ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const stepNum = String(i + 1).padStart(2, '0');
      const stepStartTime = Date.now();
      console.log(`\n▶️ Paso [${stepNum}/${scenario.steps.length}]: ${step.description}`);

      try {
        // 1. Execute Action
        if (step.action === 'navigate') {
          const targetUrl = step.url || baseUrl;
          await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        } else if (step.action === 'click') {
          console.log(`   Haciendo clic en: '${step.target}'`);
          const locator = page.locator(step.target).first();
          await locator.waitFor({ state: 'visible', timeout: 15000 });
          await locator.click();
        } else if (step.action === 'type' || step.action === 'fill') {
          console.log(`   Escribiendo en '${step.target}': "${step.value}"`);
          const locator = page.locator(step.target).first();
          await locator.fill(step.value);
        } else if (step.action === 'wait') {
          const waitMs = step.durationMs || 3000;
          console.log(`   Pausa de espera: ${waitMs}ms...`);
          await page.waitForTimeout(waitMs);
        }

        // 2. Wait for Condition
        if (step.waitFor) {
          console.log(`   Esperando condición: '${step.waitFor}'...`);
          if (step.waitFor.startsWith('text=')) {
            const textMatch = step.waitFor.replace('text=', '');
            await page.locator(`text=${textMatch}`).first().waitFor({ state: 'visible', timeout: 20000 });
          } else {
            await page.locator(step.waitFor).first().waitFor({ state: 'visible', timeout: 20000 });
          }
        }

        const duration = Math.round(Date.now() - stepStartTime);

        // 3. Capture Screenshot Evidence
        let screenshotPath = null;
        if (step.capture !== false) {
          const filename = `${stepNum}-${step.id || 'step'}.png`;
          screenshotPath = join(outputDir, filename);
          await page.screenshot({ path: screenshotPath, fullPage: false });
          console.log(`   📸 Captura guardada: ${filename} (${duration}ms)`);
        }

        stepResults.push({
          step: i + 1,
          id: step.id,
          description: step.description,
          durationMs: duration,
          screenshotFile: screenshotPath ? basename(screenshotPath) : null,
          screenshotPath: screenshotPath ? screenshotPath.replace(/\\/g, '/') : null,
          status: 'PASS'
        });
      } catch (err) {
        overallSuccess = false;
        console.error(`   ❌ ERROR en paso ${stepNum}: ${err.message}`);

        // Capture failure screenshot
        const failFilename = `FAIL-${stepNum}-${step.id || 'error'}.png`;
        const failPath = join(outputDir, failFilename);
        await page.screenshot({ path: failPath }).catch(() => {});

        stepResults.push({
          step: i + 1,
          id: step.id,
          description: step.description,
          error: err.message,
          screenshotFile: failFilename,
          screenshotPath: failPath.replace(/\\/g, '/'),
          status: 'FAIL'
        });
        break; // Stop execution on failure
      }
    }
  } finally {
    await browser.close();
  }

  // 4. Generate Storyboard Markdown Document
  const storyboardFile = join(outputDir, 'STORYBOARD.md');
  const storyboardContent = `# 🎬 Storyboard de Recorrido: ${scenario.title || journeyId}

**Identificador:** \`${journeyId}\`  
**Fecha:** ${new Date().toISOString()}  
**Resultado:** ${overallSuccess ? '🟢 EXITOSO (ALL PASS)' : '🔴 FALLIDO'}  
**Descripción:** ${scenario.description || 'Recorrido automatizado de extremo a extremo.'}  

---

## 📸 Hitos Visuales del Recorrido

| Paso | Descripción | Duración | Estado | Evidencia |
| :---: | :--- | :---: | :---: | :--- |
${stepResults.map(r => `| ${r.step} | ${r.description} | ${r.durationMs || '-'}ms | ${r.status === 'PASS' ? '🟢 PASS' : '🔴 FAIL'} | ${r.screenshotFile ? `[Ver Foto](file:///${r.screenshotPath})` : '-'} |`).join('\n')}

---

## 🖼️ Galería Secuencial del Storyboard

${stepResults.map(r => r.screenshotPath ? `
### Paso ${r.step}: ${r.description}
${r.status === 'FAIL' ? `> ❌ **Error:** ${r.error}` : ''}
![Paso ${r.step}](file:///${r.screenshotPath})
` : '').join('\n')}

---
*Generado automáticamente por Proposal Autopilot AI Factory Journey Engine*
`;

  writeFileSync(storyboardFile, storyboardContent, 'utf8');

  console.log('\n' + '═'.repeat(65));
  if (overallSuccess) {
    console.log(`🎉 RECORRIDO COMPLETADO EXITOSAMENTE (ALL PASS)`);
  } else {
    console.log(`🚨 RECORRIDO INTERRUMPIDO CON FALLAS`);
  }
  console.log(`📄 Storyboard interactivo disponible en:`);
  console.log(`   🔗 file:///${storyboardFile.replace(/\\/g, '/')}`);
  console.log('═'.repeat(65) + '\n');

  return { success: overallSuccess, storyboardFile };
}

if (process.argv[1]?.endsWith('journey.mjs')) {
  const journeyArg = process.argv[2];
  if (!journeyArg || journeyArg === '--list') {
    console.log('📋 Recorridos disponibles:');
    for (const j of listJourneys()) {
      console.log(`  - ${j.id}: ${j.title} (${j.stepsCount} pasos)`);
    }
    process.exit(0);
  }

  const headed = process.argv.includes('--headed');
  const urlIdx = process.argv.indexOf('--url');
  const url = urlIdx !== -1 ? process.argv[urlIdx + 1] : undefined;

  runJourney(journeyArg, { headed, url });
}
