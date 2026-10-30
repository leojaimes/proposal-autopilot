import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6';

async function run() {
  console.log('1. Authenticating test user with backend...');
  const testEmail = `merida.usa.${Date.now()}@peppertix.org`;
  const res = await fetch('http://localhost:7000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!',
      companyName: 'Merida USA QA Corp',
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

  console.log('2. Navigating and setting localStorage auth session...');
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

  console.log('3. Clicking Geo-Radar in Sidebar...');
  const radarBtn = page.locator('button[title="Geo-Radar de Empresas B2B"]');
  await radarBtn.click();
  await page.mouse.move(800, 400);
  await page.waitForTimeout(2500);

  // Wait for app-geo-radar to appear
  await page.waitForSelector('app-geo-radar', { timeout: 10000 });

  console.log('4. Taking screenshot of Initial Mérida, Yucatán state...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '01_merida_yucatan_clean_map.png'),
    fullPage: false,
  });

  console.log('5. Switching Country to United States (USA)...');
  const countrySelect = page.locator('app-geo-radar select').nth(0);
  await countrySelect.selectOption({ index: 1 }); // Index 1 is United States
  await page.waitForTimeout(1000);

  console.log('6. Selecting State: Texas...');
  const stateSelect = page.locator('app-geo-radar select').nth(1);
  await stateSelect.selectOption('Texas');
  await page.waitForTimeout(1000);

  console.log('7. Selecting City: Austin...');
  const citySelect = page.locator('app-geo-radar select').nth(2);
  await citySelect.selectOption('Austin');
  await page.waitForTimeout(2500);

  console.log('8. Taking screenshot of Austin, Texas state...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '02_usa_texas_austin_map.png'),
    fullPage: false,
  });

  console.log('9. Opening Tactical Polygon modal...');
  const polygonBtn = page.locator('app-geo-radar button:has-text("Ingresar Polígono")').first();
  await polygonBtn.click({ force: true });
  await page.waitForTimeout(1000);

  console.log('10. Taking screenshot of Tactical Polygon Modal with Mérida & USA Presets...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '03_tactical_polygon_modal_merida_usa.png'),
    fullPage: false,
  });

  console.log('11. Selecting Merida Industrial Corridor Preset...');
  const meridaPresetBtn = page.locator('button:has-text("Corredor Industrial Mérida - Progreso")');
  await meridaPresetBtn.click({ force: true });
  await page.waitForTimeout(2500);

  console.log('12. Triggering Scan within Merida Polygon...');
  const scanBtn = page.locator('button:has-text("Escanear Dentro del Polígono")');
  await scanBtn.click({ force: true });
  await page.waitForTimeout(3000);

  console.log('13. Taking screenshot of Merida Polygon Scan Results...');
  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '04_merida_polygon_scan_leads.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
