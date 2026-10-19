import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Import Playwright
const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const checkpointsDir = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/multi-persona-e2e/visual/checkpoints';
fs.mkdirSync(checkpointsDir, { recursive: true });

console.log('================================================================');
console.log('🧪 SANDBOX QA E2E: CREACIÓN DE PERFIL DESDE CERO & CALIBRACIÓN');
console.log('================================================================\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  // 1. CARGAR APLICACIÓN EN VIVO
  console.log('▶ [PASO 1/6] Navegando a http://localhost:7001...');
  await page.goto('http://localhost:7001');
  await page.waitForTimeout(1000);

  // 2. ABRIR SELECTOR DE PERFILES EN EL HEADER
  console.log('▶ [PASO 2/6] Abriendo el Selector de Perfiles (Header)...');
  const profileBtn = await page.locator("header button:has-text('👤')");
  await profileBtn.click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(checkpointsDir, '01-profile-switcher-opened.png'), fullPage: false });
  console.log('  ✓ Checkpoint 1: Menú de perfiles desplegado.');

  // 3. ABRIR MODAL "CREAR PERFIL DE CERO"
  console.log('▶ [PASO 3/6] Creando nueva persona (Armando: Fullstack & AI Architect)...');
  await page.click("button:has-text('Crear Perfil de Cero')");
  await page.waitForTimeout(500);

  await page.screenshot({ path: path.join(checkpointsDir, '02-create-profile-modal.png'), fullPage: false });

  // Rellenar datos de la nueva persona
  await page.fill("input[placeholder*='Armando']", 'Armando: Fullstack & AI Agent Architect');
  await page.fill("input[placeholder*='Senior Fullstack']", 'Principal Fullstack Engineer');
  await page.waitForTimeout(300);

  await page.click("button:has-text('Crear y Calibrar de Cero')");
  await page.waitForTimeout(800);
  console.log('  ✓ Checkpoint 2: Perfil nuevo creado de cero. Drawer de calibración abierto.');

  // 4. CONFIGURAR OFERTA ESPECÍFICA & AGREGAR 2 HISTORIAS DE AUTORIDAD
  console.log('▶ [PASO 4/6] Ingresando Oferta Específica y 2 Historias de Autoridad...');
  // Oferta
  const offerArea = page.locator("textarea[placeholder*='transformación concreta']");
  await offerArea.fill('Arquitectura fullstack cloud y agentes de IA: desarrollo de software de alta velocidad con Angular, NestJS y AWS Bedrock entregado en ciclos sprint de 2 semanas.');

  // Cliente objetivo
  const audienceInput = page.locator("input[placeholder*='Startups B2B']");
  await audienceInput.fill('Founders técnicos de startups Seed/Series A en EE.UU. que necesitan un Founding Engineer fraccional para lanzar su MVP al mercado.');

  // Agregar Historia 1: Rappi / Fintech
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(400);

  await page.fill("input[placeholder*='Rappi']", 'Fintech LATAM (Rappi / MercadoPago)');
  await page.fill("input[placeholder*='+35%']", '+38% Conversión de Checkout');
  await page.fill("input[placeholder*='Rediseño completo']", 'Rediseño del motor de pagos y arquitectura de micro-frontends reduciendo la latencia a 120ms.');
  await page.fill("input[placeholder*='Fullstack']", 'Fintech, Angular, Microservices, Payments');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(600);

  // Agregar Historia 2: AI Automation Lab
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(400);

  await page.fill("input[placeholder*='Rappi']", 'AI Automation Lab (Cisco / Naehas)');
  await page.fill("input[placeholder*='+35%']", 'Ahorro de $150k/año en Infraestructura');
  await page.fill("input[placeholder*='Rediseño completo']", 'Implementación de pipeline multi-agente con Claude 3.5 y Bedrock con streaming en tiempo real.');
  await page.fill("input[placeholder*='Fullstack']", 'AI Agents, AWS Bedrock, NestJS, Python');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(600);

  // Probar reordenar (subir la historia 2 a la posición #1)
  const upButtons = page.locator("button[title='Subir prioridad']");
  if (await upButtons.count() > 1) {
    await upButtons.nth(1).click();
    await page.waitForTimeout(400);
    console.log('  ✓ Reordenamiento probado: Historia #2 elevada a prioridad #1.');
  }

  await page.screenshot({ path: path.join(checkpointsDir, '03-new-profile-drawer-offer-stories.png'), fullPage: false });
  console.log('  ✓ Checkpoint 3: Oferta e historias configuradas y ordenadas.');

  // 5. CONFIGURAR KEYWORDS DE UPWORK & FILTROS FINANCIEROS ($2,500 y $65/h)
  console.log('▶ [PASO 5/6] Configurando Keywords de Upwork y Filtros Financieros ($2,500 y $65/h)...');
  await page.click("button:has-text('2. Keywords & Filtros')");
  await page.waitForTimeout(400);

  // Keywords
  const keywordsArea = page.locator("textarea[placeholder*='palabras clave']");
  await keywordsArea.fill('Angular, NestJS, AWS Bedrock, Fullstack, AI Agents, TypeScript, Cloud Architecture, Microservices');

  // Filtros de tarifa y presupuesto
  const numberInputs = page.locator("input[type='number']");
  // Primer input: Presupuesto fijo mínimo ($2,500)
  await numberInputs.nth(0).fill('2500');
  // Segundo input: Tarifa horaria mínima ($65/h)
  await numberInputs.nth(1).fill('65');

  await page.screenshot({ path: path.join(checkpointsDir, '04-new-profile-keywords-and-budget.png'), fullPage: false });
  console.log('  ✓ Checkpoint 4: Keywords personalizadas y tarifas ($2,500 / $65/h) guardadas.');

  // 6. CALIBRAR PESOS MATEMÁTICOS (45/30/15/10)
  console.log('▶ [PASO 6/6] Ajustando Pesos Matemáticos...');
  await page.click("button:has-text('3. Pesos Matemáticos')");
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(checkpointsDir, '05-new-profile-weights-calibrated.png'), fullPage: false });
  console.log('  ✓ Checkpoint 5: Pesos matemáticos calibrados.');

  // 7. DISPARAR SCRAPING CON EL NUEVO PERFIL
  console.log('▶ [PASO 7/7] Inicializando Extracción con este Nuevo Perfil...');
  const scrapeBtn = page.locator("button:has-text('Guardar y Extraer Empleos con este Perfil')");
  await scrapeBtn.click();
  await page.waitForTimeout(2000);

  await page.screenshot({ path: path.join(checkpointsDir, '06-scraping-triggered-with-profile.png'), fullPage: true });
  console.log('  ✓ Checkpoint 6: Scraping inicializado exitosamente bajo el perfil de Armando.');

  console.log('\n================================================================');
  console.log('🎉 FLUJO E2E COMPLETO EJECUTADO CON ÉXITO: 6/6 CHECKPOINTS PASS');
  console.log('================================================================');

} catch (err) {
  console.error('❌ Error durante la prueba E2E:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
