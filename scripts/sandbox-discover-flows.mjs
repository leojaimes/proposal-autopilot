#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

export const DEFAULT_VIEWPORT = Object.freeze({ width: 1440, height: 900 });
export const DEFAULT_STORAGE_STATE = ".sandbox/fixtures/pubmaster-social-storage-state.json";

export const TARGET_ORIGINS = Object.freeze({
  pubmaster: { local: "http://127.0.0.1:3008", remote: "https://pubmaster.spotlightus.org" },
  nielsen: { local: "http://127.0.0.1:3014", remote: "https://nielsen.spotlightus.org" },
  pageclone: { local: "http://127.0.0.1:3015", remote: "https://clone.spotlightus.org" },
  admin: { local: "http://127.0.0.1:3009", remote: "https://admin.spotlightus.org" },
});

export function parseDiscoverArgs(argv) {
  const options = {
    target: "pubmaster",
    path: "/es",
    remote: false,
    dryRun: false,
    timeoutMs: 15000,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--target") {
      options.target = argv[i + 1]?.toLowerCase();
      i += 1;
    } else if (flag === "--path") {
      options.path = argv[i + 1];
      i += 1;
    } else if (!flag.startsWith("--") && flag.startsWith("/")) {
      options.path = flag;
    } else if (flag === "--out") {
      options.out = argv[i + 1];
      i += 1;
    } else if (flag === "--url") {
      try {
        const parsed = new URL(argv[i + 1]);
        options.url = parsed.origin;
        if (parsed.pathname && parsed.pathname !== "/") {
          options.path = parsed.pathname;
        }
      } catch {
        options.url = argv[i + 1];
      }
      options.remote = true;
      i += 1;
    } else if (flag === "--remote") {
      options.remote = true;
    } else if (flag === "--dry-run") {
      options.dryRun = true;
    } else if (flag === "--timeout-ms") {
      options.timeoutMs = Number(argv[i + 1]);
      i += 1;
    }
  }

  if (options.target === "admin" && options.path === "/es") {
    options.path = "/";
  }

  if (!["pubmaster", "nielsen", "pageclone", "admin"].includes(options.target)) {
    throw new Error(`Target must be one of: pubmaster, nielsen, pageclone, admin. Received: ${options.target}`);
  }
  if (!options.path.startsWith("/")) {
    throw new Error(`Path must start with a forward slash (e.g. /es/app/page-clone). Received: ${options.path}`);
  }

  const safeModuleId = options.path.replace(/^\/es\/?/u, "").replace(/[^a-z0-9_-]/giu, "-").replace(/-+/gu, "-") || "landing";
  if (!options.out) {
    options.out = path.join(".sandbox", "visual-plans", `${options.target}-${safeModuleId}-auto.json`);
  }

  return options;
}

export function buildDiscoveryPlan({ target, targetPath, discoveredElements, storageState = DEFAULT_STORAGE_STATE }) {
  const safeBaseId = targetPath.replace(/^\/es\/?/u, "").replace(/[^a-z0-9_-]/giu, "-").replace(/-+/gu, "-") || "entry";
  const steps = [];

  // Step 1: Navigate to base page
  steps.push({ action: "goto", path: targetPath });
  steps.push({
    action: "screenshot",
    id: `${safeBaseId}-01-landing`,
    checkpoint: `Initial landing view of ${targetPath}`,
    fullPage: true,
  });

  // Step 2: Tab flows
  for (let index = 0; index < (discoveredElements.tabs || []).length; index += 1) {
    const tab = discoveredElements.tabs[index];
    const safeTabId = (tab.id || `tab-${index}`).replace(/[^a-z0-9_-]/giu, "-");
    steps.push({ action: "click", selector: tab.selector, timeoutMs: 5000 });
    steps.push({
      action: "screenshot",
      id: `${safeBaseId}-tab-${safeTabId}`,
      checkpoint: `View state after selecting tab: ${tab.label || tab.selector}`,
      fullPage: true,
    });
  }

  // Step 3: Modal triggers
  for (let index = 0; index < (discoveredElements.modals || []).length; index += 1) {
    const modal = discoveredElements.modals[index];
    const safeModalId = (modal.id || `modal-${index}`).replace(/[^a-z0-9_-]/giu, "-");
    steps.push({ action: "click", selector: modal.selector, timeoutMs: 5000 });
    if (modal.waitForSelector) {
      steps.push({ action: "waitFor", selector: modal.waitForSelector, state: "visible", timeoutMs: 8000 });
    }
    steps.push({
      action: "screenshot",
      id: `${safeBaseId}-dialog-${safeModalId}`,
      checkpoint: `Dialog or modal open state: ${modal.label || modal.selector}`,
      fullPage: true,
    });
    // Close modal if close selector exists
    if (modal.closeSelector) {
      steps.push({ action: "click", selector: modal.closeSelector, timeoutMs: 5000 });
    }
  }

  // Step 4: View switchers (Split, Solo, etc.)
  for (let index = 0; index < (discoveredElements.viewSwitchers || []).length; index += 1) {
    const view = discoveredElements.viewSwitchers[index];
    const safeViewId = (view.id || `view-${index}`).replace(/[^a-z0-9_-]/giu, "-");
    steps.push({ action: "click", selector: view.selector, timeoutMs: 5000 });
    steps.push({
      action: "screenshot",
      id: `${safeBaseId}-view-${safeViewId}`,
      checkpoint: `Alternate view state: ${view.label || view.selector}`,
      fullPage: true,
    });
  }

  return {
    version: 2,
    viewport: DEFAULT_VIEWPORT,
    storageState,
    stepTimeoutMs: 15000,
    scenarioTimeoutMs: 120000,
    scenarios: [
      {
        id: `${target}-${safeBaseId}-auto-discovered`,
        profile: target,
        steps,
      },
    ],
  };
}

export async function extractInteractiveElementsFromPage(page) {
  return page.evaluate(() => {
    const sanitize = (text) => (text || "").replace(/\s+/gu, " ").trim().slice(0, 80);

    // 1. Discover Tabs & Segmented Filters
    const tabElements = Array.from(
      document.querySelectorAll('[role="tab"], [role="radio"], [data-testid*="tab"], [data-testid*="filter"]')
    );
    const tabs = tabElements
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
      })
      .map((el, i) => {
        const testId = el.getAttribute("data-testid");
        const selector = testId ? `[data-testid='${testId}']` : (el.id ? `#${el.id}` : `[role="tab"], [role="radio"]:nth-of-type(${i + 1})`);
        return {
          id: testId || el.id || `tab-${i + 1}`,
          label: sanitize(el.textContent) || el.getAttribute("aria-label") || `Tab ${i + 1}`,
          selector,
        };
      });

    // 2. Discover Modal / Dialog & Action Triggers
    const modalButtons = Array.from(
      document.querySelectorAll(
        '[aria-haspopup="dialog"], [data-testid*="modal"], [data-testid*="new-"], [data-testid*="-new"], [data-testid*="create"], [data-testid*="audit-button"], [data-testid*="btn"]'
      )
    );
    const modals = modalButtons
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
      })
      .map((el, i) => {
        const testId = el.getAttribute("data-testid");
        const selector = testId ? `[data-testid='${testId}']` : (el.id ? `#${el.id}` : `button:has-text("${sanitize(el.textContent)}")`);
        return {
          id: testId || el.id || `modal-trigger-${i + 1}`,
          label: sanitize(el.textContent) || `Modal Trigger ${i + 1}`,
          selector,
          waitForSelector: '[role="dialog"], [data-testid*="modal"]',
          closeSelector: '[role="dialog"] button[aria-label*="Close"], [role="dialog"] [data-testid*="close"]',
        };
      });

    // 3. Discover View Switchers
    const viewButtons = Array.from(
      document.querySelectorAll('[data-testid*="view-mode"], [data-testid*="view"], button[title*="Vista"], button[aria-label*="view"]')
    );
    const viewSwitchers = viewButtons
      .filter((el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== "none";
      })
      .map((el, i) => {
        const testId = el.getAttribute("data-testid");
        const selector = testId ? `[data-testid='${testId}']` : (el.id ? `#${el.id}` : `button[title='${el.getAttribute("title")}']`);
        return {
          id: testId || el.id || `view-${i + 1}`,
          label: sanitize(el.getAttribute("title") || el.textContent) || `View ${i + 1}`,
          selector,
        };
      });

    return { tabs, modals, viewSwitchers };
  });
}

export async function runDiscovery(options) {
  const { chromium } = await import("@playwright/test");
  const origin = options.url || (options.remote ? TARGET_ORIGINS[options.target].remote : TARGET_ORIGINS[options.target].local);
  const targetUrl = new URL(options.path, origin).toString();

  console.log(`[Flow Discovery] Launching headless browser targeting: ${targetUrl}`);
  const browser = await chromium.launch({ headless: true });

  const contextOptions = { viewport: DEFAULT_VIEWPORT };
  try {
    contextOptions.storageState = DEFAULT_STORAGE_STATE;
  } catch {
    // Continue without state if fixture missing
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
    await page.waitForTimeout(2000); // Allow React hydration
    console.log(`[Flow Discovery] Landed at: ${page.url()} (title: "${await page.title()}")`);

    const discovered = await extractInteractiveElementsFromPage(page);
    console.log(`[Flow Discovery] Found: ${discovered.tabs.length} tabs, ${discovered.modals.length} modal triggers, ${discovered.viewSwitchers.length} view switchers.`);

    const visualPlan = buildDiscoveryPlan({
      target: options.target,
      targetPath: options.path,
      discoveredElements: discovered,
    });

    if (options.dryRun) {
      console.log("[Flow Discovery] Dry run complete. Plan structure:");
      console.log(JSON.stringify(visualPlan, null, 2));
    } else {
      const resolvedOut = path.resolve(options.out);
      await mkdir(path.dirname(resolvedOut), { recursive: true });
      await writeFile(resolvedOut, JSON.stringify(visualPlan, null, 2), "utf8");
      console.log(`[Flow Discovery] Visual plan generated successfully at: ${resolvedOut}`);
      console.log(`[Flow Discovery] Total automated checkpoints: ${visualPlan.scenarios[0].steps.filter((s) => s.action === "screenshot").length}`);
    }

    return visualPlan;
  } finally {
    await browser.close();
  }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/gu, "/")}`) {
  try {
    const options = parseDiscoverArgs(process.argv.slice(2));
    await runDiscovery(options);
  } catch (error) {
    console.error(`[Flow Discovery Error] ${error.message}`);
    process.exit(1);
  }
}
