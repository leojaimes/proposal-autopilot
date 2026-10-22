import assert from "node:assert/strict";
import test from "node:test";

import { assertApiResponse, captureApiResponseValue } from "./sandbox-visual-api-assertions.mjs";

const step = {
  status: 200,
  arrayPath: "/positioningProfiles",
  expected: {
    isActive: true,
    offerHeadline: { valueFromEnv: "TEST_OFFER" },
  },
  minArrayLengths: { proofStories: 6, voiceRules: 4 },
};

test("API assertion verifies persisted records using environment references without exposing values", () => {
  const body = {
    positioningProfiles: [
      { isActive: false, offerHeadline: "other", proofStories: [], voiceRules: [] },
      { isActive: true, offerHeadline: "Persisted offer", proofStories: Array(6), voiceRules: Array(4) },
    ],
  };
  assert.doesNotThrow(() => assertApiResponse({
    status: 200,
    body,
    step,
    env: { TEST_OFFER: "Persisted offer" },
  }));
});

test("API assertion rejects missing persistence without echoing response content", () => {
  assert.throws(() => assertApiResponse({
    status: 200,
    body: { positioningProfiles: [{ isActive: true, offerHeadline: "private value", proofStories: [], voiceRules: [] }] },
    step,
    env: { TEST_OFFER: "other" },
  }), (error) => {
    assert.match(error.message, /did not find/u);
    assert.doesNotMatch(error.message, /private value/u);
    return true;
  });
});

test("API assertion requires the exact profile identity captured from the creating response", () => {
  const captured = new Map();
  const responseBody = {
    positioningProfiles: [
      { id: "old-active", isActive: false, proofStories: [], voiceRules: [] },
      { id: "created-this-run", isActive: true, proofStories: Array(6), voiceRules: ["peer"] },
    ],
  };
  const capture = {
    status: 200,
    arrayPath: "/positioningProfiles",
    expected: { isActive: true },
    valuePath: "/id",
  };
  captured.set("createdProfileId", captureApiResponseValue({ status: 200, body: responseBody, capture, captured }));
  const persistedStep = {
    status: 200,
    arrayPath: "/positioningProfiles",
    expected: { id: { valueFromCapture: "createdProfileId" }, isActive: true },
    minArrayLengths: { proofStories: 6, voiceRules: 1 },
  };
  assert.doesNotThrow(() => assertApiResponse({ status: 200, body: responseBody, step: persistedStep, captured }));
  const staleOnly = { positioningProfiles: [{ id: "old-active", isActive: true, proofStories: Array(6), voiceRules: ["peer"] }] };
  assert.throws(() => assertApiResponse({ status: 200, body: staleOnly, step: persistedStep, captured }), /did not find/u);
});
