import assert from "node:assert/strict";
import test from "node:test";

import { captureRenderedDomProbe, captureScrolledSections, waitForVisualCondition } from "./sandbox-visual-actions.mjs";

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

test("DOM probe targets the requested clone frame with bounded readiness settings", async () => {
  const events = [];
  const expected = { schemaVersion: 1, elementCount: 0, elements: [] };
  const frame = {
    locator(selector) {
      events.push(`locator:${selector}`);
      return {
        waitFor: async (options) => events.push(`wait:${options.state}:${options.timeout}`),
        evaluate: async (_callback, options) => {
          events.push(`evaluate:${options.timeoutMs}:${options.stableForMs}:${options.maxElements}`);
          return expected;
        },
      };
    },
  };
  const page = {
    frameLocator(selector) {
      events.push(`frame:${selector}`);
      return frame;
    },
  };

  const result = await captureRenderedDomProbe(page, {
    frameSelector: "iframe.clone", timeoutMs: 20000, stableForMs: 1000, maxElements: 500,
  });

  assert.equal(result, expected);
  assert.deepEqual(events.slice(0, 2), ["frame:iframe.clone", "locator:html"]);
  assert.match(events[2], /^wait:attached:\d+$/u);
  assert.match(events[3], /^evaluate:\d+:1000:500$/u);
  assert.ok(Number(events[2].split(":")[2]) <= 20000);
  assert.ok(Number(events[3].split(":")[1]) <= 20000);
});

test("DOM probe propagates invalid frame selector and browser evaluation errors", async () => {
  const invalidFrame = { frameLocator: () => { throw new Error("Invalid selector"); } };
  await assert.rejects(captureRenderedDomProbe(invalidFrame, {
    frameSelector: "iframe[", timeoutMs: 1000, stableForMs: 10, maxElements: 10,
  }), /Invalid selector/u);

  const failedEvaluation = {
    locator: () => ({
      waitFor: async () => {},
      evaluate: async () => { throw new Error("Execution context was destroyed"); },
    }),
  };
  await assert.rejects(captureRenderedDomProbe(failedEvaluation, {
    timeoutMs: 1000, stableForMs: 10, maxElements: 10,
  }), /Execution context was destroyed/u);
});

test("DOM probe stops after the element cap plus one visible candidate and marks truncation", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  try {
    let styleReads = 0;
    let visitedNodes = 0;
    const makeElement = () => ({
      tagName: "DIV",
      childNodes: [],
      matches: () => false,
      getAttribute: () => null,
      getBoundingClientRect: () => ({ x: 2, y: 3, width: 20, height: 10 }),
    });
    const elements = Array.from({ length: 100 }, makeElement);
    const style = {
      visibility: "visible", display: "block", opacity: "1",
      getPropertyValue: () => "0px",
    };
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [], documentElement: { scrollWidth: 200, scrollHeight: 300 },
      body: { scrollWidth: 200, scrollHeight: 300 },
      createTreeWalker: () => ({ nextNode: () => { visitedNodes += 1; return elements[visitedNodes - 1] || null; } }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => { styleReads += 1; return style; },
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = {
      locator: () => ({
        waitFor: async () => {},
        evaluate: async (callback, options) => callback(root, options),
      }),
    };

    const result = await captureRenderedDomProbe(page, {
      timeoutMs: 500, stableForMs: 1, maxElements: 3,
    });

    assert.equal(result.elementCount, 3);
    assert.equal(result.truncated, true);
    assert.equal(styleReads, 4);
    assert.equal(visitedNodes, 4);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe does not mark an invisible final lookahead candidate as truncated", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  try {
    let nextNodeCalls = 0;
    const elements = Array.from({ length: 4 }, (_, index) => ({
      tagName: "DIV", childNodes: [], matches: () => false, getAttribute: () => null,
      getBoundingClientRect: () => ({ x: 0, y: index * 10, width: 20, height: index === 3 ? 0 : 10 }),
    }));
    const style = { visibility: "visible", display: "block", opacity: "1", getPropertyValue: () => "0px" };
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [], documentElement: { scrollWidth: 100, scrollHeight: 100 },
      body: { scrollWidth: 100, scrollHeight: 100 },
      createTreeWalker: () => ({ nextNode: () => { nextNodeCalls += 1; return elements[nextNodeCalls - 1] || null; } }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => style,
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: async (callback, options) => callback(root, options) }) };

    const result = await captureRenderedDomProbe(page, { timeoutMs: 500, stableForMs: 1, maxElements: 3 });

    assert.equal(result.elementCount, 3);
    assert.equal(result.truncated, false);
    assert.equal(nextNodeCalls, 5);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe ignores multiple hidden candidates after the element cap", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  try {
    let nextNodeCalls = 0;
    const elements = Array.from({ length: 12 }, (_, index) => ({
      tagName: "DIV", childNodes: [], matches: () => false, getAttribute: () => null,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 20, height: index < 2 ? 10 : 0 }),
    }));
    const style = { visibility: "visible", display: "block", opacity: "1", getPropertyValue: () => "0px" };
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [], documentElement: { scrollWidth: 100, scrollHeight: 100 },
      body: { scrollWidth: 100, scrollHeight: 100 },
      createTreeWalker: () => ({ nextNode: () => { nextNodeCalls += 1; return elements[nextNodeCalls - 1] || null; } }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => style,
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: async (callback, options) => callback(root, options) }) };

    const result = await captureRenderedDomProbe(page, { timeoutMs: 500, stableForMs: 1, maxElements: 2 });

    assert.equal(result.elementCount, 2);
    assert.equal(result.truncated, false);
    assert.equal(nextNodeCalls, elements.length + 1);
    assert.equal(result.coverage.traversalLimitReached, false);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe marks truncation at the maxVisitedNodes ceiling for non-candidates", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class { observe() {} disconnect() {} };
  try {
    let walkerCalls = 0;
    let childReads = 0;
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [], documentElement: { scrollWidth: 100, scrollHeight: 100 },
      body: { scrollWidth: 100, scrollHeight: 100 },
      createTreeWalker: () => ({ nextNode: () => {
        walkerCalls += 1;
        return walkerCalls <= 500 ? {
          tagName: "SPAN", childNodes: { length: 0, get 0() { childReads += 1; return null; } },
          matches: () => false,
        } : null;
      } }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => assert.fail("Non-candidates must not trigger style reads."),
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: async (callback, options) => callback(root, options) }) };

    const result = await captureRenderedDomProbe(page, { timeoutMs: 500, stableForMs: 1, maxElements: 2 });

    assert.equal(result.elementCount, 0);
    assert.equal(result.truncated, true);
    assert.equal(result.coverage.traversalLimitReached, true);
    assert.equal(result.coverage.maxVisitedNodes, 40);
    assert.equal(walkerCalls, 41);
    assert.equal(childReads, 0);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe bounds image scanning and reports image coverage truncation", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  try {
    let imageRectReads = 0;
    let imageStyleReads = 0;
    const images = Array.from({ length: 8 }, () => ({
      complete: true,
      getBoundingClientRect: () => { imageRectReads += 1; return { width: 50, height: 50 }; },
    }));
    const doc = {
      fonts: { ready: Promise.resolve() }, images, documentElement: { scrollWidth: 200, scrollHeight: 300 },
      body: { scrollWidth: 200, scrollHeight: 300 },
      createTreeWalker: () => ({ nextNode: () => null }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => { imageStyleReads += 1; return { visibility: "visible", display: "block", opacity: "1", getPropertyValue: () => "0px" }; },
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: async (callback, options) => callback(root, options) }) };

    const result = await captureRenderedDomProbe(page, { timeoutMs: 500, stableForMs: 1, maxElements: 3 });

    assert.equal(imageRectReads, 3);
    assert.equal(imageStyleReads, 3);
    assert.deepEqual(result.coverage, {
      imageCount: 8, imagesScanned: 3, visibleImagesAwaited: 3, imagesTruncated: true,
      maxElements: 3, maxTextChildNodesPerElement: 100, traversalLimitReached: false, maxVisitedNodes: 60,
    });
    assert.equal(result.truncated, true);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe removes and settles image readiness listeners when its timeout wins", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  try {
    const listeners = new Map();
    const image = {
      complete: false,
      getBoundingClientRect: () => ({ width: 40, height: 40 }),
      addEventListener: (type, listener) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener: (type, listener) => listeners.get(type)?.delete(listener),
    };
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [image], documentElement: { scrollWidth: 200, scrollHeight: 300 },
      body: { scrollWidth: 200, scrollHeight: 300 }, createTreeWalker: () => ({ nextNode: () => null }),
    };
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => ({ visibility: "visible", display: "block", opacity: "1", getPropertyValue: () => "0px" }),
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: (callback, options) => callback(root, options) }) };

    await assert.rejects(captureRenderedDomProbe(page, { timeoutMs: 120, stableForMs: 1, maxElements: 1 }), /visible images/u);

    assert.equal([...listeners.values()].reduce((total, group) => total + group.size, 0), 0);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe bounds child-node text inspection for high-fanout elements", async () => {
  const previousMutationObserver = globalThis.MutationObserver;
  globalThis.MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  try {
    let childReads = 0;
    const childNodes = new Proxy({ length: 100000 }, {
      get(target, property) {
        if (property === "length") return target.length;
        if (/^\d+$/u.test(String(property))) {
          childReads += 1;
          return { nodeType: 3, textContent: "x" };
        }
        return Reflect.get(target, property);
      },
    });
    const element = {
      tagName: "DIV", childNodes, matches: () => false, getAttribute: () => null,
      getBoundingClientRect: () => ({ x: 0, y: 0, width: 100, height: 20 }),
    };
    const style = { visibility: "visible", display: "block", opacity: "1", getPropertyValue: () => "0px" };
    const doc = {
      fonts: { ready: Promise.resolve() }, images: [], documentElement: { scrollWidth: 200, scrollHeight: 300 },
      body: { scrollWidth: 200, scrollHeight: 300 },
    };
    let yielded = false;
    doc.createTreeWalker = () => ({ nextNode: () => { if (yielded) return null; yielded = true; return element; } });
    const win = {
      NodeFilter: { SHOW_ELEMENT: 1 }, frameElement: {}, location: { pathname: "/clone" },
      innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1, scrollX: 0, scrollY: 0,
      getComputedStyle: () => style,
    };
    doc.defaultView = win;
    const root = { ownerDocument: doc };
    const page = { locator: () => ({ waitFor: async () => {}, evaluate: async (callback, options) => callback(root, options) }) };

    const result = await captureRenderedDomProbe(page, { timeoutMs: 500, stableForMs: 1, maxElements: 1 });

    assert.equal(childReads, result.coverage.maxTextChildNodesPerElement);
    assert.equal(result.elements[0].text.length, 100);
    assert.equal(result.elements[0].textTruncated, true);
  } finally {
    if (previousMutationObserver === undefined) delete globalThis.MutationObserver;
    else globalThis.MutationObserver = previousMutationObserver;
  }
});

test("DOM probe bounds missing-frame resolution and document evaluation by timeoutMs", async () => {
  const missingFrame = {
    frameLocator: () => ({ locator: () => ({ waitFor: ({ timeout }) => {
      assert.ok(timeout > 0 && timeout <= 40);
      return new Promise(() => {});
    } }) }),
  };
  const startResolution = Date.now();
  await assert.rejects(captureRenderedDomProbe(missingFrame, {
    frameSelector: "iframe.missing", timeoutMs: 40, stableForMs: 1, maxElements: 1,
  }), /resolving the document root/u);
  assert.ok(Date.now() - startResolution < 250);

  const hungEvaluation = {
    locator: () => ({
      waitFor: async () => {},
      evaluate: (_callback, options) => {
        assert.ok(options.timeoutMs > 0 && options.timeoutMs <= 40);
        return new Promise(() => {});
      },
    }),
  };
  const startEvaluation = Date.now();
  await assert.rejects(captureRenderedDomProbe(hungEvaluation, {
    timeoutMs: 40, stableForMs: 1, maxElements: 1,
  }), /evaluating the document probe/u);
  assert.ok(Date.now() - startEvaluation < 250);
});

test("reactive visual wait fails when an insufficient-credit dialog appears", async () => {
  const target = deferred();
  const rejection = deferred();
  const page = {
    locator(selector) {
      return { waitFor: () => selector === ".complete" ? target.promise : rejection.promise };
    },
  };
  const waiting = waitForVisualCondition(page, {
    selector: ".complete",
    state: "visible",
    rejectSelectors: ["[data-testid='insufficient-credits-modal']"],
    timeoutMs: 1000,
  });
  rejection.resolve();
  await assert.rejects(waiting, /error state became visible/u);
  target.resolve();
});

test("reactive visual wait accepts the requested completion state", async () => {
  const target = deferred();
  const emptyAlert = {
    waitFor: () => new Promise(() => {}),
    isVisible: async () => false,
  };
  const page = {
    locator(selector) {
      if (selector === "[role='alert']") {
        return { filter: ({ hasText }) => {
          assert.ok(hasText.test("Alert with meaningful text"));
          assert.equal(hasText.test("   \n  "), false);
          return emptyAlert;
        } };
      }
      return {
        waitFor: () => target.promise,
      };
    },
  };
  const waiting = waitForVisualCondition(page, {
    selector: ".complete",
    state: "visible",
    rejectSelectors: ["[role='alert']"],
    timeoutMs: 1000,
  });
  target.resolve();
  await waiting;
});

test("reactive visual wait rejects a role=alert region once it has non-empty text", async () => {
  const target = deferred();
  const nonEmptyAlert = deferred();
  const alertLocator = {
    waitFor: () => nonEmptyAlert.promise,
    isVisible: async () => true,
  };
  const page = {
    locator(selector) {
      if (selector === "[role='alert']") {
        return { filter: ({ hasText }) => {
          assert.equal(hasText.test("Credits exhausted"), true);
          return alertLocator;
        } };
      }
      return { waitFor: () => target.promise };
    },
  };
  const waiting = waitForVisualCondition(page, {
    selector: ".complete",
    state: "visible",
    rejectSelectors: ["[role='alert']"],
    timeoutMs: 1000,
  });
  nonEmptyAlert.resolve();
  await assert.rejects(waiting, /error state became visible/u);
  target.resolve();
});

test("section checkpoints scroll each section and capture one viewport image per section", async () => {
  const events = [];
  const items = [0, 1, 2].map((index) => ({
    outerHTML: `<section data-section-order="${index + 1}"></section>`,
    scrollIntoViewIfNeeded: async () => events.push(`scroll-${index + 1}`),
    waitFor: async () => events.push(`visible-${index + 1}`),
  }));
  const locator = {
    evaluateAll: async (callback) => callback(items),
    nth: (index) => items[index],
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];
  const count = await captureScrolledSections(page, {
    selector: "[data-section-order]",
    idPrefix: "clone",
    checkpoint: "Generated page section is visible.",
    maxSections: 10,
    stableForMs: 15,
    timeoutMs: 500,
  }, async (screenshot) => {
    events.push(`capture-${screenshot.id}`);
    captures.push(screenshot);
  });

  assert.equal(count, 3);
  assert.deepEqual(captures.map(({ id }) => id), [
    "clone-section-01", "clone-section-02", "clone-section-03",
  ]);
  assert.deepEqual(captures.map(({ fullPage, captureOnly }) => [fullPage, captureOnly]), [
    [false, true], [false, true], [false, true],
  ]);
  assert.deepEqual(events, [
    "scroll-1", "visible-1", "capture-clone-section-01",
    "scroll-2", "visible-2", "capture-clone-section-02",
    "scroll-3", "visible-3", "capture-clone-section-03",
  ]);
});

test("section checkpoints wait for delayed section appearance before capturing the settled count", async () => {
  const items = [];
  const locator = {
    evaluateAll: async (callback) => callback(items),
    nth: (index) => ({
      scrollIntoViewIfNeeded: async () => {},
      waitFor: async () => {},
    }),
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];
  setTimeout(() => items.push({ outerHTML: '<section data-section-order="1"></section>' }), 20);

  const count = await captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "delayed", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 20, timeoutMs: 300,
  }, async ({ id }) => captures.push(id));

  assert.equal(count, 1);
  assert.deepEqual(captures, ["delayed-section-01"]);
});

test("section stability retries transient navigation context destruction", async () => {
  const items = [{ outerHTML: '<section data-section-order="1">settled</section>' }];
  let evaluations = 0;
  const locator = {
    evaluateAll: async (callback) => {
      evaluations += 1;
      if (evaluations === 1) {
        throw new Error("Execution context was destroyed, most likely because of a navigation");
      }
      return callback(items);
    },
    nth: () => ({
      scrollIntoViewIfNeeded: async () => {},
      waitFor: async () => {},
    }),
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];

  const count = await captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "navigation", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 10, timeoutMs: 300,
  }, async ({ id }) => captures.push(id));

  assert.equal(count, 1);
  assert.ok(evaluations > 2);
  assert.deepEqual(captures, ["navigation-section-01"]);
});

test("section checkpoints reset stability when rendered sections grow or mutate", async () => {
  const items = [{ outerHTML: '<section data-section-order="1">initial</section>' }];
  const locator = {
    evaluateAll: async (callback) => callback(items),
    nth: (index) => ({
      scrollIntoViewIfNeeded: async () => {},
      waitFor: async () => {},
    }),
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];
  setTimeout(() => {
    items[0].outerHTML = '<section data-section-order="1">final content</section>';
    items.push({ outerHTML: '<section data-section-order="2">new section</section>' });
  }, 20);

  const count = await captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "growing", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 20, timeoutMs: 300,
  }, async ({ id }) => captures.push(id));

  assert.equal(count, 2);
  assert.deepEqual(captures, ["growing-section-01", "growing-section-02"]);
});

test("section checkpoints propagate unrelated capture callback failures", async () => {
  const items = [{ outerHTML: '<section data-section-order="1">settled</section>' }];
  const locator = {
    evaluateAll: async (callback) => callback(items),
    nth: () => ({
      scrollIntoViewIfNeeded: async () => {},
      waitFor: async () => {},
    }),
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];

  await assert.rejects(captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "mutating", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 10, timeoutMs: 300,
  }, async ({ id }) => {
    captures.push(id);
    throw new Error("capture callback failed");
  }), /capture callback failed/u);

  assert.deepEqual(captures, ["mutating-section-01"]);
});

test("section checkpoints retry the whole batch when content mutates after the first capture", async () => {
  const items = [
    { outerHTML: '<section data-section-order="1">initial</section>' },
    { outerHTML: '<section data-section-order="2">stable footer</section>' },
  ];
  const locator = {
    evaluateAll: async (callback) => callback(items),
    nth: (index) => ({
      scrollIntoViewIfNeeded: async () => {},
      waitFor: async () => {},
    }),
  };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };
  const captures = [];
  let mutateAfterFirstCapture = true;

  const count = await captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "retry", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 10, timeoutMs: 500,
  }, async ({ id }) => {
    captures.push(id);
    if (mutateAfterFirstCapture) {
      mutateAfterFirstCapture = false;
      items[0].outerHTML = '<section data-section-order="1">final</section>';
    }
  });

  assert.equal(count, 2);
  assert.deepEqual(captures, [
    "retry-section-01",
    "retry-section-01",
    "retry-section-02",
  ]);
});

test("section checkpoints time out instead of returning an empty screenshot set", async () => {
  const locator = { evaluateAll: async (callback) => callback([]), nth: () => assert.fail("No section should be captured") };
  const page = { locator: () => locator, waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)) };

  await assert.rejects(captureScrolledSections(page, {
    selector: "[data-section-order]", idPrefix: "empty", checkpoint: "Section is settled.",
    maxSections: 10, stableForMs: 10, timeoutMs: 30,
  }, async () => assert.fail("No screenshot should be captured")), /No rendered sections appeared/u);
});

test("section checkpoints reject a page exceeding its configured section limit", async () => {
  const items = Array.from({ length: 3 }, (_, index) => ({ outerHTML: `<section>${index}</section>` }));
  const page = {
    locator: () => ({ evaluateAll: async (callback) => callback(items) }),
    waitForTimeout: (duration) => new Promise((resolve) => setTimeout(resolve, duration)),
  };
  await assert.rejects(captureScrolledSections(page, {
    selector: "[data-section-order]",
    idPrefix: "clone",
    checkpoint: "Generated section.",
    maxSections: 2,
    stableForMs: 1,
    timeoutMs: 500,
  }, async () => {}), /exceeds the configured maximum/u);
});
