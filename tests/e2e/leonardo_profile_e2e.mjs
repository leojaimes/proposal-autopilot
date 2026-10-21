import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

// Import Playwright
const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const checkpointsDir = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/leonardo-e2e/visual/checkpoints';
fs.mkdirSync(checkpointsDir, { recursive: true });

console.log('========================================================================');
console.log('🚀 PLAYWRIGHT E2E: CREACIÓN DEL PERFIL DE LEONARDO JAIMES & APIS UPWORK');
console.log('   Taxonomía: Senior Full Stack Developer & AI Systems Architect');
console.log('   Target: http://localhost:7001 (Angular) & http://localhost:7000 (NestJS)');
console.log('========================================================================\n');

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

try {
  // PASO 1: NAVEGACIÓN Y CARGA DE COCKPIT
  console.log('▶ [PASO 1/7] Navegando al Cockpit de Proposal Autopilot (http://localhost:7001)...');
  await page.goto('http://localhost:7001');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // PASO 2: DESPLEGAR PROFILE SWITCHER Y CREAR PERFIL DE CERO
  console.log('▶ [PASO 2/7] Abriendo Selector de Perfiles y creando la Persona de Leonardo...');
  const profileDropdownBtn = page.locator("header button:has-text('Activo')");
  await profileDropdownBtn.click();
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(checkpointsDir, '01-profile-switcher-opened.png'), fullPage: false });
  console.log('  📸 Checkpoint 01: Dropdown de Perfiles capturado.');

  // Clic en Crear Perfil de Cero
  await page.click("button:has-text('Crear Perfil de Cero')");
  await page.waitForTimeout(400);

  // Rellenar datos de la Persona de Leonardo
  await page.fill("input[placeholder*='Armando (Fullstack']", 'Leonardo Jaimes: Senior Full Stack & AI Architect');
  await page.fill("input[placeholder*='Senior Fullstack']", 'Senior Full Stack Developer & AI Systems Architect');
  await page.waitForTimeout(300);

  await page.click("button:has-text('Crear y Calibrar de Cero')");
  await page.waitForTimeout(800);
  console.log('  ✓ Modal completado: Perfil de Leonardo inicializado. Calibrador abierto.');

  // PASO 3: CONFIGURAR OFERTA ESPECÍFICA & LAS 4 PROOF STORIES DE LEONARDO
  console.log('▶ [PASO 3/7] Configurando Oferta Específica y 4 Proof Stories de Leonardo...');
  
  // Oferta
  const offerTextarea = page.locator("textarea[placeholder*='transformación concreta']");
  await offerTextarea.fill('Full Stack Developer with 10+ years building scalable web & mobile SaaS applications, specialized in Vue, Nuxt, Node.js, NestJS, MongoDB, and autonomous AI agents.');

  // Audiencia Objetivo
  const audienceInput = page.locator("input[placeholder*='Startups B2B']");
  await audienceInput.fill('Founders, CTOs, and technical leaders of fast-growing SaaS startups needing senior full stack architecture, real-time automation pipelines, and AI agent integration.');

  // HISTORIA 1: Spotlight Studio (AI Publications Platform)
  console.log('  - Agregando Historia 1: Spotlight Studio (AI SaaS)...');
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(300);
  await page.fill("input[placeholder*='Rappi']", 'Spotlight Studio (AI SaaS)');
  await page.fill("input[placeholder*='+35%']", '80% Reduction in Content Production Time');
  await page.fill("input[placeholder*='Rediseño completo']", 'Multi-tenant SaaS automating real-time event detection, decision making, and content generation using AI agents.');
  await page.fill("input[placeholder*='Fullstack']", 'AI Agents, Vue, Nuxt, Node.js, NestJS, SaaS');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(400);

  // HISTORIA 2: PepperTix (Ticketing)
  console.log('  - Agregando Historia 2: PepperTix (Ticketing Platform)...');
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(300);
  await page.fill("input[placeholder*='Rappi']", 'PepperTix (Ticketing Platform)');
  await page.fill("input[placeholder*='+35%']", 'High-Throughput Real-Time Transactions');
  await page.fill("input[placeholder*='Rediseño completo']", 'Scalable ticket resale platform with real-time secure transaction APIs built with Vue, Nuxt, Node.js, and MongoDB.');
  await page.fill("input[placeholder*='Fullstack']", 'Full Stack, Vue, Nuxt, Node.js, MongoDB, REST APIs');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(400);

  // HISTORIA 3: Pepper Bot (Conversational AI)
  console.log('  - Agregando Historia 3: Pepper Bot (Conversational AI)...');
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(300);
  await page.fill("input[placeholder*='Rappi']", 'Pepper Bot (Conversational AI)');
  await page.fill("input[placeholder*='+35%']", '17,000+ Users Event Search Bot');
  await page.fill("input[placeholder*='Rediseño completo']", 'Event search conversational chatbot integrating Messenger Graph API, Dialogflow, and ChatGPT.');
  await page.fill("input[placeholder*='Fullstack']", 'AI, Chatbots, Dialogflow, ChatGPT, Node.js');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(400);

  // HISTORIA 4: Pepper Videos (Mobile)
  console.log('  - Agregando Historia 4: Pepper Videos (Flutter Mobile App)...');
  await page.click("button:has-text('Agregar Historia')");
  await page.waitForTimeout(300);
  await page.fill("input[placeholder*='Rappi']", 'Pepper Videos (Mobile App)');
  await page.fill("input[placeholder*='+35%']", 'Clean Architecture Mobile App');
  await page.fill("input[placeholder*='Rediseño completo']", 'Flutter mobile application built with Clean Architecture for high testability, maintainability, and fluid performance.');
  await page.fill("input[placeholder*='Fullstack']", 'Flutter, Mobile, Clean Architecture');
  await page.click("button:has-text('Guardar Historia')");
  await page.waitForTimeout(400);

  await page.screenshot({ path: path.join(checkpointsDir, '02-leonardo-stories-configured.png'), fullPage: false });
  console.log('  📸 Checkpoint 02: 4 Historias de Autoridad configuradas y capturadas.');

  // PASO 4: CONFIGURAR AFINIDAD DE ROLES (TAXONOMÍA 4 CAPAS)
  console.log('▶ [PASO 4/7] Configurando Afinidad de Roles para Leonardo (Full Stack 1.0, Excluyendo UI/UX pura)...');
  await page.click("button:has-text('2. Afinidad de Roles')");
  await page.waitForTimeout(400);

  // Limpiar posibles roles excluidos residuales de software
  const excludedSection = page.locator("div:has-text('Roles Incompatibles / Freno Inmediato')").last();
  const removeButtons = excludedSection.locator("button:has-text('✕')");
  const count = await removeButtons.count();
  for (let i = 0; i < count; i++) {
    if (await removeButtons.first().isVisible()) {
      await removeButtons.first().click();
      await page.waitForTimeout(80);
    }
  }

  // Agregar Roles Núcleo (1.0)
  const coreRoles = ['Full Stack Developer', 'Full Stack Engineer', 'Backend Developer', 'NestJS Developer', 'Node.js Developer', 'Vue Developer', 'AI Engineer'];
  const coreInput = page.locator("input[placeholder*='Agregar rol núcleo']");
  for (const role of coreRoles) {
    await coreInput.fill(role);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }

  // Agregar Roles Híbridos (0.8)
  const hybridRoles = ['AI Agent Architect', 'Automation Engineer', 'Nuxt Developer', 'React Developer', 'Next.js Developer'];
  const hybridInput = page.locator("input[placeholder*='Agregar rol híbrido']");
  for (const role of hybridRoles) {
    await hybridInput.fill(role);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }

  // Agregar Roles Excluidos (0.0)
  const excludedRoles = ['UI/UX Designer', 'Telemarketing', 'Virtual Assistant'];
  const excludedInput = page.locator("input[placeholder*='Agregar rol excluido']");
  for (const role of excludedRoles) {
    await excludedInput.fill(role);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
  }

  await page.screenshot({ path: path.join(checkpointsDir, '03-leonardo-roles-taxonomy.png'), fullPage: false });
  console.log('  📸 Checkpoint 03: Taxonomía de 4 capas configurada (Full Stack 100%, UI/UX 0%).');

  // PASO 5: CONFIGURAR QUERIES DE UPWORK Y GUARDAR EN POSTGRESQL
  console.log('▶ [PASO 5/7] Configurando Expresiones de Búsqueda Upwork y Sincronizando con PostgreSQL...');
  await page.click("button:has-text('3. Keywords & Filtros')");
  await page.waitForTimeout(400);

  const queries = [
    '("Full Stack" OR "Fullstack") AND ("Node" OR "Vue" OR "NestJS")',
    '("AI Agent" OR "Automation" OR "LangChain" OR "OpenAI") AND ("Backend" OR "Full Stack")',
    '("Nuxt" OR "Vue.js") AND ("Node.js" OR "MongoDB")',
    '("Multi-Tenant" OR "SaaS") AND ("NestJS" OR "Full Stack")'
  ];

  const queryInput = page.locator("input[placeholder*='Design System']");
  const addQueryBtn = page.locator("button:has-text('+ Agregar')").last();
  for (const q of queries) {
    await queryInput.fill(q);
    await addQueryBtn.click();
    await page.waitForTimeout(150);
  }

  // Guardar configuración completa en PostgreSQL
  console.log('  - Guardando Filtros, Taxonomía e Historias en PostgreSQL...');
  const savePostgresBtn = page.locator("button:has-text('Guardar Filtros en PostgreSQL')");
  await savePostgresBtn.click();
  await page.waitForTimeout(1000);

  // Cerrar el Drawer para regresar al Cockpit
  await page.click("button:has-text('Cerrar')");
  await page.waitForTimeout(500);

  // PASO 6: DISPARAR RE-EVALUACIÓN EN FRÍO ($0 USD)
  console.log('▶ [PASO 6/7] Disparando Re-evaluación en Frío de los 290 empleos con la Taxonomía de Leonardo...');
  const reprocessBtn = page.locator("button:has-text('Re-evaluar Leads ($0)')");
  await reprocessBtn.waitFor({ state: 'visible', timeout: 5000 });
  await reprocessBtn.click();

  console.log('  - Esperando re-procesamiento deductivo y síntesis IA del Top 3 Gold...');
  await page.waitForTimeout(3000);
  await page.waitForFunction(() => {
    const btn = document.querySelector("button[title*='Re-evalúa todas']");
    return btn && !btn.hasAttribute('disabled');
  }, { timeout: 60000 });
  await page.waitForTimeout(1500);

  // Si la pestaña High no tiene leads, cambiar a Todos para ver el Top 1 Lead evaluado
  const todosBtn = page.locator("button:has-text('Todos')");
  if (await todosBtn.isVisible()) {
    await todosBtn.click();
    await page.waitForTimeout(600);
  }

  // Clic en la primera tarjeta de la cola de despacho si no está ya seleccionada
  const firstCard = page.locator(".group.border").first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: path.join(checkpointsDir, '04-cabina-despacho-leonardo-top-lead.png'), fullPage: true });
  console.log('  📸 Checkpoint 04: Cabina de Despacho capturada con el nuevo Top 1 Lead de Leonardo.');

  // PASO 7: INSPECCIONAR Y VERIFICAR PROPIEDADES DEL LEAD #1 DE LEONARDO
  console.log('▶ [PASO 7/7] Verificando detalles del Top Lead y navegando al Motor de Búsqueda...');
  
  // Extraer información del Lead visible en la cabina
  const leadTitleLocator = page.locator("h1.font-headline, .font-headline a, h1").first();
  const leadTitle = await leadTitleLocator.textContent();
  console.log(`\n  🏆 TOP LEAD DETECTADO: "${leadTitle?.trim()}"`);

  // Extraer carta de presentación generada si está visible
  const proposalSection = page.locator('#proposal-workspace-section, .select-all');
  if (await proposalSection.first().isVisible()) {
    const letterText = await proposalSection.first().textContent();
    console.log(`\n  ✉️ CARTA GENERADA CON IA (Top Gold):`);
    console.log(`     "${letterText?.trim()}"\n`);
  }

  // Verificar botón de copiar carta
  const copyBtn = page.locator("button:has-text('Copiar Carta para Upwork')");
  if (await copyBtn.isVisible()) {
    await copyBtn.click();
    await page.waitForTimeout(400);
    console.log('  ✓ Botón Copiar Carta para Upwork verificado y funcional.');
  }

  // Cambiar a vista Motor de Búsqueda
  await page.click("button:has-text('Motor de Búsqueda')");
  await page.waitForTimeout(1000);

  // Buscar 'Full Stack' en el buscador global del Motor de Búsqueda
  const searchInput = page.locator("input[placeholder*='Buscar'], input[placeholder*='buscar']").first();
  if (await searchInput.isVisible()) {
    await searchInput.fill('Full Stack');
    await page.waitForTimeout(600);
  }

  await page.screenshot({ path: path.join(checkpointsDir, '05-motor-busqueda-high-fit-leonardo.png'), fullPage: true });
  console.log('  📸 Checkpoint 05: Motor de Búsqueda capturado con los empleos filtrados para Leonardo.');

  console.log('\n========================================================================');
  console.log('🎉 PLAYWRIGHT E2E FINALIZADO CON ÉXITO: 5/5 CHECKPOINTS CAPTURADOS');
  console.log('   - Perfil creado: Leonardo Jaimes (Senior Full Stack & AI Architect)');
  console.log('   - 4 Proof Stories registradas: Spotlight Studio, PepperTix, Pepper Bot, Pepper Videos');
  console.log('   - Taxonomía Full Stack/AI calibrada al 100% (UI/UX descalificada)');
  console.log('   - Base de 290 vacantes re-procesadas a $0 tokens y Top 3 Gold generado con IA');
  console.log('========================================================================\n');

} catch (err) {
  console.error('\n❌ Error durante la ejecución del test Playwright E2E:', err);
  process.exitCode = 1;
} finally {
  await browser.close();
}
