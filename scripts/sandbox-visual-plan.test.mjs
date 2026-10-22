import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import visualConfig from "../playwright.sandbox.config.mjs";
import { assertSameVisualOrigin, loadVisualPlan, requireApprovedBaseline, validateVisualPlan } from "./sandbox-visual-plan.mjs";

function validPlan(overrides = {}) {
  return {
    version: 1,
    scenarios: [{
      id: "dashboard-ready",
      checkpoint: "The user can see the loaded dashboard and start working.",
      profile: "pubmaster",
      path: "/dashboard",
    }],
    ...overrides,
  };
}

function validPlanV2(overrides = {}) {
  return {
    version: 2,
    scenarios: [{
      id: "dashboard-flow",
      profile: "pubmaster",
      steps: [
        { action: "goto", path: "/dashboard" },
        { action: "screenshot", id: "dashboard-ready", checkpoint: "Dashboard is ready." },
      ],
    }],
    ...overrides,
  };
}

function v2Scenario(overrides = {}) {
  return { ...validPlanV2().scenarios[0], ...overrides };
}

function validateV2(plan = validPlanV2(), env = {}, cwd = process.cwd()) {
  return validateVisualPlan(plan, { env, cwd });
}

test("v1 normalized shape and baseline id remain unchanged", () => {
  const result = validateVisualPlan(validPlan(), { env: {} });
  assert.deepEqual(result, {
    version: 1,
    viewport: { width: 1440, height: 900 },
    maxDiffPixels: 0,
    failOnConsoleErrors: false,
    storageState: null,
    scenarios: [{
      id: "dashboard-ready",
      checkpoint: "The user can see the loaded dashboard and start working.",
      profile: "pubmaster",
      path: "/dashboard",
      url: "http://127.0.0.1:3008/dashboard",
      fullPage: true,
      waitForSelector: null,
      maskSelectors: [],
      maxDiffPixels: 0,
    }],
  });
});

test("v2 normalizes deterministic actions and keeps only env references", () => {
  const plan = validPlanV2({
    maxDiffPixels: 5,
    stepTimeoutMs: 1500,
    scenarioTimeoutMs: 45000,
    scenarios: [v2Scenario({
      maskSelectors: [".clock"],
      steps: [
        { action: "goto", path: "/dashboard?tab=active" },
        { action: "click", selector: "button.open" },
        { action: "fill", selector: "input[name=email]", valueFromEnv: "VISUAL_TEST_EMAIL", timeoutMs: 2000 },
        { action: "waitFor", selector: ".loaded", state: "visible" },
        { action: "screenshot", id: "loaded", checkpoint: "Loaded content is visible." },
        { action: "screenshot", id: "detail", checkpoint: "Detail is visible.", maskSelectors: [".avatar"], fullPage: false, maxDiffPixels: 8 },
      ],
    })],
  });
  const result = validateV2(plan, { VISUAL_TEST_EMAIL: "PRIVATE VALUE" });
  assert.equal(result.version, 2);
  assert.equal(result.stepTimeoutMs, 1500);
  assert.equal(result.scenarioTimeoutMs, 45000);
  assert.equal(result.scenarios[0].origin, "http://127.0.0.1:3008");
  assert.equal(result.scenarios[0].steps[0].url, "http://127.0.0.1:3008/dashboard?tab=active");
  assert.deepEqual(result.scenarios[0].steps[2], {
    action: "fill", selector: "input[name=email]", valueFromEnv: "VISUAL_TEST_EMAIL", timeoutMs: 2000,
  });
  assert.deepEqual(result.scenarios[0].steps[4].maskSelectors, [".clock"]);
  assert.deepEqual(result.scenarios[0].steps[5].maskSelectors, [".avatar"]);
  assert.equal(result.scenarios[0].steps[4].maxDiffPixels, 5);
  assert.equal(result.scenarios[0].steps[5].fullPage, false);
  assert.equal(result.scenarios[0].steps[4].captureOnly, false);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE VALUE/u);
});

test("v2 confines API persistence assertions to the selected profile origin", () => {
  const steps = [
    { action: "goto", path: "/" },
    {
      action: "apiAssert",
      path: "/api/config/workspace",
      status: 200,
      arrayPath: "/positioningProfiles",
      expected: { isActive: true, offerHeadline: { valueFromEnv: "TEST_OFFER" } },
      minArrayLengths: { proofStories: 6 },
    },
    { action: "screenshot", id: "persisted", checkpoint: "Persisted profile is ready." },
  ];
  const result = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] }));
  assert.deepEqual(result.scenarios[0].steps[1], {
    action: "apiAssert",
    url: "http://127.0.0.1:3008/api/config/workspace",
    status: 200,
    arrayPath: "/positioningProfiles",
    expected: { isActive: true, offerHeadline: { valueFromEnv: "TEST_OFFER" } },
    minArrayLengths: { proofStories: 6 },
    timeoutMs: 10000,
  });
  const unsafeSteps = [steps[0], { ...steps[1], path: "//outside.example" }, steps[2]];
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: unsafeSteps })] })), /path/u);
});

test("v2 captures a profile ID only from the same-origin creating response", () => {
  const steps = [
    { action: "goto", path: "/" },
    {
      action: "click",
      selector: "button.activate",
      captureResponse: {
        path: "/api/config/full-profile",
        method: "PUT",
        status: 200,
        arrayPath: "/positioningProfiles",
        expected: { isActive: true },
        valuePath: "/id",
        saveAs: "createdProfileId",
      },
    },
    { action: "screenshot", id: "persisted-id", checkpoint: "The created profile is active." },
  ];
  const result = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] }));
  assert.equal(result.scenarios[0].steps[1].captureResponse.url, "http://127.0.0.1:3008/api/config/full-profile");
  assert.equal(result.scenarios[0].steps[1].captureResponse.saveAs, "createdProfileId");
  const unsafeCapture = { ...steps[1], captureResponse: { ...steps[1].captureResponse, path: "//outside.example" } };
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [steps[0], unsafeCapture, steps[2]] })] })), /path/u);
});

test("v2 normalizes captureOnly to false and accepts explicit true or false", () => {
  const defaultStep = validateV2().scenarios[0].steps[1];
  assert.equal(defaultStep.captureOnly, false);

  for (const captureOnly of [true, false]) {
    const step = { action: "screenshot", id: "shot", checkpoint: "Ready", captureOnly };
    const result = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [
      { action: "goto", path: "/" },
      step,
    ] })] }));
    assert.equal(result.scenarios[0].steps[1].captureOnly, captureOnly);
  }
});

test("v2 normalizes reactive wait rejection selectors and dynamic section checkpoints", () => {
  const result = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [
    { action: "goto", path: "/" },
    {
      action: "waitFor", selector: ".completed", state: "visible",
      rejectSelectors: ["[data-testid='insufficient-credits-modal']", "[role='alert']"],
    },
    {
      action: "screenshotSections",
      frameSelector: "iframe.preview",
      selector: "[data-section-order]",
      idPrefix: "clone-preview",
      checkpoint: "A generated section is visible after scrolling.",
      maxSections: 20,
      stableForMs: 2500,
    },
  ] })] }));

  assert.deepEqual(result.scenarios[0].steps[1].rejectSelectors, [
    "[data-testid='insufficient-credits-modal']", "[role='alert']",
  ]);
  assert.deepEqual(result.scenarios[0].steps[2], {
    action: "screenshotSections",
    selector: "[data-section-order]",
    frameSelector: "iframe.preview",
    idPrefix: "clone-preview",
    checkpoint: "A generated section is visible after scrolling.",
    maxSections: 20,
    stableForMs: 2500,
    maskSelectors: [],
    maxDiffPixels: 0,
    timeoutMs: 10000,
  });
});

test("v2 normalizes bounded DOM probe evidence settings", () => {
  const result = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [
    { action: "goto", path: "/" },
    { action: "screenshot", id: "preview", checkpoint: "Preview is rendered." },
    { action: "captureDomProbe", id: "dom-facts", frameSelector: "iframe.clone", stableForMs: 1200, maxElements: 450 },
  ] })] }));
  assert.deepEqual(result.scenarios[0].steps[2], {
    action: "captureDomProbe", id: "dom-facts", frameSelector: "iframe.clone",
    stableForMs: 1200, maxElements: 450, timeoutMs: 10000,
  });
});

test("v2 rejects unsafe or unbounded DOM probe settings and duplicate evidence ids", () => {
  const validateProbe = (probe) => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [
    { action: "goto", path: "/" },
    { action: "screenshot", id: "preview", checkpoint: "Preview is rendered." },
    probe,
  ] })] }));
  for (const stableForMs of [0, 60001, "1000"]) {
    assert.throws(() => validateProbe({ action: "captureDomProbe", id: "probe", stableForMs }), /stableForMs/u);
  }
  for (const maxElements of [0, 501, 2.5]) {
    assert.throws(() => validateProbe({ action: "captureDomProbe", id: "probe", maxElements }), /maxElements/u);
  }
  assert.throws(() => validateProbe({ action: "captureDomProbe", id: "preview" }), /unique/u);
});

test("v2 validates reactive wait and section checkpoint bounds", () => {
  const makePlan = (waitFor, screenshotSections) => validPlanV2({ scenarios: [v2Scenario({ steps: [
    { action: "goto", path: "/" }, waitFor, screenshotSections,
  ] })] });
  const sectionStep = {
    action: "screenshotSections", selector: ".section", idPrefix: "sections", checkpoint: "Section visible.",
  };

  assert.throws(() => validateV2(makePlan({
    action: "waitFor", selector: ".done", state: "visible", rejectSelectors: "[role=alert]",
  }, sectionStep)), /rejectSelectors must be an array/u);
  assert.throws(() => validateV2(makePlan({
    action: "waitFor", selector: ".done", state: "visible", rejectSelectors: [""],
  }, sectionStep)), /rejectSelectors\[0\]/u);
  assert.throws(() => validateV2(makePlan({ action: "waitFor", selector: ".done", state: "visible" }, {
    ...sectionStep, maxSections: 101,
  })), /maxSections/u);
  assert.throws(() => validateV2(makePlan({ action: "waitFor", selector: ".done", state: "visible" }, {
    ...sectionStep, stableForMs: 60001,
  })), /stableForMs/u);
  assert.throws(() => validateV2(makePlan({ action: "waitFor", selector: ".done", state: "visible" }, {
    ...sectionStep, idPrefix: "not safe",
  })), /idPrefix/u);
});

test("v2 rejects non-boolean captureOnly values", () => {
  for (const captureOnly of [null, 0, 1, "true", "false", {}]) {
    const steps = [
      { action: "goto", path: "/" },
      { action: "screenshot", id: "shot", checkpoint: "Ready", captureOnly },
    ];
    assert.throws(
      () => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })),
      /captureOnly must be a boolean/u,
    );
  }
});

test("v2 rejects unknown properties at every level", () => {
  const cases = [
    validPlanV2({ private: "PRIVATE VALUE" }),
    validPlanV2({ viewport: { width: 900, private: "PRIVATE VALUE" } }),
    validPlanV2({ scenarios: [v2Scenario({ private: "PRIVATE VALUE" })] }),
    validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/", private: "PRIVATE VALUE" }, { action: "screenshot", id: "shot", checkpoint: "Ready" }] })] }),
    validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/" }, { action: "screenshot", id: "shot", checkpoint: "Ready", private: "PRIVATE VALUE" }] })] }),
  ];
  for (const candidate of cases) {
    assert.throws(() => validateV2(candidate), (error) => {
      assert.match(error.message, /unknown property/u);
      assert.doesNotMatch(error.message, /PRIVATE VALUE/u);
      return true;
    });
  }
});

test("v2 allows only declared actions and forbids literal fill values", () => {
  for (const action of ["eval", "sleep", "request", "mock", "press"]) {
    assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/" }, { action }] })] })), /action is invalid/u);
  }
  const steps = [{ action: "goto", path: "/" }, { action: "fill", selector: "input", valueFromEnv: "PASSWORD", value: "SECRET" }, { action: "screenshot", id: "shot", checkpoint: "Ready" }];
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })), (error) => {
    assert.match(error.message, /unknown property/u);
    assert.doesNotMatch(error.message, /SECRET/u);
    return true;
  });
});

test("v2 accepts one or multiple repository-relative upload paths", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-upload-"));
  try {
    await mkdir(path.join(cwd, "fixtures"));
    await writeFile(path.join(cwd, "fixtures", "page.png"), "fixture", "utf8");
    await writeFile(path.join(cwd, "fixtures", "logo.svg"), "fixture", "utf8");
    const planPath = path.join(cwd, "plan.json");
    const steps = [
      { action: "goto", path: "/dashboard" },
      { action: "upload", selector: "input[type=file]", paths: ["fixtures/page.png", "fixtures/logo.svg"] },
      { action: "screenshot", id: "uploaded", checkpoint: "The selected files are attached." },
    ];
    await writeFile(planPath, JSON.stringify(validPlanV2({ scenarios: [v2Scenario({ steps })] })), "utf8");

    const validated = validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] }), {}, cwd);
    assert.deepEqual(validated.scenarios[0].steps[1].paths, [
      path.join(cwd, "fixtures", "page.png"),
      path.join(cwd, "fixtures", "logo.svg"),
    ]);
    const loaded = await loadVisualPlan(planPath, { cwd });
    assert.deepEqual(loaded.plan.scenarios[0].steps[1].paths, [
      path.join(cwd, "fixtures", "page.png"),
      path.join(cwd, "fixtures", "logo.svg"),
    ]);

    const singleFileStep = { action: "upload", selector: "input[type=file]", paths: ["fixtures/page.png"] };
    const singlePathPlan = validPlanV2({ scenarios: [v2Scenario({ steps: [steps[0], singleFileStep, steps[2]] })] });
    assert.equal(validateV2(singlePathPlan, {}, cwd).scenarios[0].steps[1].paths.length, 1);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("v2 rejects absolute, traversal, and malformed upload paths", () => {
  for (const paths of [
    ["/etc/passwd"],
    ["C:/private/image.png"],
    ["fixtures/../../private/image.png"],
    ["fixtures\\image.png"],
    [""],
    [],
    ["fixtures/./image.png"],
    ["fixtures//image.png"],
  ]) {
    const steps = [
      { action: "goto", path: "/" },
      { action: "upload", selector: "input[type=file]", paths },
      { action: "screenshot", id: "shot", checkpoint: "The upload flow completed." },
    ];
    assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })), /upload|path|paths/u);
  }
});

test("plan loading rejects missing upload files and directory paths", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-upload-"));
  try {
    await mkdir(path.join(cwd, "fixtures"));
    const planPath = path.join(cwd, "plan.json");
    const makePlan = (fixturePath) => validPlanV2({ scenarios: [v2Scenario({ steps: [
      { action: "goto", path: "/" },
      { action: "upload", selector: "input[type=file]", paths: [fixturePath] },
      { action: "screenshot", id: "shot", checkpoint: "The upload is shown." },
    ] })] });

    await writeFile(planPath, JSON.stringify(makePlan("fixtures/missing.png")), "utf8");
    await assert.rejects(loadVisualPlan(planPath, { cwd }), /does not exist in the repository/u);

    await writeFile(planPath, JSON.stringify(makePlan("fixtures")), "utf8");
    await assert.rejects(loadVisualPlan(planPath, { cwd }), /must be a file/u);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("plan loading rejects upload fixtures that escape the repository through a symlink", async (t) => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-upload-"));
  try {
    const cwd = path.join(tempRoot, "repository");
    const fixtureDir = path.join(cwd, "fixtures");
    const outsideDir = path.join(tempRoot, "outside");
    await mkdir(cwd);
    await mkdir(fixtureDir);
    await mkdir(outsideDir);
    await writeFile(path.join(outsideDir, "reference.png"), "fixture", "utf8");
    const planPath = path.join(cwd, "plan.json");
    const steps = [
      { action: "goto", path: "/" },
      { action: "upload", selector: "input[type=file]", paths: ["fixtures/reference.png"] },
      { action: "screenshot", id: "shot", checkpoint: "The upload is shown." },
    ];
    await writeFile(planPath, JSON.stringify(validPlanV2({ scenarios: [v2Scenario({ steps })] })), "utf8");
    try {
      await symlink(path.join(outsideDir, "reference.png"), path.join(fixtureDir, "reference.png"), "file");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
        t.skip("File symlinks are unavailable in this environment.");
        return;
      }
      throw error;
    }
    await assert.rejects(loadVisualPlan(planPath, { cwd }), /remain inside the repository root/u);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test("v2 enforces first goto, a screenshot, and globally unique screenshot ids", () => {
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "click", selector: "button" }, { action: "screenshot", id: "shot", checkpoint: "Ready" }] })] })), /begin with goto/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/" }] })] })), /contain a screenshot/u);
  const second = v2Scenario({ id: "other", steps: [{ action: "goto", path: "/" }, { action: "screenshot", id: "dashboard-ready", checkpoint: "Ready" }] });
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario(), second] })), /globally unique/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario(), v2Scenario()] })), /Scenario ids must be unique/u);
});

test("v2 confines profile origins and navigation paths", () => {
  for (const configured of ["https://example.com:3008", "http://127.0.0.1:3014", "http://user:pass@127.0.0.1:3008", "file:///dashboard", "http://127.0.0.1:3008/subpath"]) {
    assert.throws(() => validateV2(validPlanV2(), { SANDBOX_PUBMASTER_ORIGIN: configured }), /Visual origins/u);
  }
  for (const invalidPath of ["//evil.example", "/\\evil.example", "/dashboard\\other", "/dashboard\nother", "https://evil.example", "/".repeat(2050)]) {
    assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: invalidPath }, { action: "screenshot", id: "shot", checkpoint: "Ready" }] })] })), /path/u);
  }
  assert.equal(validateV2(validPlanV2(), { SANDBOX_PUBMASTER_ORIGIN: "http://localhost:3008" }).scenarios[0].steps[0].url, "http://localhost:3008/dashboard");
});

test("v2 bounds identifiers, text, masks, counts, diffs, and timeouts", () => {
  assert.throws(() => validateV2(validPlanV2({ scenarios: [] })), /between 1 and 50/u);
  assert.throws(() => validateV2(validPlanV2({ viewport: null })), /viewport/u);
  assert.throws(() => validateV2(validPlanV2({ stepTimeoutMs: null })), /stepTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ id: "Uppercase" })] })), /id/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ maskSelectors: null })] })), /maskSelectors/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ maskSelectors: Array(21).fill(".mask") })] })), /maskSelectors/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: Array(101).fill({ action: "goto", path: "/" }) })] })), /between 1 and 100/u);
  assert.throws(() => validateV2(validPlanV2({ stepTimeoutMs: 99 })), /stepTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ stepTimeoutMs: 240001 })), /stepTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarioTimeoutMs: 999 })), /scenarioTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarioTimeoutMs: 240001 })), /scenarioTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/", timeoutMs: 99 }, { action: "screenshot", id: "shot", checkpoint: "Ready" }] })] })), /timeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/" }, { action: "screenshot", id: "shot", checkpoint: "Ready", maxDiffPixels: 1000001 }] })] })), /maxDiffPixels/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [{ action: "goto", path: "/" }, { action: "screenshot", id: "shot", checkpoint: "x".repeat(241) }] })] })), /checkpoint/u);
});

test("v2 accepts realistic long pipeline timeouts and rejects values above the limit", () => {
  const longStep = { action: "waitFor", selector: "[data-mark-id='1']", state: "visible", timeoutMs: 180000 };
  const acceptedPlan = validPlanV2({
    stepTimeoutMs: 180000,
    scenarioTimeoutMs: 240000,
    scenarios: [v2Scenario({ steps: [
      { action: "goto", path: "/" },
      longStep,
      { action: "screenshot", id: "complete", checkpoint: "Generation completed." },
    ] })],
  });
  const accepted = validateV2(acceptedPlan);
  assert.equal(accepted.stepTimeoutMs, 180000);
  assert.equal(accepted.scenarioTimeoutMs, 240000);
  assert.equal(accepted.scenarios[0].steps[1].timeoutMs, 180000);

  assert.throws(() => validateV2(validPlanV2({ stepTimeoutMs: 240001 })), /stepTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarioTimeoutMs: 240001 })), /scenarioTimeoutMs/u);
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps: [
    { action: "goto", path: "/" },
    { action: "waitFor", selector: ".done", state: "visible", timeoutMs: 240001 },
    { action: "screenshot", id: "complete", checkpoint: "Generation completed." },
  ] })] })), /timeoutMs/u);
});

test("v2 validates selector, wait state, and environment references", () => {
  for (const valueFromEnv of ["", "lowercase", "9START", "HAS-DASH", "A".repeat(129)]) {
    const steps = [{ action: "goto", path: "/" }, { action: "fill", selector: "input", valueFromEnv }, { action: "screenshot", id: "shot", checkpoint: "Ready" }];
    assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })), /valueFromEnv/u);
  }
  for (const selector of ["", " input", "a\nb", "x".repeat(501)]) {
    const steps = [{ action: "goto", path: "/" }, { action: "click", selector }, { action: "screenshot", id: "shot", checkpoint: "Ready" }];
    assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })), /selector/u);
  }
  const steps = [{ action: "goto", path: "/" }, { action: "waitFor", selector: ".ready", state: "networkidle" }, { action: "screenshot", id: "shot", checkpoint: "Ready" }];
  assert.throws(() => validateV2(validPlanV2({ scenarios: [v2Scenario({ steps })] })), /state/u);
});

test("requires a user-value checkpoint for every scenario", () => {
  const plan = validPlan();
  delete plan.scenarios[0].checkpoint;
  assert.throws(() => validateVisualPlan(plan), /checkpoint/);
});

test("rejects unknown profiles and unsafe paths", () => {
  assert.throws(() => validateVisualPlan(validPlan({ scenarios: [{ ...validPlan().scenarios[0], profile: "external" }] })), /profile/);
  assert.throws(() => validateVisualPlan(validPlan({ scenarios: [{ ...validPlan().scenarios[0], path: "//example.com" }] })), /path/);
  assert.throws(() => validateVisualPlan(validPlan({ scenarios: [{ ...validPlan().scenarios[0], path: "/\\evil.example/" }] })), /path/);
  assert.throws(() => validateVisualPlan(validPlan({ scenarios: [{ ...validPlan().scenarios[0], path: "/dashboard\\evil" }] })), /path/);
});

test("rejects duplicate scenario ids", () => {
  const scenario = validPlan().scenarios[0];
  assert.throws(() => validateVisualPlan(validPlan({ scenarios: [scenario, { ...scenario }] })), /unique/);
});

test("keeps storage state inside the ignored sandbox directory", () => {
  assert.throws(() => validateVisualPlan(validPlan({ storageState: "../secret.json" }), { cwd: "C:\\workspace" }), /inside \.sandbox/);
  const result = validateVisualPlan(validPlan({ storageState: ".sandbox/auth/user.json" }), { cwd: "C:\\workspace" });
  assert.match(result.storageState, /\.sandbox[\\/]auth[\\/]user\.json$/);
});

test("builds URLs only from the selected local product profile", () => {
  const result = validateVisualPlan(validPlan(), { env: {}, cwd: process.cwd() });
  assert.equal(result.scenarios[0].url, "http://127.0.0.1:3008/dashboard");
});

test("rejects a final navigation to another origin", () => {
  assert.doesNotThrow(() => assertSameVisualOrigin("http://127.0.0.1:3008/dashboard?tab=1", "http://127.0.0.1:3008/dashboard"));
  assert.throws(() => assertSameVisualOrigin("https://external.example/dashboard", "http://127.0.0.1:3008/dashboard"), /left the selected product origin/u);
  assert.throws(() => assertSameVisualOrigin("http://127.0.0.1:3014/dashboard", "http://127.0.0.1:3008/dashboard"), /left the selected product origin/u);
});

test("missing baseline fails ordinary runs but allows explicit updates", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-baseline-"));
  try {
    const baseline = path.join(cwd, "chromium", "dashboard-ready.png");
    await assert.rejects(requireApprovedBaseline(baseline), /Missing approved visual baseline/u);
    await assert.doesNotReject(requireApprovedBaseline(baseline, { updateBaselines: true }));
    await mkdir(path.dirname(baseline));
    await writeFile(baseline, "approved baseline", "utf8");
    await assert.doesNotReject(requireApprovedBaseline(baseline));
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("Playwright config never writes missing snapshots implicitly", () => {
  assert.equal(visualConfig.updateSnapshots, "none");
  assert.equal(visualConfig.use.trace, "off");
  assert.equal(visualConfig.use.screenshot, "off");
});

test("invalid JSON errors do not reveal plan contents", async () => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-plan-"));
  try {
    const planPath = path.join(cwd, "plan.json");
    await writeFile(planPath, "PRIVATE PLAN CONTENT", "utf8");
    await assert.rejects(loadVisualPlan(planPath), (error) => {
      assert.doesNotMatch(error.message, /PRIVATE PLAN CONTENT/u);
      return true;
    });
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("rejects storage state that escapes .sandbox through a symlink", async (t) => {
  const cwd = await mkdtemp(path.join(os.tmpdir(), "sandbox-visual-plan-"));
  try {
    const sandbox = path.join(cwd, ".sandbox");
    const outside = path.join(cwd, "outside");
    await mkdir(sandbox);
    await mkdir(outside);
    await writeFile(path.join(outside, "state.json"), "{}", "utf8");
    const planPath = path.join(cwd, "plan.json");
    await writeFile(planPath, JSON.stringify(validPlan({ storageState: ".sandbox/link/state.json" })), "utf8");
    try {
      await symlink(outside, path.join(sandbox, "link"), process.platform === "win32" ? "junction" : "dir");
    } catch (error) {
      if (["EPERM", "EACCES", "ENOTSUP"].includes(error.code)) {
        t.skip("Directory symlinks are unavailable in this environment.");
        return;
      }
      throw error;
    }
    await assert.rejects(loadVisualPlan(planPath, { cwd }), /storageState must remain inside \.sandbox/u);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});

test("v2 allows remote origins when SANDBOX_REMOTE is enabled", () => {
  const defaultRemote = validateV2(validPlanV2(), { SANDBOX_REMOTE: "1" });
  assert.equal(defaultRemote.scenarios[0].origin, "https://pubmaster.spotlightus.org");
  assert.equal(defaultRemote.scenarios[0].steps[0].url, "https://pubmaster.spotlightus.org/dashboard");

  const customRemote = validateV2(validPlanV2(), {
    SANDBOX_REMOTE: "1",
    SANDBOX_PUBMASTER_ORIGIN: "https://staging.spotlightus.org",
  });
  assert.equal(customRemote.scenarios[0].origin, "https://staging.spotlightus.org");
  assert.equal(customRemote.scenarios[0].steps[0].url, "https://staging.spotlightus.org/dashboard");

  assert.throws(() => validateV2(validPlanV2(), {
    SANDBOX_REMOTE: "1",
    SANDBOX_PUBMASTER_ORIGIN: "https://user:pass@staging.spotlightus.org",
  }), /Visual origins/u);
});

