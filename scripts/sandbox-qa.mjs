#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, realpath, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";

const CONTEXT_POLICY =
  "Avoid sending unnecessary context. Pass only the requirement, acceptance criteria, affected file paths, current diff, and failing checks. Store complete logs and evidence as artifacts; reference them by path instead of repeating their contents.";

const REMOTE_PROFILE_TARGETS = Object.freeze({
  backend: "https://pepper-tix-pub-backend.zh4nwb.easypanel.host/api/docs",
  pubmaster: "https://pubmaster.spotlightus.org/es",
  nielsen: "https://nielsen.spotlightus.org/es",
  pageclone: "https://clone.spotlightus.org/es",
  admin: "https://admin.spotlightus.org",
});

function configuredTargets(env = process.env) {
  const isRemote = env.SANDBOX_REMOTE === "1";
  return [
    {
      id: "backend",
      container: env.SANDBOX_BACKEND_CONTAINER || "pub-backend",
      url: env.SANDBOX_BACKEND_URL || (isRemote ? REMOTE_PROFILE_TARGETS.backend : "http://127.0.0.1:3007/api/docs"),
    },
    {
      id: "pubmaster",
      container: env.SANDBOX_PUBMASTER_CONTAINER || "publications-frontend",
      url: env.SANDBOX_PUBMASTER_URL || (isRemote ? REMOTE_PROFILE_TARGETS.pubmaster : "http://127.0.0.1:3008/es"),
    },
    {
      id: "nielsen",
      container:
        env.SANDBOX_NIELSEN_CONTAINER || "publications-frontend-nielsen",
      url: env.SANDBOX_NIELSEN_URL || (isRemote ? REMOTE_PROFILE_TARGETS.nielsen : "http://127.0.0.1:3014/es"),
    },
    {
      id: "pageclone",
      container:
        env.SANDBOX_PAGECLONE_CONTAINER || "publications-frontend-clone",
      url: env.SANDBOX_PAGECLONE_URL || (isRemote ? REMOTE_PROFILE_TARGETS.pageclone : "http://127.0.0.1:3015/es"),
    },
    {
      id: "admin",
      container:
        env.SANDBOX_ADMIN_CONTAINER || "publications-admin-portal",
      url: env.SANDBOX_ADMIN_URL || (isRemote ? REMOTE_PROFILE_TARGETS.admin : "http://127.0.0.1:3009"),
    },
  ];
}

function nextValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(flag + " requires a value.");
  }
  return value;
}

export function parseArgs(argv) {
  if (argv.includes("--help") || argv.includes("-h")) return { help: true };

  const command = argv[0];
  if (!["status", "verify", "run"].includes(command)) {
    throw new Error("Command must be status, verify, or run.");
  }

  const options = {
    command,
    outputDir: path.resolve(".sandbox", "runs"),
    timeoutMs: 10_000,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--requirement") {
      options.requirement = nextValue(argv, index, flag);
      index += 1;
    } else if (flag === "--run-id") {
      options.runId = nextValue(argv, index, flag);
      index += 1;
    } else if (flag === "--output-dir") {
      options.outputDir = path.resolve(nextValue(argv, index, flag));
      index += 1;
    } else if (flag === "--timeout-ms") {
      options.timeoutMs = Number(nextValue(argv, index, flag));
      index += 1;
    } else if (flag === "--visual-plan") {
      options.visualPlan = nextValue(argv, index, flag);
      index += 1;
    } else if (flag === "--visual-baseline-dir") {
      options.visualBaselineDir = path.resolve(nextValue(argv, index, flag));
      index += 1;
    } else if (flag === "--update-visual-baselines") {
      options.updateVisualBaselines = true;
    } else if (flag === "--remote") {
      options.remote = true;
    } else if (flag === "--target") {
      options.target = nextValue(argv, index, flag);
      index += 1;
    } else if (flag === "--url") {
      options.url = nextValue(argv, index, flag);
      options.remote = true;
      index += 1;
    } else {
      throw new Error("Unknown option: " + flag);
    }
  }

  if (process.env.SANDBOX_REMOTE === "1") {
    options.remote = true;
  }

  if (options.target && !["backend", "pubmaster", "nielsen", "pageclone", "admin"].includes(options.target)) {
    throw new Error("Unknown target: " + options.target + ". Allowed targets: backend, pubmaster, nielsen, pageclone, admin.");
  }

  if (options.url) {
    try {
      const parsed = new URL(options.url);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error("--url must be a valid HTTP or HTTPS URL.");
    }
  }

  if (["verify", "run"].includes(command) && !options.requirement) {
    throw new Error(command + " requires --requirement <path>.");
  }
  if (
    (options.visualPlan || options.visualBaselineDir || options.updateVisualBaselines) &&
    command !== "run"
  ) {
    throw new Error("Visual options are only available for run.");
  }
  if ((options.visualBaselineDir || options.updateVisualBaselines) && !options.visualPlan) {
    throw new Error("Visual baseline options require --visual-plan <path>.");
  }
  if (
    !Number.isInteger(options.timeoutMs) ||
    options.timeoutMs < 100 ||
    options.timeoutMs > 120_000
  ) {
    throw new Error("--timeout-ms must be an integer from 100 to 120000.");
  }
  if (
    options.runId &&
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u.test(options.runId)
  ) {
    throw new Error("--run-id contains unsafe characters.");
  }

  return options;
}

export function createRunId(now = new Date(), uuid = randomUUID()) {
  return (
    now.toISOString().replace(/[:.]/gu, "-") + "-" + uuid.slice(0, 8)
  );
}

function cleanMessage(value) {
  return String(value || "Unknown failure")
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 500);
}

function commandLog(command, args, result) {
  return [
    "$ " + command + " " + args.join(" "),
    "exitCode=" + result.code,
    "timedOut=" + result.timedOut,
    "--- stdout ---",
    result.stdout,
    "--- stderr ---",
    result.stderr,
  ].join("\n");
}

export function executeCommand(command, args, { timeoutMs = 10_000, env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      windowsHide: true,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, timeoutMs);

    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr, timedOut });
    });
  });
}

export async function hashRequirement(requirementPath) {
  const resolved = await realpath(path.resolve(requirementPath));
  const metadata = await stat(resolved);
  if (!metadata.isFile()) {
    throw new Error("Requirement path must point to a file.");
  }

  const hash = createHash("sha256");
  for await (const chunk of createReadStream(resolved)) hash.update(chunk);

  const relative = path.relative(process.cwd(), resolved);
  const safePath =
    relative && !relative.startsWith(".." + path.sep)
      ? relative.split(path.sep).join("/")
      : path.basename(resolved);

  return {
    path: safePath,
    bytes: metadata.size,
    sha256: hash.digest("hex"),
  };
}

async function runCheck(name, action) {
  const startedAt = Date.now();
  try {
    const result = await action();
    return {
      name,
      status: result.ok ? "passed" : "failed",
      durationMs: Date.now() - startedAt,
      message: cleanMessage(result.message),
      log: result.log || "",
    };
  } catch (error) {
    return {
      name,
      status: "failed",
      durationMs: Date.now() - startedAt,
      message: cleanMessage(error.message),
      log: error.stack || error.message,
    };
  }
}

function daemonCheck(dependencies, timeoutMs) {
  return runCheck("docker:daemon", async () => {
    const args = ["info", "--format", "{{json .ServerVersion}}"];
    const result = await dependencies.runCommand("docker", args, { timeoutMs });
    const log = commandLog("docker", args, result);
    return {
      ok: result.code === 0 && !result.timedOut,
      message:
        result.stdout.trim() ||
        result.stderr ||
        "Docker daemon is unavailable.",
      log,
    };
  });
}

function startContainersCheck(targets, dependencies, timeoutMs) {
  return runCheck("prepare:containers", async () => {
    const args = ["start", ...targets.map((target) => target.container)];
    const result = await dependencies.runCommand("docker", args, { timeoutMs });
    const log = commandLog("docker", args, result);
    return {
      ok: result.code === 0 && !result.timedOut,
      message:
        result.code === 0
          ? "Required containers started."
          : result.stderr || "Unable to start required containers.",
      log,
    };
  });
}

function tunnelCheck(dependencies, timeoutMs) {
  return runCheck("prepare:tunnel", async () => {
    const scriptPath = path.resolve("scripts", "sync-ngrok-tunnel.js");
    const args = [scriptPath, "--background"];
    const result = await dependencies.runCommand(process.execPath, args, {
      timeoutMs: Math.max(timeoutMs, 20_000),
    });
    const log = commandLog(process.execPath, args, result);
    return {
      ok: result.code === 0 && !result.timedOut,
      message:
        result.code === 0
          ? "Backend tunnel started and synchronized."
          : result.stderr || "Unable to establish backend tunnel.",
      log,
    };
  });
}

function containerCheck(target, dependencies, timeoutMs) {
  return runCheck("container:" + target.id, async () => {
    const args = [
      "inspect",
      "--format",
      "{{json .State}}",
      target.container,
    ];
    const result = await dependencies.runCommand("docker", args, { timeoutMs });
    const log = commandLog("docker", args, result);
    if (result.code !== 0 || result.timedOut) {
      return {
        ok: false,
        message: result.stderr || "Docker inspect failed.",
        log,
      };
    }

    const state = JSON.parse(result.stdout.trim());
    const health = state.Health?.Status;
    return {
      ok: state.Running === true && health !== "unhealthy",
      message:
        "running=" +
        state.Running +
        (health ? " health=" + health : ""),
      log,
    };
  });
}

function nodeCheck(target, dependencies, timeoutMs) {
  return runCheck("node:" + target.id, async () => {
    const args = ["exec", target.container, "node", "--version"];
    const result = await dependencies.runCommand("docker", args, { timeoutMs });
    const log = commandLog("docker", args, result);
    const version = result.stdout.trim();
    return {
      ok:
        result.code === 0 &&
        !result.timedOut &&
        /^v24\./u.test(version),
      message: version || result.stderr || "Unable to read Node version.",
      log,
    };
  });
}

function httpCheck(target, dependencies, timeoutMs) {
  return runCheck("http:" + target.id, async () => {
    const deadline = Date.now() + timeoutMs;
    let lastResponse = null;
    let lastError = null;

    do {
      try {
        const remaining = Math.max(1, deadline - Date.now());
        lastResponse = await dependencies.fetchFn(target.url, {
          redirect: "follow",
          signal: AbortSignal.timeout(Math.min(2_000, remaining)),
        });
        if (lastResponse.ok) break;
      } catch (error) {
        lastError = error;
      }

      if (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
    } while (Date.now() < deadline);

    if (!lastResponse && lastError) throw lastError;

    const status = lastResponse?.status || "unavailable";
    return {
      ok: lastResponse?.ok === true,
      message: "HTTP " + status,
      log: "GET " + target.url + "\nHTTP " + status + "\n",
    };
  });
}

function visualCheck(options, runDirectory, dependencies) {
  return runCheck("visual:playwright", async () => {
    const cliPath = path.resolve("node_modules", "@playwright", "test", "cli.js");
    const configPath = path.resolve("playwright.sandbox.config.mjs");
    const args = [cliPath, "test", "--config", configPath];
    if (options.updateVisualBaselines) args.push("--update-snapshots");
    const env = {
      ...process.env,
      ...dependencies.env,
      SANDBOX_VISUAL_PLAN: await realpath(path.resolve(options.visualPlan)),
      SANDBOX_QA_RUN_DIR: runDirectory,
      SANDBOX_VISUAL_BASELINE_DIR: options.visualBaselineDir || path.resolve("tests", "sandbox-visual", "baselines"),
    };
    if (options.updateVisualBaselines) env.SANDBOX_UPDATE_VISUAL_BASELINES = "1";
    else delete env.SANDBOX_UPDATE_VISUAL_BASELINES;
    if (options.remote || dependencies.env.SANDBOX_REMOTE === "1") {
      env.SANDBOX_REMOTE = "1";
    }
    if (options.target && options.url) {
      const upper = options.target.toUpperCase();
      try {
        const parsed = new URL(options.url);
        env["SANDBOX_" + upper + "_ORIGIN"] = parsed.origin;
        env["SANDBOX_" + upper + "_URL"] = options.url;
      } catch {
        // ignore
      }
    }
    const result = await dependencies.runCommand(process.execPath, args, {
      timeoutMs: Math.max(options.timeoutMs, 600_000),
      env,
    });
    return {
      ok: result.code === 0 && !result.timedOut,
      message: result.code === 0 && !result.timedOut
        ? "Visual Playwright checks passed."
        : "Visual Playwright checks failed; inspect the visual check log.",
      log: commandLog(process.execPath, args, result),
    };
  });
}

async function writeJsonAtomic(filePath, value, uuidFactory) {
  const temporaryPath = filePath + ".tmp-" + uuidFactory();
  await writeFile(
    temporaryPath,
    JSON.stringify(value, null, 2) + "\n",
    "utf8",
  );
  await rename(temporaryPath, filePath);
}

function safeLogName(name) {
  return name.replace(/[^A-Za-z0-9._-]/gu, "-") + ".log";
}

export async function runWorkflow(options, overrides = {}) {
  const isRemote = Boolean(options.remote || overrides.env?.SANDBOX_REMOTE === "1" || process.env.SANDBOX_REMOTE === "1");
  const mergedEnv = {
    ...process.env,
    ...(overrides.env || {}),
  };
  if (isRemote) {
    mergedEnv.SANDBOX_REMOTE = "1";
  }
  const dependencies = {
    fetchFn: overrides.fetchFn || globalThis.fetch,
    now: overrides.now || (() => new Date()),
    runCommand: overrides.runCommand || executeCommand,
    uuid: overrides.uuid || randomUUID,
    env: mergedEnv,
  };
  let targets = overrides.targets ? [...overrides.targets] : configuredTargets(mergedEnv);

  if (options.target) {
    targets = targets.filter((target) => target.id === options.target);
    if (targets.length === 0) {
      throw new Error("Unknown target: " + options.target);
    }
    if (options.url) {
      targets[0].url = options.url;
    }
  } else if (options.url) {
    const match = targets.find((t) => options.url.includes(t.id));
    if (match) {
      match.url = options.url;
    }
  }

  const runId =
    options.runId ||
    createRunId(dependencies.now(), dependencies.uuid());
  const runDirectory = path.resolve(options.outputDir, runId);
  const logsDirectory = path.join(runDirectory, "logs");
  const startedAt = dependencies.now().toISOString();
  const requirement = options.requirement
    ? await hashRequirement(options.requirement)
    : null;
  const visualPlan = options.visualPlan
    ? await hashRequirement(options.visualPlan)
    : null;

  await mkdir(options.outputDir, { recursive: true });
  try {
    await mkdir(runDirectory);
  } catch (error) {
    if (error.code === "EEXIST") {
      throw new Error("Run evidence directory already exists: " + runDirectory);
    }
    throw error;
  }
  await mkdir(logsDirectory);

  const checksWithLogs = [];

  if (isRemote) {
    const httpChecks = targets.map((target) => httpCheck(target, dependencies, options.timeoutMs));
    checksWithLogs.push(...(await Promise.all(httpChecks)));
  } else {
    const daemon = await daemonCheck(dependencies, options.timeoutMs);
    checksWithLogs.push(daemon);

    if (daemon.status === "passed") {
      if (options.command === "run") {
        checksWithLogs.push(
          await startContainersCheck(
            targets,
            dependencies,
            options.timeoutMs,
          ),
        );
        checksWithLogs.push(
          await tunnelCheck(dependencies, options.timeoutMs),
        );
      }

      const promises = targets.flatMap((target) => {
        const checks = [
          containerCheck(target, dependencies, options.timeoutMs),
        ];
        if (target.id !== "admin") {
          checks.push(nodeCheck(target, dependencies, options.timeoutMs));
        }
        if (["verify", "run"].includes(options.command)) {
          checks.push(httpCheck(target, dependencies, options.timeoutMs));
        }
        return checks;
      });
      checksWithLogs.push(...(await Promise.all(promises)));
    }
  }

  if (options.command === "run" && options.visualPlan) {
    checksWithLogs.push(
      checksWithLogs.every((check) => check.status === "passed")
        ? await visualCheck(options, runDirectory, dependencies)
        : {
            name: "visual:playwright",
            status: "skipped",
            durationMs: 0,
            message: "Prerequisite checks failed.",
            log: "Visual Playwright checks skipped because prerequisite checks failed.\n",
          },
    );
  }

  const checks = [];
  for (const check of checksWithLogs) {
    const logFile = path.join(logsDirectory, safeLogName(check.name));
    const log = check.log.endsWith("\n")
      ? check.log
      : check.log + "\n";
    await writeFile(logFile, log, "utf8");
    const publicCheck = { ...check };
    delete publicCheck.log;
    publicCheck.logPath = path
      .relative(runDirectory, logFile)
      .split(path.sep)
      .join("/");
    checks.push(publicCheck);
  }

  const failed = checks.filter((check) => check.status === "failed");
  const completedAt = dependencies.now().toISOString();
  const manifestPath = path.join(runDirectory, "manifest.json");
  const summaryPath = path.join(runDirectory, "summary.json");
  const manifest = {
    schemaVersion: 1,
    runId,
    command: options.command,
    startedAt,
    completedAt,
    requirement,
    visualPlan,
    contextPolicy: CONTEXT_POLICY,
    runtime: { node: process.version, platform: process.platform },
    targets: targets.map(({ id, container, url }) => ({
      id,
      container,
      url,
    })),
  };
  const summary = {
    schemaVersion: 1,
    runId,
    status: failed.length === 0 ? "passed" : "failed",
    passed: checks.filter((check) => check.status === "passed").length,
    failed: failed.length,
    skipped: checks.filter((check) => check.status === "skipped").length,
    checks,
    artifacts: {
      runDirectory,
      manifest: manifestPath,
      summary: summaryPath,
      logsDirectory,
    },
  };

  await writeJsonAtomic(manifestPath, manifest, dependencies.uuid);
  await writeJsonAtomic(summaryPath, summary, dependencies.uuid);

  return {
    exitCode: failed.length === 0 ? 0 : 1,
    runDirectory,
    summary,
  };
}

export function helpText() {
  return [
    "Usage:",
    "  node scripts/sandbox-qa.mjs status [options]",
    "  node scripts/sandbox-qa.mjs verify --requirement <path> [options]",
    "  node scripts/sandbox-qa.mjs run --requirement <path> [options]",
    "",
    "Options:",
    "  --run-id <id>       Filesystem-safe evidence run identifier",
    "  --output-dir <path> Evidence root (default: .sandbox/runs)",
    "  --timeout-ms <ms>   Per-check timeout from 100 to 120000",
    "  --visual-plan <path>      Run local Playwright scenarios from a plan",
    "  --visual-baseline-dir <path>  Snapshot baseline directory",
    "  --update-visual-baselines  Explicitly update visual snapshots",
  ].join("\n");
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(helpText());
      return;
    }

    const result = await runWorkflow(options);
    const failures = result.summary.checks
      .filter((check) => check.status === "failed")
      .map((check) => check.name);
    console.log(
      "Sandbox QA: " +
        result.summary.status.toUpperCase() +
        " (" +
        result.summary.passed +
        "/" +
        result.summary.checks.length +
        " checks)",
    );
    if (failures.length > 0) {
      console.log("Failed: " + failures.join(", "));
    }
    console.log("Evidence: " + result.runDirectory);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error("sandbox-qa failed: " + cleanMessage(error.message));
    process.exitCode = 2;
  }
}

const isMain = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (isMain) await main();

