export function resolveJsonPointer(value, pointer) {
  if (pointer === "") return value;
  const segments = pointer.slice(1).split("/").map((segment) => segment.replace(/~1/gu, "/").replace(/~0/gu, "~"));
  let current = value;
  for (const segment of segments) {
    if (!current || typeof current !== "object" || !Object.hasOwn(current, segment)) return undefined;
    current = current[segment];
  }
  return current;
}

function expectedValue(value, env, captured) {
  if (!value || typeof value !== "object") return value;
  if (Object.hasOwn(value, "valueFromEnv")) return env[value.valueFromEnv];
  if (Object.hasOwn(value, "valueFromCapture")) return captured.get(value.valueFromCapture);
  return value;
}

export function findMatchingApiRecord(body, { arrayPath, expected }, { env = process.env, captured = new Map() } = {}) {
  const records = resolveJsonPointer(body, arrayPath);
  if (!Array.isArray(records)) {
    throw new Error("API assertion expected an array at the configured JSON pointer.");
  }
  return records.find((candidate) => candidate && typeof candidate === "object"
    && Object.entries(expected).every(([key, value]) => candidate[key] === expectedValue(value, env, captured)));
}

export function captureApiResponseValue({ status, body, capture, env = process.env, captured = new Map() }) {
  if (status !== capture.status) {
    throw new Error(`API capture expected HTTP ${capture.status}, received HTTP ${status}.`);
  }
  const match = findMatchingApiRecord(body, capture, { env, captured });
  if (!match) {
    throw new Error("API capture did not find the expected record in the same action response.");
  }
  const value = resolveJsonPointer(match, capture.valuePath);
  if (["string", "number", "boolean"].includes(typeof value) && value !== "") return value;
  throw new Error("API capture did not find a scalar identity at the configured JSON pointer.");
}

export function assertApiResponse({ status, body, step, env = process.env, captured = new Map() }) {
  if (status !== step.status) {
    throw new Error(`API assertion expected HTTP ${step.status}, received HTTP ${status}.`);
  }
  const match = findMatchingApiRecord(body, step, { env, captured });
  if (!match) {
    throw new Error("API assertion did not find a record matching the configured persisted fields.");
  }
  for (const [property, minimum] of Object.entries(step.minArrayLengths)) {
    if (!Array.isArray(match[property]) || match[property].length < minimum) {
      throw new Error("API assertion found a record without the required persisted collection length.");
    }
  }
}
