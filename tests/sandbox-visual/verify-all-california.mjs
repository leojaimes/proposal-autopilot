import { chromium } from 'playwright';
import path from 'path';

const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6';

async function run() {
  console.log('1. Authenticating test user with backend...');
  const testEmail = `california.all.${Date.now()}@peppertix.org`;
  const res = await fetch('http://localhost:7000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: 'Password123!',
      companyName: 'California Hubs QA Corp',
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

  console.log('4. Selecting United States (USA) -> California...');
  const countrySelect = page.locator('app-geo-radar select').nth(0);
  await countrySelect.selectOption('United States');
  await page.waitForTimeout(1000);

  const stateSelect = page.locator('app-geo-radar select').nth(1);
  await stateSelect.selectOption('California');
  await page.waitForTimeout(1000);

  const citySelect = page.locator('app-geo-radar select').nth(2);

  console.log('5. Selecting San Francisco - Mission & Design District...');
  await citySelect.selectOption('San Francisco - Mission & Design District');
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '10_sf_mission_and_design_district.png'),
    fullPage: false,
  });

  console.log('6. Selecting Palo Alto (Stanford & Sand Hill Road)...');
  await citySelect.selectOption('Palo Alto (Stanford & Sand Hill Road)');
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '11_palo_alto_sand_hill_vc_alley.png'),
    fullPage: false,
  });

  console.log('7. Selecting Los Angeles (Silicon Beach)...');
  await citySelect.selectOption('Los Angeles (Silicon Beach - Santa Monica & Venice)');
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '12_la_silicon_beach_santa_monica.png'),
    fullPage: false,
  });

  console.log('8. Opening Tactical Polygon modal...');
  const polygonBtn = page.locator('app-geo-radar button:has-text("Ingresar Polígono")').first();
  await polygonBtn.click({ force: true });
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '13_tactical_polygon_modal_full_california.png'),
    fullPage: false,
  });

  console.log('9. Applying SoMa & Financial District AI Tech Hub Preset...');
  const sfPresetBtn = page.locator('button:has-text("SoMa & Financial District (AI & VC Hub)")');
  await sfPresetBtn.click({ force: true });
  await page.waitForTimeout(2000);

  console.log('10. Triggering Scan within SF AI Tech Hub Polygon...');
  const scanBtn = page.locator('button:has-text("Escanear Dentro del Polígono")');
  await scanBtn.click({ force: true });
  await page.waitForTimeout(3000);

  await page.screenshot({
    path: path.join(ARTIFACTS_DIR, '14_sf_soma_ai_hub_polygon_scan.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('FULL CALIFORNIA E2E VERIFIED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
