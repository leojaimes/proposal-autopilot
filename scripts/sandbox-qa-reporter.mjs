#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { exec } from "node:child_process";

async function getFileSha256(filePath) {
  try {
    const data = await readFile(filePath);
    return createHash("sha256").update(data).digest("hex").slice(0, 16);
  } catch {
    return "missing";
  }
}

async function findLatestRun(outputDir = path.resolve(".sandbox", "runs")) {
  try {
    const entries = await readdir(outputDir, { withFileTypes: true });
    const runDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (runDirs.length === 0) return null;
    runDirs.sort().reverse();
    return path.join(outputDir, runDirs[0]);
  } catch {
    return null;
  }
}

async function findPngs(dir) {
  try {
    const entries = await readdir(dir, { recursive: true, withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
      .map((e) => path.join(e.parentPath || dir, e.name));
  } catch {
    return [];
  }
}

export async function reportEvidence(targetDir, options = {}) {
  const runDir = targetDir || (await findLatestRun());
  if (!runDir) {
    console.error("No QA runs found in .sandbox/runs/");
    return { ok: false, exitCode: 1 };
  }

  const summaryPath = path.join(runDir, "summary.json");
  const manifestPath = path.join(runDir, "manifest.json");

  let summary = null;
  let manifest = null;

  try {
    summary = JSON.parse(await readFile(summaryPath, "utf8"));
  } catch {}

  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch {}

  const isPassed = summary?.status === "passed";
  const statusColor = isPassed ? "\x1b[32m" : "\x1b[31m";
  const reset = "\x1b[0m";
  const bold = "\x1b[1m";
  const cyan = "\x1b[36m";
  const yellow = "\x1b[33m";

  console.log("");
  console.log(`${bold}================================================================================${reset}`);
  console.log(`  ${bold}NIELSEN UX USABILITY AUDIT - VERIFIABLE EVIDENCE AUDIT REPORT${reset}`);
  console.log(`${bold}================================================================================${reset}`);
  console.log(`  ${bold}Run Directory:${reset}  ${runDir}`);
  console.log(`  ${bold}Run ID:${reset}         ${summary?.runId || path.basename(runDir)}`);
  console.log(`  ${bold}Started At:${reset}     ${manifest?.startedAt || "N/A"}`);
  console.log(`  ${bold}Completed At:${reset}   ${manifest?.completedAt || "N/A"}`);
  console.log(`  ${bold}Overall Status:${reset} ${statusColor}${bold}${(summary?.status || "UNKNOWN").toUpperCase()}${reset} (${summary?.passed ?? 0}/${summary?.checks?.length ?? 0} checks passed)`);
  console.log(`  ${bold}AI Token Cost:${reset}  ${cyan}${bold}0 TOKENS${reset} (100% Native Playwright Sandbox Automation)`);
  console.log(`${bold}--------------------------------------------------------------------------------${reset}`);

  console.log(`  ${bold}CHECK EXECUTION TELEMETRY:${reset}`);
  if (summary?.checks && summary.checks.length > 0) {
    for (const check of summary.checks) {
      const checkPassed = check.status === "passed";
      const icon = checkPassed ? `${statusColor}[PASS]${reset}` : `${statusColor}[FAIL]${reset}`;
      const name = check.name.padEnd(24, " ");
      const ms = `${check.durationMs || 0}ms`.padStart(8, " ");
      const msg = check.message ? ` -> ${check.message}` : "";
      console.log(`    ${icon} ${name} ${ms}${msg}`);
      if (!checkPassed && check.logPath) {
        console.log(`           ${yellow}Log file:${reset} ${path.join(runDir, check.logPath)}`);
      }
    }
  } else {
    console.log("    No checks recorded in summary.json");
  }

  console.log(`${bold}--------------------------------------------------------------------------------${reset}`);
  console.log(`  ${bold}VERIFIABLE EVIDENCE ARTIFACTS ON DISK:${reset}`);

  const manifestHash = await getFileSha256(manifestPath);
  const summaryHash = await getFileSha256(summaryPath);

  console.log(`    * manifest.json:   [SHA256: ${manifestHash}]`);
  console.log(`    * summary.json:    [SHA256: ${summaryHash}]`);

  const runPngs = await findPngs(runDir);
  const baselinePngs = await findPngs(path.resolve(".sandbox", "visual-baselines"));

  let primaryScreenshot = null;

  if (runPngs.length > 0) {
    console.log(`\n    ${bold}Checkpoint Screenshots Captured (${runPngs.length}):${reset}`);
    for (const p of runPngs) {
      const s = await stat(p).catch(() => null);
      const sizeKb = s ? (s.size / 1024).toFixed(1) + " KB" : "unknown";
      const hash = await getFileSha256(p);
      console.log(`      - ${cyan}${path.basename(p)}${reset} (${sizeKb}, SHA256: ${hash})`);
      console.log(`        Path: ${p}`);
      if (!primaryScreenshot) primaryScreenshot = p;
    }
  } else {
    console.log(`    * No checkpoint screenshots in run directory.`);
  }

  if (baselinePngs.length > 0) {
    console.log(`\n    ${bold}Visual Baselines Stored (${baselinePngs.length}):${reset}`);
    for (const p of baselinePngs) {
      const s = await stat(p).catch(() => null);
      const sizeKb = s ? (s.size / 1024).toFixed(1) + " KB" : "unknown";
      console.log(`      - ${path.basename(p)} (${sizeKb})`);
      if (!primaryScreenshot) primaryScreenshot = p;
    }
  }

  console.log(`${bold}================================================================================${reset}`);

  if (options.launch && primaryScreenshot) {
    console.log(`\n  ${bold}Launching primary visual evidence:${reset} ${primaryScreenshot}`);
    if (process.platform === "win32") {
      exec(`start "" "${primaryScreenshot}"`);
    }
  }

  return {
    ok: isPassed,
    exitCode: isPassed ? 0 : 1,
    primaryScreenshot,
    runDir,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const launch = args.includes("--launch");
  const specificDir = args.find((a) => !a.startsWith("--"));
  const result = await reportEvidence(specificDir, { launch });
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/i, "$1"))) {
  await main();
}
