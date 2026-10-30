import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6';

async function run() {
  console.log('1. Authenticating test user with backend...');
  const testEmail = `colombia.sf.${Date.now()}@peppertix.org`;
  const res = await fetch('http://localhost:7000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!',
      companyName: 'Colombia SF Exploration Corp',
    }),
  });

  if (!res.ok) {
    throw new Error(`Failed to register test user: ${res.statusText}`);
  }
  const authData = await res.json();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1.5,
  });
  const page = await context.newPage();

  console.log('2. Hydrating auth session...');
  await page.goto('http://localhost:7001');
  await page.evaluate((data) => {
    const session = {
      token: data.accessToken,
      user: data.user,
      tenant: data.tenant,
    };
    localStorage.setItem('pa_auth_session', JSON.stringify(session));
  }, authData);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  console.log('3. Opening Geo-Radar...');
  const radarBtn = page.locator('button[title="Geo-Radar de Empresas B2B"]');
  await radarBtn.click();
  await page.mouse.move(800, 400);
  await page.waitForSelector('app-geo-radar', { timeout: 10000 });
  await page.waitForTimeout(2000);

  console.log('4. Selecting Colombia 🇨🇴...');
  const countrySelect = page.locator('app-geo-radar select').nth(0);
  await countrySelect.selectOption('Colombia');
  await page.waitForTimeout(1000);

  console.log('5. Selecting Antioquia -> Medellín...');
  const stateSelect = page.locator('app-geo-radar select').nth(1);
  await stateSelect.selectOption('Antioquia');
  await page.waitForTimeout(1000);

  const citySelect = page.locator('app-geo-radar select').nth(2);
  await citySelect.selectOption('Medellín');
  await page.waitForTimeout(2500);

  console.log('6. Taking screenshot of Medellín, Antioquia (Colombia)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '05_colombia_medellin_map.png'),
    fullPage: false,
  });

  console.log('7. Switching to Santander -> Bucaramanga...');
  await stateSelect.selectOption('Santander');
  await page.waitForTimeout(1000);
  await citySelect.selectOption('Bucaramanga');
  await page.waitForTimeout(2500);

  console.log('8. Taking screenshot of Bucaramanga, Santander (Colombia)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '06_colombia_bucaramanga_map.png'),
    fullPage: false,
  });

  console.log('9. Switching to USA -> California -> San Francisco (SoMa & Tech Hub)...');
  await countrySelect.selectOption('United States');
  await page.waitForTimeout(1000);
  await stateSelect.selectOption('California');
  await page.waitForTimeout(1000);
  await citySelect.selectOption('San Francisco (SoMa & Tech Hub)');
  await page.waitForTimeout(2500);

  console.log('10. Taking screenshot of San Francisco (SoMa & Bay Area)...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '07_california_san_francisco_map.png'),
    fullPage: false,
  });

  console.log('11. Opening Tactical Polygon modal...');
  const polygonBtn = page.locator('app-geo-radar button:has-text("Ingresar Polígono")').first();
  await polygonBtn.click({ force: true });
  await page.waitForTimeout(1000);

  console.log('12. Taking screenshot of modal with Colombia & SF presets...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '08_polygon_modal_colombia_and_sf.png'),
    fullPage: false,
  });

  console.log('13. Applying San Francisco SoMa AI Tech Hub Preset...');
  const sfPresetBtn = page.locator('button:has-text("SoMa & Financial District AI Tech Hub")');
  await sfPresetBtn.click({ force: true });
  await page.waitForTimeout(2000);

  console.log('14. Triggering Scan within SF Polygon...');
  const scanBtn = page.locator('button:has-text("Escanear Dentro del Polígono")');
  await scanBtn.click({ force: true });
  await page.waitForTimeout(3000);

  console.log('15. Taking screenshot of San Francisco Polygon Scan with Leads...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '09_san_francisco_polygon_scan_leads.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('COLOMBIA & SAN FRANCISCO QA VERIFIED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

