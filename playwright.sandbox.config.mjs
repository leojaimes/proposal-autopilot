import path from "node:path";

import { defineConfig, devices } from "@playwright/test";

const runDir = path.resolve(process.env.SANDBOX_QA_RUN_DIR || ".sandbox/runs/manual-visual");
const baselineDir = path.resolve(process.env.SANDBOX_VISUAL_BASELINE_DIR || "tests/sandbox-visual/baselines");

export default defineConfig({
  testDir: "./tests/sandbox-visual",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  updateSnapshots: "none",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(runDir, "visual", "artifacts"),
  snapshotPathTemplate: path.join(baselineDir, "{projectName}", "{arg}{ext}"),
  reporter: [
    ["line"],
    ["json", { outputFile: path.join(runDir, "visual", "playwright-report.json") }],
  ],
  use: {
    ...devices["Desktop Chrome"],
    headless: true,
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
