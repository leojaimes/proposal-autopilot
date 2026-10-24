#!/usr/bin/env node
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/**
 * Headless Visual Capture Tool for the Pre-Deploy Gate
 * Captures screen states and saves PNG evidence without dumping base64 into LLM context.
 */
export async function captureScreenshot(url, outputPath) {
  const fullOut = resolve(outputPath);
  const outDir = dirname(fullOut);
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  try {
    const { chromium } = await import('playwright');
    console.log(`📸 Lanzando navegador headless para capturar: ${url}...`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    await page.screenshot({ path: fullOut, fullPage: false });
    await browser.close();

    console.log(`✅ Captura guardada exitosamente:`);
    console.log(`🔗 file:///${fullOut.replace(/\\/g, '/')}`);
    return { success: true, path: fullOut };
  } catch (err) {
    console.warn(`⚠️ No se pudo tomar captura automática de ${url}: ${err.message}`);
    console.log(`💡 Si el servidor frontend no está corriendo, inícialo con 'npm run dev'`);
    return { success: false, error: err.message };
  }
}

if (process.argv[1]?.endsWith('snap.mjs')) {
  const url = process.argv[2] || 'http://localhost:4200';
  const out = process.argv[3] || './preview.png';
  captureScreenshot(url, out);
}
