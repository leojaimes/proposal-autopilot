import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parseArgs, runWorkflow } from "./sandbox-qa.mjs";

const targets = [
  {
    id: "backend",
    container: "test-backend",
    url: "http://127.0.0.1:3999/health",
  },
];

function fakeCommand(_command, args) {
  if (args[0] === "inspect") {
    return Promise.resolve({
      code: 0,
      stdout: "{\"Running\":true,\"Health\":{\"Status\":\"healthy\"}}\n",
      stderr: "",
      timedOut: false,
    });
  }
  return Promise.resolve({
    code: 0,
    stdout: "v24.15.0\n",
    stderr: "",
    timedOut: false,
  });
}

test("parseArgs requires a requirement for verify and run", () => {
  assert.throws(() => parseArgs(["verify"]), /requires --requirement/u);
  assert.throws(() => parseArgs(["run"]), /requires --requirement/u);
  assert.equal(parseArgs(["status"]).command, "status");
});

test("visual options require run and a plan", () => {
  assert.throws(() => parseArgs(["verify", "--requirement", "requirement.md", "--visual-plan", "plan.json"]), /only available for run/u);
  assert.throws(() => parseArgs(["run", "--requirement", "requirement.md", "--update-visual-baselines"]), /require --visual-plan/u);
  const options = parseArgs(["run", "--requirement", "requirement.md", "--visual-plan", "plan.json", "--visual-baseline-dir", "baseline", "--update-visual-baselines"]);
  assert.equal(options.visualPlan, "plan.json");
  assert.equal(options.updateVisualBaselines, true);
  assert.equal(options.visualBaselineDir, path.resolve("baseline"));
});

test("verify persists evidence without requirement contents", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "sandbox-qa-"),
  );
  try {
    const requirementPath = path.join(
      temporaryDirectory,
      "requirement.md",
    );
    await writeFile(
      requirementPath,
      "SECRET REQUIREMENT CONTENT\n",
      "utf8",
    );

    const result = await runWorkflow(
      {
        command: "verify",
        requirement: requirementPath,
        outputDir: temporaryDirectory,
        runId: "passing-run",
        timeoutMs: 1_000,
      },
      {
        fetchFn: async () => ({ ok: true, status: 200 }),
        runCommand: fakeCommand,
        targets,
        uuid: () => "test-uuid",
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(result.summary.status, "passed");
    assert.equal(result.summary.checks.length, 4);
    const manifest = await readFile(
      path.join(
        temporaryDirectory,
        "passing-run",
        "manifest.json",
      ),
      "utf8",
    );
    assert.doesNotMatch(manifest, /SECRET REQUIREMENT CONTENT/u);
    assert.match(manifest, /"sha256"/u);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});

test("verify fails when an endpoint is unhealthy", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "sandbox-qa-"),
  );
  try {
    const requirementPath = path.join(
      temporaryDirectory,
      "requirement.md",
    );
    await writeFile(requirementPath, "Acceptance criteria\n", "utf8");

    const result = await runWorkflow(
      {
        command: "verify",
        requirement: requirementPath,
        outputDir: temporaryDirectory,
        runId: "failing-run",
        timeoutMs: 1_000,
      },
      {
        fetchFn: async () => ({ ok: false, status: 503 }),
        runCommand: fakeCommand,
        targets,
        uuid: () => "test-uuid",
      },
    );

    assert.equal(result.exitCode, 1);
    assert.equal(result.summary.status, "failed");
    assert.equal(result.summary.failed, 1);
    assert.equal(result.summary.checks.at(-1).name, "http:backend");
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
});



test('run starts containers and tunnel before environment checks', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'sandbox-qa-'));
  try {
    const requirement = path.join(outputDir, 'requirement.md');
    await writeFile(requirement, 'Acceptance criteria\n', 'utf8');
    const calls = [];
    const runCommand = async (command, args) => {
      calls.push({ command, args });
      if (command === 'docker' && args[0] === 'inspect') {
        return { code: 0, stdout: '{"Running":true}\n', stderr: '', timedOut: false };
      }
      if (command === 'docker' && args[0] === 'exec') {
        return { code: 0, stdout: 'v24.15.0\n', stderr: '', timedOut: false };
      }
      return { code: 0, stdout: 'ok\n', stderr: '', timedOut: false };
    };
    const result = await runWorkflow(
      { command: 'run', requirement, outputDir, runId: 'orchestrated-run', timeoutMs: 1000 },
      { fetchFn: async () => ({ ok: true, status: 200 }), runCommand, targets, uuid: () => 'test-uuid' },
    );
    const startIndex = calls.findIndex(({ command, args }) => command === 'docker' && args[0] === 'start');
    const tunnelIndex = calls.findIndex(({ args }) => args.includes('--background'));
    const inspectIndex = calls.findIndex(({ command, args }) => command === 'docker' && args[0] === 'inspect');
    assert.equal(result.exitCode, 0);
    assert.equal(result.summary.checks.length, 6);
    assert.ok(startIndex >= 0);
    assert.ok(tunnelIndex > startIndex);
    assert.ok(inspectIndex > tunnelIndex);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});



test('status reports only the daemon failure when Docker is unavailable', async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), 'sandbox-qa-'));
  try {
    const result = await runWorkflow(
      { command: 'status', outputDir, runId: 'daemon-failure', timeoutMs: 100 },
      {
        runCommand: async () => ({ code: 1, stdout: '', stderr: 'Docker daemon unavailable', timedOut: false }),
        targets,
        uuid: () => 'test-uuid',
      },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.summary.checks.length, 1);
    assert.equal(result.summary.checks[0].name, 'docker:daemon');
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("run executes local visual Playwright after every prerequisite and keeps plan contents out of evidence", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    const visualPlan = path.join(outputDir, "visual-plan.json");
    const visualBaselineDir = path.join(outputDir, "baselines");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");
    await writeFile(visualPlan, '{"secret":"NEVER PRINT PLAN CONTENT"}\n', "utf8");
    const events = [];
    const runCommand = async (command, args, commandOptions) => {
      events.push({ command, args, commandOptions });
      if (command === "docker" && args[0] === "inspect") {
        return { code: 0, stdout: '{"Running":true}\n', stderr: "", timedOut: false };
      }
      if (command === "docker" && args[0] === "exec") {
        return { code: 0, stdout: "v24.15.0\n", stderr: "", timedOut: false };
      }
      return { code: 0, stdout: "ok\n", stderr: "", timedOut: false };
    };
    const result = await runWorkflow(
      { command: "run", requirement, visualPlan, visualBaselineDir, outputDir, runId: "visual-run", timeoutMs: 1_000 },
      { fetchFn: async () => { events.push({ type: "http" }); return { ok: true, status: 200 }; }, runCommand, targets, uuid: () => "test-uuid" },
    );
    const visualIndex = events.findIndex(({ args }) => args?.includes("test"));
    assert.ok(visualIndex > events.findIndex(({ type }) => type === "http"));
    assert.equal(visualIndex, events.length - 1);
    const visual = events[visualIndex];
    assert.equal(visual.command, process.execPath);
    assert.match(visual.args[0], /node_modules[\\/]@playwright[\\/]test[\\/]cli\.js$/u);
    assert.equal(visual.args.includes("--update-snapshots"), false);
    assert.equal(visual.commandOptions.env.SANDBOX_VISUAL_PLAN, visualPlan);
    assert.equal(visual.commandOptions.env.SANDBOX_QA_RUN_DIR, path.join(outputDir, "visual-run"));
    assert.equal(visual.commandOptions.env.SANDBOX_VISUAL_BASELINE_DIR, visualBaselineDir);
    assert.equal(visual.commandOptions.env.SANDBOX_UPDATE_VISUAL_BASELINES, undefined);
    assert.equal(visual.args.includes("--reporter=line"), false);
    assert.equal(visual.args.at(-1), path.resolve("playwright.sandbox.config.mjs"));
    assert.equal(result.summary.checks.at(-1).name, "visual:playwright");
    assert.equal(result.summary.checks.at(-1).status, "passed");
    const runDir = path.join(outputDir, "visual-run");
    const manifest = JSON.parse(await readFile(path.join(runDir, "manifest.json"), "utf8"));
    assert.deepEqual(Object.keys(manifest.visualPlan).sort(), ["bytes", "path", "sha256"]);
    assert.equal(manifest.visualPlan.bytes, Buffer.byteLength('{"secret":"NEVER PRINT PLAN CONTENT"}\n'));
    const summary = await readFile(path.join(runDir, "summary.json"), "utf8");
    const log = await readFile(path.join(runDir, "logs", "visual-playwright.log"), "utf8");
    assert.doesNotMatch(JSON.stringify(manifest) + summary + log, /NEVER PRINT PLAN CONTENT/u);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("run skips visual Playwright when a prerequisite fails", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    const visualPlan = path.join(outputDir, "visual-plan.json");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");
    await writeFile(visualPlan, "{}\n", "utf8");
    const calls = [];
    const result = await runWorkflow(
      { command: "run", requirement, visualPlan, outputDir, runId: "skipped-visual", timeoutMs: 1_000 },
      {
        fetchFn: async () => ({ ok: true, status: 200 }),
        runCommand: async (command, args) => {
          calls.push({ command, args });
          if (command === "docker" && args[0] === "start") return { code: 1, stdout: "", stderr: "Cannot start", timedOut: false };
          if (command === "docker" && args[0] === "inspect") return { code: 0, stdout: '{"Running":true}\n', stderr: "", timedOut: false };
          if (command === "docker" && args[0] === "exec") return { code: 0, stdout: "v24.15.0\n", stderr: "", timedOut: false };
          return { code: 0, stdout: "ok\n", stderr: "", timedOut: false };
        },
        targets,
        uuid: () => "test-uuid",
      },
    );
    assert.equal(result.exitCode, 1);
    assert.equal(result.summary.skipped, 1);
    assert.equal(result.summary.checks.at(-1).status, "skipped");
    assert.equal(calls.some(({ args }) => args.includes("test")), false);
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("run updates visual baselines only with the explicit flag", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    const visualPlan = path.join(outputDir, "visual-plan.json");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");
    await writeFile(visualPlan, "{}\n", "utf8");
    let visualCall;
    await runWorkflow(
      { command: "run", requirement, visualPlan, updateVisualBaselines: true, outputDir, runId: "update-visual", timeoutMs: 1_000 },
      {
        fetchFn: async () => ({ ok: true, status: 200 }),
        runCommand: async (command, args, commandOptions) => {
          if (args.includes("test")) visualCall = { command, args, commandOptions };
          if (command === "docker" && args[0] === "inspect") return { code: 0, stdout: '{"Running":true}\n', stderr: "", timedOut: false };
          if (command === "docker" && args[0] === "exec") return { code: 0, stdout: "v24.15.0\n", stderr: "", timedOut: false };
          return { code: 0, stdout: "ok\n", stderr: "", timedOut: false };
        },
        targets,
        uuid: () => "test-uuid",
      },
    );
    assert.ok(visualCall.args.includes("--update-snapshots"));
    assert.equal(visualCall.commandOptions.env.SANDBOX_UPDATE_VISUAL_BASELINES, "1");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("rejects a reused run id before stale checkpoints can enter a new run", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    const staleCheckpoint = path.join(outputDir, "reused-run", "visual", "checkpoints", "stale.png");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");
    await mkdir(path.dirname(staleCheckpoint), { recursive: true });
    await writeFile(staleCheckpoint, "stale checkpoint", "utf8");
    let commandCalled = false;
    await assert.rejects(
      runWorkflow(
        { command: "run", requirement, outputDir, runId: "reused-run", timeoutMs: 1_000 },
        { runCommand: async () => { commandCalled = true; throw new Error("Unexpected command"); }, targets },
      ),
      /Run evidence directory already exists/u,
    );
    assert.equal(commandCalled, false);
    assert.equal(await readFile(staleCheckpoint, "utf8"), "stale checkpoint");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("parseArgs supports --remote, --target, and --url", () => {
  const options = parseArgs([
    "run",
    "--requirement", "requirement.md",
    "--visual-plan", "plan.json",
    "--remote",
    "--target", "nielsen",
    "--url", "https://nielsen.spotlightus.org/es",
  ]);
  assert.equal(options.remote, true);
  assert.equal(options.target, "nielsen");
  assert.equal(options.url, "https://nielsen.spotlightus.org/es");

  assert.throws(
    () => parseArgs(["run", "--requirement", "req.md", "--target", "invalid"]),
    /Unknown target: invalid/u,
  );
  assert.throws(
    () => parseArgs(["run", "--requirement", "req.md", "--url", "not-a-url"]),
    /--url must be a valid HTTP or HTTPS URL/u,
  );
});

test("runWorkflow with remote mode skips Docker daemon and verifies HTTP targets", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");

    let dockerCalled = false;
    const fetchCalls = [];

    const result = await runWorkflow(
      {
        command: "verify",
        requirement,
        outputDir,
        runId: "remote-run",
        remote: true,
        target: "nielsen",
        url: "https://nielsen.spotlightus.org/es",
        timeoutMs: 1_000,
      },
      {
        fetchFn: async (url) => {
          fetchCalls.push(url);
          return { ok: true, status: 200 };
        },
        runCommand: async () => {
          dockerCalled = true;
          throw new Error("Docker should not be invoked in remote mode");
        },
        uuid: () => "test-uuid",
      },
    );

    assert.equal(result.exitCode, 0);
    assert.equal(dockerCalled, false);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0], "https://nielsen.spotlightus.org/es");
    assert.equal(result.summary.status, "passed");
    assert.equal(result.summary.checks.length, 1);
    assert.equal(result.summary.checks[0].name, "http:nielsen");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("runWorkflow confines an unqualified remote URL to the visual plan's sole profile", async () => {
  const outputDir = await mkdtemp(path.join(os.tmpdir(), "sandbox-qa-"));
  try {
    const requirement = path.join(outputDir, "requirement.md");
    const visualPlan = path.join(outputDir, "plan.json");
    await writeFile(requirement, "Acceptance criteria\n", "utf8");
    await writeFile(visualPlan, JSON.stringify({ version: 2, scenarios: [{ profile: "nielsen" }] }), "utf8");
    const fetchCalls = [];

    const result = await runWorkflow(
      {
        command: "verify",
        requirement,
        visualPlan,
        outputDir,
        runId: "remote-plan-run",
        remote: true,
        url: "https://proposal-autopilot.zh4nwb.easypanel.host",
        timeoutMs: 1_000,
      },
      {
        fetchFn: async (url) => {
          fetchCalls.push(url);
          return { ok: true, status: 200 };
        },
        uuid: () => "test-uuid",
      },
    );

    assert.equal(result.exitCode, 0);
    assert.deepEqual(fetchCalls, ["https://proposal-autopilot.zh4nwb.easypanel.host"]);
    assert.equal(result.summary.checks[0].name, "http:nielsen");
  } finally {
    await rm(outputDir, { recursive: true, force: true });
  }
});


