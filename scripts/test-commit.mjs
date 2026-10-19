import { pathToFileURL } from 'url';

const playwrightUrl = pathToFileURL('D:/SpotlightProjects/publications/node_modules/playwright/index.mjs').href;
const { chromium } = await import(playwrightUrl);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
page.on('pageerror', err => console.log('BROWSER_ERROR:', err.message));

console.log('Navigating with commit...');
await page.goto('http://localhost:7001', { waitUntil: 'commit' });
console.log('Commit OK! Waiting 3s...');
await page.waitForTimeout(3000);

const html = await page.content();
console.log('Contains app-root content:', html.includes('Proposal Autopilot'));
console.log('Contains header:', html.includes('<header'));
console.log('Length:', html.length);

await browser.close();
