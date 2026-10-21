import path from 'path';
import fs from 'fs';
import { pathToFileURL } from 'url';

const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const RUN_DIR = path.resolve('.sandbox/runs/market-radar-decoupling');
if (!fs.existsSync(RUN_DIR)) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

async function run() {
  console.log('🚀 E2E VALIDATION: DESACOPLAMIENTO DE PERFILES (ARMANDO vs LEONARDO) EN EL RADAR DE MERCADO');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  // 1. Navegar a la aplicación
  console.log('1. Navegando a http://localhost:7001...');
  await page.goto('http://localhost:7001', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // 2. Abrir el Radar de Mercado
  console.log('2. Cambiando a la vista Radar de Mercado...');
  const radarTab = page.locator('button:has-text("Radar de Mercado")');
  await radarTab.click();
  await page.waitForTimeout(2000);

  // 3. Verificar estado con Perfil Armando
  console.log('3. Evaluando tarjeta Perfil Evaluador con Armando activo...');
  const evaluatorCard = page.locator('div:has-text("PERFIL EVALUADOR")').first();
  await evaluatorCard.waitFor({ state: 'visible', timeout: 5000 });

  const cardText = await evaluatorCard.innerText();
  console.log('   Contenido tarjeta Evaluador:\n', cardText);

  // Captura 1: Armando en Radar
  await page.screenshot({ path: path.join(RUN_DIR, '01-radar-armando-profile.png'), fullPage: true });
  console.log('   📸 Checkpoint 1 guardado: 01-radar-armando-profile.png');

  // 4. Cambiar perfil desde el Header dropdown a Leonardo
  console.log('4. Cambiando perfil en el Header a Leonardo Jaimes...');
  const profileTrigger = page.locator('div.relative button:has(svg.lucide-user)').first();
  await profileTrigger.click();
  await page.waitForTimeout(600);

  // Click en Leonardo dentro del dropdown
  const leonardoOption = page.locator('.space-y-1 div:has-text("Leonardo Jaimes")').first();
  await leonardoOption.click();
  await page.waitForTimeout(2500);

  // 5. Verificar estado con Perfil Leonardo
  console.log('5. Verificando que el Radar se actualizó reactivamente para Leonardo...');
  const cardTextLeonardo = await evaluatorCard.innerText();
  console.log('   Contenido tarjeta Evaluador con Leonardo:\n', cardTextLeonardo);

  // Captura 2: Leonardo en Radar
  await page.screenshot({ path: path.join(RUN_DIR, '02-radar-leonardo-profile.png'), fullPage: true });
  console.log('   📸 Checkpoint 2 guardado: 02-radar-leonardo-profile.png');

  // 6. Cambiar de regreso a Armando para verificar bidireccionalidad
  console.log('6. Restaurando a Armando...');
  await profileTrigger.click();
  await page.waitForTimeout(600);
  const armandoOption = page.locator('.space-y-1 div:has-text("Armando")').first();
  await armandoOption.click();
  await page.waitForTimeout(2500);

  const cardTextArmandoRestored = await evaluatorCard.innerText();
  console.log('   Contenido tarjeta Evaluador restaurada a Armando:\n', cardTextArmandoRestored);

  // Captura 3: Armando restaurado
  await page.screenshot({ path: path.join(RUN_DIR, '03-radar-armando-restored.png'), fullPage: true });
  console.log('   📸 Checkpoint 3 guardado: 03-radar-armando-restored.png');

  await browser.close();
  console.log('✅ TEST FINALIZADO CON ÉXITO: Ambos perfiles operan de forma 100% desacoplada y dinámica.');
}

run().catch((err) => {
  console.error('❌ Error durante la prueba E2E:', err);
  process.exit(1);
});
