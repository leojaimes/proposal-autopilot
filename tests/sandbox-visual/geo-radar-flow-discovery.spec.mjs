import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const RUN_DIR = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/geo-radar-flow-discovery/visual/checkpoints';
if (!fs.existsSync(RUN_DIR)) {
  fs.mkdirSync(RUN_DIR, { recursive: true });
}

test.describe('Geo-Radar B2B - UI Flow Discovery & E2E Sandbox QA', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  let authData = null;

  test.beforeAll(async () => {
    // Register or authenticate test user on backend
    const testEmail = `georadar.flow.${Date.now()}@peppertix.org`;
    const res = await fetch('http://localhost:7000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Password123!',
        companyName: 'Flow Discovery QA Corp'
      })
    });
    if (res.ok) {
      authData = await res.json();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Navigate and hydrate auth session
    await page.goto('http://localhost:7001');
    if (authData) {
      await page.evaluate((data) => {
        const session = {
          token: data.accessToken,
          user: data.user,
          tenant: data.tenant
        };
        localStorage.setItem('pa_auth_session', JSON.stringify(session));
      }, authData);
      await page.reload({ waitUntil: 'networkidle' });
    }
    await page.waitForTimeout(1000);
  });

  test('Flow 01: Initial Geo-Radar State & Municipal Boundary', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await expect(radarBtn).toBeVisible({ timeout: 10000 });
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(600);

    const geoRadar = page.locator('app-geo-radar');
    await expect(geoRadar).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2500);

    const cp = path.join(RUN_DIR, '01-georadar-initial-tactical-map.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 01 captured: Initial Geo-Radar Tactical Map');
  });

  test('Flow 02: Interactive Circular Radar & Radius Adjustment', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Adjust radius slider to 7.5 km
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
    await slider.fill('7.5');
    await slider.dispatchEvent('input');
    await page.waitForTimeout(1000);

    const cp = path.join(RUN_DIR, '02-circular-radar-radius-adjusted.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 02 captured: Circular Radar Adjusted to 7.5 km');
  });

  test('Flow 03: State & City Switcher with Dynamic Polygon', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Switch State to Jalisco
    const stateSelect = page.locator('select').first();
    await stateSelect.selectOption('Jalisco');
    await page.waitForTimeout(1500);

    const cp = path.join(RUN_DIR, '03-city-switching-jalisco-guadalajara.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 03 captured: City Switcher to Guadalajara, Jalisco');
  });

  test('Flow 04: Polygon Ingestion Modal & Presets Inspection', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Switch to Polygon mode
    const polyModeBtn = page.locator('button:has-text("Polígono Táctico")');
    await polyModeBtn.click({ force: true });
    await page.waitForTimeout(600);

    const openImporterBtn = page.locator('button:has-text("Ingresar Polígono"), button:has-text("Abrir Ingresor")');
    if (await openImporterBtn.count() > 0) {
      await openImporterBtn.first().click({ force: true });
    }

    const modalTitle = page.locator('text=Ingresor de Polígonos Tácticos B2B');
    await expect(modalTitle).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(600);

    const cp = path.join(RUN_DIR, '04-polygon-ingestion-modal-open.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 04 captured: Polygon Ingestion Modal with Presets & GeoJSON');
  });

  test('Flow 05: Active Tactical Polygon Delimited on Map with Area Stats', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Switch to Polygon mode and choose preset
    const polyModeBtn = page.locator('button:has-text("Polígono Táctico")');
    await polyModeBtn.click({ force: true });
    await page.waitForTimeout(600);

    const openImporterBtn = page.locator('button:has-text("Ingresar Polígono"), button:has-text("Abrir Ingresor")');
    if (await openImporterBtn.count() > 0) {
      await openImporterBtn.first().click({ force: true });
    }

    // Select preset "Zona Industrial Benito Juárez"
    const presetBtn = page.locator('button:has-text("Zona Industrial Benito Juárez")');
    await presetBtn.first().click({ force: true });
    await page.waitForTimeout(1500);

    // Verify stats card
    await expect(page.locator('text=Polígono Táctico Delimitado')).toBeVisible();

    const cp = path.join(RUN_DIR, '05-tactical-polygon-delimited-on-map.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 05 captured: Tactical Polygon Delimited with Vertices & Area');
  });

  test('Flow 06: B2B Business Scan Strictly Inside Tactical Polygon', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Switch to Polygon mode and choose preset
    const polyModeBtn = page.locator('button:has-text("Polígono Táctico")');
    await polyModeBtn.click({ force: true });
    await page.waitForTimeout(600);

    const openImporterBtn = page.locator('button:has-text("Ingresar Polígono"), button:has-text("Abrir Ingresor")');
    if (await openImporterBtn.count() > 0) {
      await openImporterBtn.first().click({ force: true });
    }
    const presetBtn = page.locator('button:has-text("Zona Industrial Benito Juárez")');
    await presetBtn.first().click({ force: true });
    await page.waitForTimeout(1000);

    // Trigger Scan
    const scanBtn = page.locator('button:has-text("Escanear Dentro del Polígono")');
    await scanBtn.click({ force: true });

    // Wait for leads to appear
    await page.waitForSelector('aside .custom-scrollbar > div', { timeout: 15000 });
    await page.waitForTimeout(1500);

    const cp = path.join(RUN_DIR, '06-polygon-scan-results-and-leads-feed.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 06 captured: Scanned Leads Feed and Pins inside Polygon');
  });

  test('Flow 07: Lead Selection & WhatsApp Sales Pitch Prepared Drawer', async ({ page }) => {
    const radarBtn = page.locator('button[title*="Geo-Radar"]');
    await radarBtn.click();
    await page.mouse.move(600, 300);
    await page.waitForTimeout(800);

    // Switch to Polygon mode and choose preset
    const polyModeBtn = page.locator('button:has-text("Polígono Táctico")');
    await polyModeBtn.click({ force: true });
    await page.waitForTimeout(600);

    const openImporterBtn = page.locator('button:has-text("Ingresar Polígono"), button:has-text("Abrir Ingresor")');
    if (await openImporterBtn.count() > 0) {
      await openImporterBtn.first().click({ force: true });
    }
    const presetBtn = page.locator('button:has-text("Zona Industrial Benito Juárez")');
    await presetBtn.first().click({ force: true });
    await page.waitForTimeout(1000);

    // Trigger Scan
    const scanBtn = page.locator('button:has-text("Escanear Dentro del Polígono")');
    await scanBtn.click({ force: true });

    // Click on the first lead card
    const firstLead = page.locator('aside .custom-scrollbar > div').first();
    await expect(firstLead).toBeVisible({ timeout: 15000 });
    await firstLead.click({ force: true });

    // Verify Pitch Drawer
    await expect(page.locator('text=Pitch de Contacto Preparado:')).toBeVisible({ timeout: 5000 });

    // Click copy button
    const copyBtn = page.locator('button:has-text("Copiar Pitch WhatsApp")');
    if (await copyBtn.count() > 0) {
      await copyBtn.first().click({ force: true });
    }
    await page.waitForTimeout(600);

    const cp = path.join(RUN_DIR, '07-lead-pitch-drawer-whatsapp-cta.png');
    await page.screenshot({ path: cp });
    console.log('✅ Flow 07 captured: Lead Pitch Drawer with Copied WhatsApp CTA');
  });
});

