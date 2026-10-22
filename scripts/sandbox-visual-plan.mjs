import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";

const PROFILE_PORTS = Object.freeze({ pubmaster: 3008, nielsen: 3014, pageclone: 3015, admin: 3009 });

function assertObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(label + " must be an object.");
}

function integer(value, fallback, min, max, label) {
  const resolved = value ?? fallback;
  if (!Number.isInteger(resolved) || resolved < min || resolved > max) {
    throw new Error(label + " must be an integer from " + min + " to " + max + ".");
  }
  return resolved;
}

function boolean(value, fallback, label) {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") throw new Error(label + " must be a boolean.");
  return value;
}

function text(value, label, maxLength = 500) {
  if (typeof value !== "string" || value.length < 1 || value.length > maxLength) {
    throw new Error(label + " must be non-empty text up to " + maxLength + " characters.");
  }
  return value;
}

const REMOTE_PROFILE_ORIGINS = Object.freeze({
  pubmaster: "https://pubmaster.spotlightus.org",
  nielsen: "https://nielsen.spotlightus.org",
  pageclone: "https://clone.spotlightus.org",
  admin: "https://admin.spotlightus.org",
});

function origins(env) {
  const isRemote = env.SANDBOX_REMOTE === "1";
  return Object.fromEntries(Object.keys(PROFILE_PORTS).map((profile) => {
    const upper = profile.toUpperCase();
    const fallback = isRemote
      ? (REMOTE_PROFILE_ORIGINS[profile] || "http://127.0.0.1:" + PROFILE_PORTS[profile] + "/")
      : "http://127.0.0.1:" + PROFILE_PORTS[profile] + "/";
    const configured = env["SANDBOX_" + upper + "_ORIGIN"] || env["SANDBOX_" + upper + "_URL"];
    const url = new URL(configured || fallback);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Visual origins must use HTTP or HTTPS.");
    return [profile, url.origin];
  }));
}

function allowedProperties(value, allowed, label) {
  assertObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new Error(label + " has an unknown property.");
  }
}

function strictInteger(value, fallback, min, max, label) {
  return integer(value === null ? NaN : value, fallback, min, max, label);
}

function safeText(value, label, maxLength) {
  text(value, label, maxLength);
  if (value.trim() !== value || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(label + " has invalid whitespace or control characters.");
  }
  return value;
}

function safeId(value, label) {
  if (typeof value !== "string" || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(value)) {
    throw new Error(label + " must be filesystem-safe lowercase text.");
  }
  return value;
}

function safeMasks(value, label) {
  const masks = value === undefined ? [] : value;
  if (!Array.isArray(masks) || masks.length > 20) throw new Error(label + " is invalid.");
  return masks.map((selector, index) => safeText(selector, label + "[" + index + "]", 500));
}

function jsonPointer(value, label) {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 500 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(label + " must be a JSON pointer starting with one slash.");
  }
  return value;
}

function apiExpected(value, label) {
  assertObject(value, label);
  const entries = Object.entries(value);
  if (entries.length < 1 || entries.length > 20) throw new Error(label + " must contain between 1 and 20 fields.");
  return Object.fromEntries(entries.map(([key, expected]) => {
    safeText(key, label + ".key", 100);
    if (expected === null || typeof expected === "string" || typeof expected === "number" || typeof expected === "boolean") return [key, expected];
    allowedProperties(expected, ["valueFromEnv", "valueFromCapture"], label + "." + key);
    const reference = expected.valueFromEnv === undefined ? "valueFromCapture" : "valueFromEnv";
    if (Object.keys(expected).length !== 1 || typeof expected[reference] !== "string") {
      throw new Error(label + "." + key + " must contain exactly one supported value reference.");
    }
    if (reference === "valueFromEnv" && !/^[A-Z_][A-Z0-9_]{0,127}$/u.test(expected.valueFromEnv)) {
      throw new Error(label + "." + key + ".valueFromEnv must be an environment variable name.");
    }
    if (reference === "valueFromCapture" && !/^[a-z][A-Za-z0-9]{0,79}$/u.test(expected.valueFromCapture)) {
      throw new Error(label + "." + key + ".valueFromCapture must be a safe captured value name.");
    }
    return [key, { [reference]: expected[reference] }];
  }));
}

function apiMinArrayLengths(value, label) {
  if (value === undefined) return {};
  assertObject(value, label);
  const entries = Object.entries(value);
  if (entries.length > 20) throw new Error(label + " must contain at most 20 fields.");
  return Object.fromEntries(entries.map(([key, minimum]) => [
    safeText(key, label + ".key", 100),
    strictInteger(minimum, NaN, 0, 1000, label + "." + key),
  ]));
}

function apiCapture(value, origin, label) {
  assertObject(value, label);
  allowedProperties(value, ["path", "method", "status", "arrayPath", "expected", "valuePath", "saveAs"], label);
  const method = safeText(value.method, label + ".method", 10).toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) throw new Error(label + ".method is invalid.");
  return {
    url: confinedPath(value.path, origin, label + ".path"),
    method,
    status: strictInteger(value.status, 200, 100, 599, label + ".status"),
    arrayPath: jsonPointer(value.arrayPath, label + ".arrayPath"),
    expected: apiExpected(value.expected, label + ".expected"),
    valuePath: jsonPointer(value.valuePath, label + ".valuePath"),
    saveAs: (() => {
      const saveAs = safeText(value.saveAs, label + ".saveAs", 80);
      if (!/^[a-z][A-Za-z0-9]{0,79}$/u.test(saveAs)) {
        throw new Error(label + ".saveAs must be a safe captured value name.");
      }
      return saveAs;
    })(),
  };
}

function confinedOrigins(env) {
  const isRemote = env.SANDBOX_REMOTE === "1";
  return Object.fromEntries(Object.keys(PROFILE_PORTS).map((profile) => {
    const upper = profile.toUpperCase();
    const fallback = isRemote
      ? (REMOTE_PROFILE_ORIGINS[profile] || "http://127.0.0.1:" + PROFILE_PORTS[profile] + "/")
      : "http://127.0.0.1:" + PROFILE_PORTS[profile] + "/";
    const configured = env["SANDBOX_" + upper + "_ORIGIN"] || env["SANDBOX_" + upper + "_URL"];
    let url;
    try {
      url = new URL(configured || fallback);
    } catch {
      throw new Error("Visual origins must be valid local URLs.");
    }
    if (!["http:", "https:"].includes(url.protocol)
      || url.username || url.password
      || (url.pathname !== "/" && url.pathname !== "")
      || url.search || url.hash) {
      throw new Error("Visual origins must use HTTP or HTTPS without credentials or a path.");
    }
    if (!isRemote) {
      if (!["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)
        || Number(url.port) !== PROFILE_PORTS[profile]) {
        throw new Error("Visual origins must use the selected loopback profile port without credentials or a path.");
      }
    }
    return [profile, url.origin];
  }));
}

function confinedPath(value, origin, label) {
  if (typeof value !== "string" || value.length < 1 || value.length > 2048
    || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")
    || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new Error(label + " must be a same-origin path starting with one slash.");
  }
  let url;
  try {
    url = new URL(value, origin);
  } catch {
    throw new Error(label + " must be a valid same-origin path.");
  }
  if (url.origin !== origin || url.username || url.password) {
    throw new Error(label + " must remain on its profile origin.");
  }
  return url.href;
}

function confinedUploadPaths(value, cwd, label) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new Error(label + " must contain between 1 and 10 repository-relative file paths.");
  }
  const root = path.resolve(cwd);
  return value.map((item, index) => {
    const pathLabel = label + "[" + index + "]";
    safeText(item, pathLabel, 500);
    if (path.isAbsolute(item) || path.win32.isAbsolute(item) || item.includes("\\") || item.includes(":")) {
      throw new Error(pathLabel + " must be a repository-relative path using forward slashes.");
    }
    const segments = item.split("/");
    if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      throw new Error(pathLabel + " cannot contain empty, dot, or traversal path segments.");
    }
    const resolved = path.resolve(root, ...segments);
    if (!isInside(root, resolved)) {
      throw new Error(pathLabel + " must remain inside the repository root.");
    }
    return resolved;
  });
}

function validateVisualPlanV2(input, { env, cwd }) {
  allowedProperties(input, ["version", "scenarios", "viewport", "maxDiffPixels", "failOnConsoleErrors", "storageState", "stepTimeoutMs", "scenarioTimeoutMs"], "Visual plan");
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1 || input.scenarios.length > 50) {
    throw new Error("scenarios must contain between 1 and 50 entries.");
  }
  const viewportInput = input.viewport === undefined ? {} : input.viewport;
  allowedProperties(viewportInput, ["width", "height"], "viewport");
  const viewport = {
    width: strictInteger(viewportInput.width, 1440, 320, 3840, "viewport.width"),
    height: strictInteger(viewportInput.height, 900, 320, 2160, "viewport.height"),
  };
  const defaultDiff = strictInteger(input.maxDiffPixels, 0, 0, 1000000, "maxDiffPixels");
  const stepTimeoutMs = strictInteger(input.stepTimeoutMs, 10000, 100, 240000, "stepTimeoutMs");
  const scenarioTimeoutMs = strictInteger(input.scenarioTimeoutMs, 60000, 1000, 240000, "scenarioTimeoutMs");
  const profileOrigins = confinedOrigins(env);
  const scenarioIds = new Set();
  const screenshotIds = new Set();
  const sectionPrefixes = new Set();
  const scenarios = input.scenarios.map((scenario, scenarioIndex) => {
    const label = "scenarios[" + scenarioIndex + "]";
    allowedProperties(scenario, ["id", "profile", "steps", "maskSelectors"], label);
    const id = safeId(scenario.id, label + ".id");
    if (scenarioIds.has(id)) throw new Error("Scenario ids must be unique.");
    scenarioIds.add(id);
    if (!Object.hasOwn(profileOrigins, scenario.profile)) throw new Error(label + ".profile is invalid.");
    if (!Array.isArray(scenario.steps) || scenario.steps.length < 1 || scenario.steps.length > 100) {
      throw new Error(label + ".steps must contain between 1 and 100 entries.");
    }
    const maskSelectors = safeMasks(scenario.maskSelectors, label + ".maskSelectors");
    let screenshotCount = 0;
    const steps = scenario.steps.map((step, stepIndex) => {
      const stepLabel = label + ".steps[" + stepIndex + "]";
      assertObject(step, stepLabel);
      const action = step.action;
      const fields = {
        goto: ["path"],
        click: ["selector", "captureResponse"],
        fill: ["selector", "valueFromEnv"],
        upload: ["selector", "paths"],
        waitFor: ["selector", "state", "rejectSelectors"],
        apiAssert: ["path", "status", "arrayPath", "expected", "minArrayLengths"],
        screenshot: ["id", "checkpoint", "maskSelectors", "fullPage", "maxDiffPixels", "captureOnly"],
        screenshotSections: ["selector", "frameSelector", "idPrefix", "checkpoint", "maxSections", "stableForMs", "maskSelectors", "maxDiffPixels"],
        captureDomProbe: ["id", "frameSelector", "stableForMs", "maxElements"],
      };
      if (!Object.hasOwn(fields, action)) throw new Error(stepLabel + ".action is invalid.");
      allowedProperties(step, ["action", "timeoutMs", ...fields[action]], stepLabel);
      const timeoutMs = strictInteger(step.timeoutMs, stepTimeoutMs, 100, 240000, stepLabel + ".timeoutMs");
      if (stepIndex === 0 && action !== "goto") throw new Error(label + ".steps must begin with goto.");
      switch (action) {
        case "goto":
          return { action, path: step.path, url: confinedPath(step.path, profileOrigins[scenario.profile], stepLabel + ".path"), timeoutMs };
        case "click":
          return {
            action,
            selector: safeText(step.selector, stepLabel + ".selector", 500),
            captureResponse: step.captureResponse === undefined ? null : apiCapture(step.captureResponse, profileOrigins[scenario.profile], stepLabel + ".captureResponse"),
            timeoutMs,
          };
        case "fill": {
          const selector = safeText(step.selector, stepLabel + ".selector", 500);
          if (typeof step.valueFromEnv !== "string" || !/^[A-Z_][A-Z0-9_]{0,127}$/u.test(step.valueFromEnv)) {
            throw new Error(stepLabel + ".valueFromEnv must be an environment variable name.");
          }
          return { action, selector, valueFromEnv: step.valueFromEnv, timeoutMs };
        }
        case "upload":
          return {
            action,
            selector: safeText(step.selector, stepLabel + ".selector", 500),
            paths: confinedUploadPaths(step.paths, cwd, stepLabel + ".paths"),
            timeoutMs,
          };
        case "waitFor": {
          const selector = safeText(step.selector, stepLabel + ".selector", 500);
          if (!["visible", "hidden", "attached", "detached"].includes(step.state)) {
            throw new Error(stepLabel + ".state is invalid.");
          }
          const rejectSelectors = step.rejectSelectors === undefined ? [] : step.rejectSelectors;
          if (!Array.isArray(rejectSelectors) || rejectSelectors.length > 20) {
            throw new Error(stepLabel + ".rejectSelectors must be an array with up to 20 selectors.");
          }
          return {
            action, selector, state: step.state,
            rejectSelectors: rejectSelectors.map((value, index) => safeText(value, stepLabel + ".rejectSelectors[" + index + "]", 500)),
            timeoutMs,
          };
        }
        case "apiAssert":
          return {
            action,
            url: confinedPath(step.path, profileOrigins[scenario.profile], stepLabel + ".path"),
            status: strictInteger(step.status, 200, 100, 599, stepLabel + ".status"),
            arrayPath: jsonPointer(step.arrayPath, stepLabel + ".arrayPath"),
            expected: apiExpected(step.expected, stepLabel + ".expected"),
            minArrayLengths: apiMinArrayLengths(step.minArrayLengths, stepLabel + ".minArrayLengths"),
            timeoutMs,
          };
        case "screenshotSections": {
          const selector = safeText(step.selector, stepLabel + ".selector", 500);
          const frameSelector = step.frameSelector === undefined ? null : safeText(step.frameSelector, stepLabel + ".frameSelector", 500);
          const idPrefix = safeId(step.idPrefix, stepLabel + ".idPrefix");
          if (idPrefix.length > 60) throw new Error(stepLabel + ".idPrefix must be at most 60 characters.");
          if (sectionPrefixes.has(idPrefix) || [...screenshotIds].some((id) => id.startsWith(idPrefix + "-section-"))) {
            throw new Error("Screenshot ids and section prefixes must be unique.");
          }
          sectionPrefixes.add(idPrefix);
          screenshotCount += 1;
          const maxSections = strictInteger(step.maxSections, 50, 1, 100, stepLabel + ".maxSections");
          const stableForMs = strictInteger(step.stableForMs, 3000, 1, 60000, stepLabel + ".stableForMs");
          const checkpoint = safeText(step.checkpoint, stepLabel + ".checkpoint", 240);
          const sectionMasks = step.maskSelectors === undefined ? [...maskSelectors] : safeMasks(step.maskSelectors, stepLabel + ".maskSelectors");
          return {
            action, selector, frameSelector, idPrefix, checkpoint, maxSections, stableForMs, maskSelectors: sectionMasks,
            maxDiffPixels: strictInteger(step.maxDiffPixels, defaultDiff, 0, 1000000, stepLabel + ".maxDiffPixels"),
            timeoutMs,
          };
        }
        case "screenshot": {
          const screenshotId = safeId(step.id, stepLabel + ".id");
          if (screenshotIds.has(screenshotId)) throw new Error("Screenshot ids must be globally unique.");
          if ([...sectionPrefixes].some((prefix) => screenshotId.startsWith(prefix + "-section-"))) {
            throw new Error("Screenshot ids and section prefixes must be unique.");
          }
          screenshotIds.add(screenshotId);
          screenshotCount += 1;
          return {
            action, id: screenshotId, checkpoint: safeText(step.checkpoint, stepLabel + ".checkpoint", 240),
            maskSelectors: step.maskSelectors === undefined ? [...maskSelectors] : safeMasks(step.maskSelectors, stepLabel + ".maskSelectors"),
            fullPage: boolean(step.fullPage, true, stepLabel + ".fullPage"),
            maxDiffPixels: strictInteger(step.maxDiffPixels, defaultDiff, 0, 1000000, stepLabel + ".maxDiffPixels"),
            captureOnly: boolean(step.captureOnly, false, stepLabel + ".captureOnly"),
            timeoutMs,
          };
        }
        case "captureDomProbe": {
          const probeId = safeId(step.id, stepLabel + ".id");
          if (screenshotIds.has(probeId)) throw new Error("Visual evidence ids must be globally unique.");
          if ([...sectionPrefixes].some((prefix) => probeId.startsWith(prefix + "-section-"))) {
            throw new Error("Visual evidence ids and section prefixes must be unique.");
          }
          screenshotIds.add(probeId);
          const frameSelector = step.frameSelector === undefined ? null : safeText(step.frameSelector, stepLabel + ".frameSelector", 500);
          return {
            action, id: probeId, frameSelector,
            stableForMs: strictInteger(step.stableForMs, 1000, 1, 60000, stepLabel + ".stableForMs"),
            maxElements: strictInteger(step.maxElements, 300, 1, 500, stepLabel + ".maxElements"),
            timeoutMs,
          };
        }
      }
    });
    if (screenshotCount === 0) throw new Error(label + ".steps must contain a screenshot.");
    return { id, profile: scenario.profile, origin: profileOrigins[scenario.profile], maskSelectors, steps };
  });
  return {
    version: 2, viewport, maxDiffPixels: defaultDiff,
    failOnConsoleErrors: boolean(input.failOnConsoleErrors, false, "failOnConsoleErrors"),
    storageState: storageState(input.storageState, cwd), stepTimeoutMs, scenarioTimeoutMs, scenarios,
  };
}

function storageState(value, cwd) {
  if (value === undefined) return null;
  text(value, "storageState");
  if (path.isAbsolute(value)) throw new Error("storageState must be relative and inside .sandbox/.");
  const root = path.resolve(cwd, ".sandbox");
  const resolved = path.resolve(cwd, value);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) {
    throw new Error("storageState must remain inside .sandbox/.");
  }
  return resolved;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
}

export function assertSameVisualOrigin(actualUrl, expectedUrl) {
  if (new URL(actualUrl).origin !== new URL(expectedUrl).origin) {
    throw new Error("Visual navigation left the selected product origin.");
  }
}

export async function requireApprovedBaseline(baselinePath, { updateBaselines = false } = {}) {
  if (updateBaselines) return;
  try {
    if ((await stat(baselinePath)).isFile()) return;
  } catch (error) {
    if (error.code !== "ENOENT" && error.code !== "ENOTDIR") throw error;
  }
  throw new Error("Missing approved visual baseline: " + baselinePath + ". Use --update-visual-baselines to create it explicitly.");
}

export function validateVisualPlan(input, { env = process.env, cwd = process.cwd() } = {}) {
  assertObject(input, "Visual plan");
  if (input.version === 2) return validateVisualPlanV2(input, { env, cwd });
  if (input.version !== 1) throw new Error("Visual plan version must be 1.");
  if (!Array.isArray(input.scenarios) || input.scenarios.length < 1 || input.scenarios.length > 50) {
    throw new Error("scenarios must contain between 1 and 50 entries.");
  }
  const viewportInput = input.viewport || {};
  assertObject(viewportInput, "viewport");
  const viewport = {
    width: integer(viewportInput.width, 1440, 320, 3840, "viewport.width"),
    height: integer(viewportInput.height, 900, 320, 2160, "viewport.height"),
  };
  const defaultDiff = integer(input.maxDiffPixels, 0, 0, 1000000, "maxDiffPixels");
  const profileOrigins = origins(env);
  const ids = new Set();
  const scenarios = input.scenarios.map((scenario, index) => {
    const label = "scenarios[" + index + "]";
    assertObject(scenario, label);
    if (typeof scenario.id !== "string" || !/^[a-z0-9][a-z0-9._-]{0,79}$/u.test(scenario.id)) {
      throw new Error(label + ".id must be filesystem-safe lowercase text.");
    }
    if (ids.has(scenario.id)) throw new Error("Scenario ids must be unique: " + scenario.id);
    ids.add(scenario.id);
    if (!Object.hasOwn(profileOrigins, scenario.profile)) throw new Error(label + ".profile is invalid.");
    if (typeof scenario.path !== "string" || !scenario.path.startsWith("/") || scenario.path.startsWith("//") || scenario.path.includes("\\")) {
      throw new Error(label + ".path must start with one slash and cannot be protocol-relative.");
    }
    const url = new URL(scenario.path, profileOrigins[scenario.profile]);
    if (url.origin !== profileOrigins[scenario.profile]) throw new Error(label + ".path must remain on its profile origin.");
    const masks = scenario.maskSelectors ?? [];
    if (!Array.isArray(masks) || masks.length > 20) throw new Error(label + ".maskSelectors is invalid.");
    return {
      id: scenario.id,
      checkpoint: text(scenario.checkpoint, label + ".checkpoint", 240),
      profile: scenario.profile,
      path: scenario.path,
      url: url.href,
      fullPage: boolean(scenario.fullPage, true, label + ".fullPage"),
      waitForSelector: scenario.waitForSelector === undefined ? null : text(scenario.waitForSelector, label + ".waitForSelector"),
      maskSelectors: masks.map((item, maskIndex) => text(item, label + ".maskSelectors[" + maskIndex + "]")),
      maxDiffPixels: integer(scenario.maxDiffPixels, defaultDiff, 0, 1000000, label + ".maxDiffPixels"),
    };
  });
  return {
    version: 1,
    viewport,
    maxDiffPixels: defaultDiff,
    failOnConsoleErrors: boolean(input.failOnConsoleErrors, false, "failOnConsoleErrors"),
    storageState: storageState(input.storageState, cwd),
    scenarios,
  };
}

export async function loadVisualPlan(planPath, options = {}) {
  const resolvedPath = await realpath(path.resolve(planPath));
  let input;
  try {
    input = JSON.parse(await readFile(resolvedPath, "utf8"));
  } catch {
    throw new Error("Unable to parse visual plan JSON.");
  }
  const plan = validateVisualPlan(input, options);
  if (plan.storageState) {
    const cwd = await realpath(options.cwd || process.cwd());
    const sandboxRoot = await realpath(path.join(cwd, ".sandbox"));
    if (sandboxRoot !== path.join(cwd, ".sandbox")) {
      throw new Error("storageState must remain inside .sandbox/ after resolving symlinks.");
    }
    const statePath = await realpath(plan.storageState);
    if (!isInside(sandboxRoot, statePath)) {
      throw new Error("storageState must remain inside .sandbox/ after resolving symlinks.");
    }
    plan.storageState = statePath;
  }
  const cwd = await realpath(options.cwd || process.cwd());
  for (const scenario of plan.scenarios) {
    for (const step of scenario.steps || []) {
      if (step.action !== "upload") continue;
      step.paths = await Promise.all(step.paths.map(async (uploadPath, index) => {
        let resolvedPath;
        try {
          resolvedPath = await realpath(uploadPath);
        } catch {
          throw new Error("upload path " + (index + 1) + " for scenario " + scenario.id + " does not exist in the repository.");
        }
        if (!isInside(cwd, resolvedPath)) {
          throw new Error("upload paths must remain inside the repository root after resolving symlinks.");
        }
        if (!(await stat(resolvedPath)).isFile()) {
          throw new Error("upload path " + (index + 1) + " for scenario " + scenario.id + " must be a file.");
        }
        return resolvedPath;
      }));
    }
  }
  return { path: resolvedPath, plan };
}
