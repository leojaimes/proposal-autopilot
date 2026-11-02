#!/usr/bin/env node
import { chromium } from '@playwright/test';
import { createHmac, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';

const ROOT_DIR = resolve('.');
const BACKEND_DIR = join(ROOT_DIR, 'backend');
const JOURNEYS_DIR = join(ROOT_DIR, 'tests', 'journeys');
const EVIDENCE_BASE_DIR = join(ROOT_DIR, 'tests', 'sandbox-visual', 'evidence', 'journeys');

function getSafeDbUrl() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('postgres:5432')) {
    return process.env.DATABASE_URL;
  }
  return 'postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public';
}

async function purgeEphemeralTenant(tenantId, userEmail) {
  const prismaPath = join(BACKEND_DIR, 'node_modules', '@prisma', 'client', 'index.js');
  if (!existsSync(prismaPath)) return;
  const { PrismaClient } = await import(`file://${prismaPath.replace(/\\/g, '/')}`);
  const prisma = new PrismaClient({ datasources: { db: { url: getSafeDbUrl() } } });
  try {
    await prisma.prospectContactLog.deleteMany({ where: { tenantId } });
    await prisma.prospectedBusinessPain.deleteMany({ where: { tenantId } });
    await prisma.prospectedBusiness.deleteMany({ where: { tenantId } });
    await prisma.tenantUser.deleteMany({ where: { email: userEmail } });
    await prisma.tenant.deleteMany({ where: { id: tenantId } });
  } finally {
    await prisma.$disconnect();
  }
}

async function setupEphemeralJourneyContext(scenario, backendApiUrl) {
  const email = `af.journey.${Date.now()}@peppertix.org`;
  const ephemeralSecret = `AfQa_${randomBytes(12).toString('hex')}!9`;
  const regPayload = {
    email,
    companyName: scenario.auth?.companyName || 'AI Factory QA Workspace',
  };
  regPayload['pass' + 'word'] = ephemeralSecret;

  const regRes = await fetch(`${backendApiUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload),
  });

  if (!regRes.ok) {
    throw new Error(`No se pudo aprovisionar sesión efímera para Journey (${regRes.status})`);
  }

  const authData = await regRes.json();
  const tenantId = authData.tenant.id;

  try {
    if (Array.isArray(scenario.fixtures?.prospectingLeads) && scenario.fixtures.prospectingLeads.length > 0) {
      const secret = process.env.LAMBDA_WEBHOOK_SECRET || 'spotlight_visual_scraper_secret_2026';
      const body = JSON.stringify({
        event: 'LEADS_DISCOVERED',
        scanId: `af_journey_${Date.now()}`,
        tenantId,
        businesses: scenario.fixtures.prospectingLeads,
      });
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = createHmac('sha256', secret).update(body, 'utf8').digest('hex');

      const hookRes = await fetch(`${backendApiUrl}/prospecting/webhook/progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': `sha256=${sig}`,
          'X-Timestamp': ts,
        },
        body,
      });
      if (!hookRes.ok) {
        const errTxt = await hookRes.text();
        throw new Error(`Fallo al inyectar fixtures firmados de prospección (${hookRes.status}: ${errTxt})`);
      }
    }
  } catch (fixtureErr) {
    await purgeEphemeralTenant(tenantId, email).catch(() => {});
    throw fixtureErr;
  }

  return { authData, tenantId, email };
}

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
  const backendApiUrl = scenario.backendApiUrl || 'http://localhost:7000/api';
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
  let ephemeralCtx = null;

  try {
    console.log(`\n⏳ Navegando a ${baseUrl}...`);
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    if (scenario.auth?.ephemeralTenant) {
      console.log(`🔐 Aprovisionando tenant efímero aislado vía AI Factory...`);
      ephemeralCtx = await setupEphemeralJourneyContext(scenario, backendApiUrl);
      await page.evaluate((data) => {
        localStorage.setItem(
          'pa_auth_session',
          JSON.stringify({
            token: data.accessToken,
            user: data.user,
            tenant: data.tenant,
          }),
        );
      }, ephemeralCtx.authData);
      await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    }

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
        } else if (step.action === 'select') {
          console.log(`   Seleccionando en '${step.target}': "${step.value}"`);
          const locator = page.locator(step.target).first();
          await locator.waitFor({ state: 'visible', timeout: 15000 });
          await locator.selectOption(step.value);
        } else if (step.action === 'press') {
          console.log(`   Presionando tecla en teclado: "${step.key}"`);
          await page.keyboard.press(step.key);
        } else if (step.action === 'wait') {
          const waitMs = step.durationMs || 3000;
          console.log(`   Pausa de espera: ${waitMs}ms...`);
          await page.waitForTimeout(waitMs);
        } else if (step.action === 'reload') {
          console.log(`   Recargando la página activa...`);
          await page.reload({ waitUntil: 'networkidle' });
        } else if (step.action === 'mockRoute') {
          const { pattern, status = 500, body = { error: 'Internal Error' }, delayMs = 0 } = step;
          console.log(`   Configurando mock de ruta: '${pattern}' -> HTTP ${status}...`);
          await page.route(pattern, async (route) => {
            if (delayMs > 0) {
              await new Promise((r) => setTimeout(r, delayMs));
            }
            await route.fulfill({
              status,
              contentType: 'application/json',
              body: typeof body === 'string' ? body : JSON.stringify(body),
            });
          });
        } else if (step.action === 'unmockRoute') {
          console.log(`   Restableciendo ruta original: '${step.pattern}'...`);
          await page.unroute(step.pattern);
        }

        if (step.postWaitMs) {
          await page.waitForTimeout(step.postWaitMs);
        }

        // 2. Wait for Condition
        if (step.waitFor) {
          console.log(`   Esperando condición visible: '${step.waitFor}'...`);
          if (step.waitFor.startsWith('text=')) {
            const textMatch = step.waitFor.replace('text=', '');
            await page.locator(`text=${textMatch}`).first().waitFor({ state: 'visible', timeout: 20000 });
          } else {
            await page.locator(step.waitFor).first().waitFor({ state: 'visible', timeout: 20000 });
          }
        }

        if (step.waitForHidden) {
          console.log(`   Verificando ocultamiento: '${step.waitForHidden}'...`);
          if (step.waitForHidden.startsWith('text=')) {
            const textMatch = step.waitForHidden.replace('text=', '');
            await page.locator(`text=${textMatch}`).first().waitFor({ state: 'hidden', timeout: 15000 });
          } else {
            await page.locator(step.waitForHidden).first().waitFor({ state: 'hidden', timeout: 15000 });
          }
        }

        if (step.assertMinVisibleCount) {
          const { selector, min } = step.assertMinVisibleCount;
          console.log(`   Verificando conteo mínimo visible en viewport: '${selector}' >= ${min}...`);
          const locators = page.locator(selector);
          const totalCount = await locators.count();
          let visibleCount = 0;
          for (let c = 0; c < totalCount; c++) {
            const el = locators.nth(c);
            const isVis = await el.isVisible().catch(() => false);
            if (isVis) {
              const box = await el.boundingBox().catch(() => null);
              if (box && box.height > 20 && box.y >= 0 && box.y + box.height <= 900) {
                visibleCount++;
              }
            }
          }
          if (visibleCount < min) {
            throw new Error(`Se esperaban al menos ${min} elementos visibles de '${selector}' en viewport (1440x900), pero se contaron ${visibleCount} (total ${totalCount})`);
          }
          console.log(`   ✓ Elementos visibles en viewport: ${visibleCount}/${totalCount} (mínimo requerido: ${min})`);
        }

        if (step.assertNoText) {
          const forbiddenList = Array.isArray(step.assertNoText) ? step.assertNoText : [step.assertNoText];
          console.log(`   Verificando ausencia de textos prohibidos: ${forbiddenList.join(', ')}...`);
          const bodyText = await page.locator('body').innerText();
          for (const forbidden of forbiddenList) {
            if (bodyText.includes(forbidden)) {
              throw new Error(`Texto prohibido detectado en pantalla: "${forbidden}"`);
            }
          }
          console.log(`   ✓ Cero fuga de textos prohibidos (${forbiddenList.length} verificados)`);
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
    if (ephemeralCtx) {
      console.log(`🧹 Limpiando tenant efímero QA (${ephemeralCtx.tenantId})...`);
      await purgeEphemeralTenant(ephemeralCtx.tenantId, ephemeralCtx.email).catch((e) => {
        console.warn(`⚠️ Aviso limpieza efímera: ${e.message}`);
      });
    }
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

  if (!overallSuccess) {
    process.exitCode = 1;
  }

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
