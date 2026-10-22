import { mkdir } from "node:fs/promises";
import path from "node:path";

import { expect, test } from "@playwright/test";

import {
  assertSameVisualOrigin,
  loadVisualPlan,
  requireApprovedBaseline,
} from "../../scripts/sandbox-visual-plan.mjs";
import { waitForVisualCondition } from "../../scripts/sandbox-visual-actions.mjs";
import { assertApiResponse, captureApiResponseValue } from "../../scripts/sandbox-visual-api-assertions.mjs";

const planPath = process.env.SANDBOX_VISUAL_PLAN;
if (!planPath) throw new Error("SANDBOX_VISUAL_PLAN is required for declarative visual tests.");

const { plan } = await loadVisualPlan(planPath);
const checkpointDirectory = path.resolve(
  process.env.SANDBOX_QA_RUN_DIR || ".sandbox/runs/manual-visual",
  "visual",
  "checkpoints",
);

async function screenshot(page, scenario, step) {
  const masks = (step.maskSelectors || scenario.maskSelectors || []).map((selector) => page.locator(selector));
  const output = path.join(checkpointDirectory, `${step.id}.png`);
  await mkdir(checkpointDirectory, { recursive: true });
  await page.screenshot({ path: output, fullPage: step.fullPage, mask: masks });

  if (!step.captureOnly) {
    const baseline = path.resolve(
      process.env.SANDBOX_VISUAL_BASELINE_DIR || "tests/sandbox-visual/baselines",
      "chromium",
      `${step.id}.png`,
    );
    await requireApprovedBaseline(baseline, {
      updateBaselines: process.env.SANDBOX_UPDATE_VISUAL_BASELINES === "1",
    });
    await expect(page).toHaveScreenshot(`${step.id}.png`, {
      fullPage: step.fullPage,
      mask: masks,
      maxDiffPixels: step.maxDiffPixels,
    });
  }
}

async function assertPersistedApiState(page, step, captured) {
  const response = await page.request.get(step.url, { timeout: step.timeoutMs });
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("API assertion expected a JSON response.");
  }
  assertApiResponse({ status: response.status(), body, step, captured });
}

async function click(page, scenario, step, captured) {
  if (!step.captureResponse) {
    await page.locator(step.selector).click({ timeout: step.timeoutMs });
    return;
  }
  const capture = step.captureResponse;
  const responsePromise = page.waitForResponse((response) => response.url() === capture.url
    && response.request().method() === capture.method, { timeout: step.timeoutMs });
  const [response] = await Promise.all([
    responsePromise,
    page.locator(step.selector).click({ timeout: step.timeoutMs }),
  ]);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error("API capture expected a JSON response.");
  }
  captured.set(capture.saveAs, captureApiResponseValue({ status: response.status(), body, capture, captured }));
}

for (const scenario of plan.scenarios) {
  test.describe(`visual plan: ${scenario.id}`, () => {
    test.use({ viewport: plan.viewport });

    test(scenario.id, async ({ page }) => {
      test.setTimeout(plan.scenarioTimeoutMs);
      const captured = new Map();
      for (const step of scenario.steps) {
        if (step.action === "goto") {
          await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: step.timeoutMs });
          assertSameVisualOrigin(page.url(), scenario.origin);
        } else if (step.action === "click") {
          await click(page, scenario, step, captured);
        } else if (step.action === "fill") {
          const value = process.env[step.valueFromEnv];
          if (value === undefined) throw new Error(`Missing required environment variable: ${step.valueFromEnv}`);
          await page.locator(step.selector).fill(value, { timeout: step.timeoutMs });
        } else if (step.action === "upload") {
          await page.locator(step.selector).setInputFiles(step.paths, { timeout: step.timeoutMs });
        } else if (step.action === "waitFor") {
          await waitForVisualCondition(page, step);
        } else if (step.action === "apiAssert") {
          await assertPersistedApiState(page, step, captured);
        } else if (step.action === "screenshot") {
          await screenshot(page, scenario, step);
        }
      }
    });
  });
}
