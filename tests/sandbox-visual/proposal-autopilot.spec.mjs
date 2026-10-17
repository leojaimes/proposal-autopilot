import { test, expect } from '@playwright/test';
import path from 'node:path';

const checkpointDir = 'D:/SpotlightProjects/proposal-autopilot/.sandbox/runs/e2e-run-1/visual/checkpoints';

test.describe('Proposal Autopilot - E2E Visual Sandbox QA', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('01: Verify Zero-State Onboarding Screen', async ({ page }) => {
    // 1. Reset database to ensure 0 items
    await page.request.post('http://localhost:7000/api/scraping/reset');

    // 2. Load page
    await page.goto('http://localhost:7001');
    await page.waitForLoadState('networkidle');

    // 3. Verify Zero-State is visible
    const zeroState = page.locator('app-zero-state-onboarding');
    await expect(zeroState).toBeVisible();

    // Checkpoint 1
    await page.screenshot({ path: path.join(checkpointDir, '01-zero-state-onboarding.png'), fullPage: true });
    console.log('✅ Checkpoint 01 captured: Zero-State Onboarding');
  });

  test('02: Restore Preset and Verify Feed Transition', async ({ page }) => {
    await page.goto('http://localhost:7001');
    await page.waitForLoadState('networkidle');

    // Click Restore Demo Preset
    const restoreBtn = page.locator("button:has-text('Cargar Preset de Demostración')");
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Wait for jobs to load
    await page.waitForResponse(res => res.url().includes('/api/scraping') && res.status() === 200, { timeout: 15000 });
    await page.waitForTimeout(1000);

    // Checkpoint 2
    await page.screenshot({ path: path.join(checkpointDir, '02-preset-restored-feed.png'), fullPage: true });
    console.log('✅ Checkpoint 02 captured: Preset Restored Feed');
  });

  test('03: Dispatch Deck - Inspect High Fit & Copy Proposal', async ({ page }) => {
    await page.goto('http://localhost:7001');
    await page.waitForLoadState('networkidle');

    // Switch to Cabina de Despacho
    await page.click("button:has-text('Cabina de Despacho')");
    await page.waitForTimeout(500);

    // Verify Copy button is present
    const copyBtn = page.locator("button:has-text('Copiar Carta para Upwork')");
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Verify feedback
    await expect(page.locator("span:has-text('¡Copiado al Portapapeles!')")).toBeVisible();

    // Checkpoint 3
    await page.screenshot({ path: path.join(checkpointDir, '03-dispatch-action-copied.png'), fullPage: false });
    console.log('✅ Checkpoint 03 captured: Dispatch Action Copied');
  });

  test('04: Search Engine - Search Query and Filter Pills', async ({ page }) => {
    await page.goto('http://localhost:7001');
    await page.waitForLoadState('networkidle');

    // Switch to Motor de Búsqueda
    await page.click("button:has-text('Motor de Búsqueda')");
    await page.waitForTimeout(500);

    // Search for 'AI'
    const searchInput = page.locator("input[placeholder*='Buscar']");
    await searchInput.fill('AI');

    // Filter by High Fit
    await page.click("button:has-text('High Fit')");
    await page.waitForTimeout(500);

    // Checkpoint 4
    await page.screenshot({ path: path.join(checkpointDir, '04-search-engine-filtered.png'), fullPage: true });
    console.log('✅ Checkpoint 04 captured: Search Engine Filtered');
  });

  test('05: Calibration Settings Drawer - Weights Sliders', async ({ page }) => {
    await page.goto('http://localhost:7001');
    await page.waitForLoadState('networkidle');

    // Click Calibrar
    await page.click("button:has-text('Calibrar')");
    await page.waitForTimeout(500);

    // Click Pesos Matemáticos tab
    await page.click("button:has-text('Pesos Matemáticos')");
    await page.waitForTimeout(500);

    // Checkpoint 5
    await page.screenshot({ path: path.join(checkpointDir, '05-calibration-drawer-weights.png'), fullPage: false });
    console.log('✅ Checkpoint 05 captured: Calibration Drawer Weights');
  });
});
