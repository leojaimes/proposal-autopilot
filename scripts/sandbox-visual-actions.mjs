function rejectedStateLocator(page, selector) {
  const locator = page.locator(selector);
  if (/\[role\s*=\s*(["'])?alert\1\s*\]/iu.test(selector)) {
    return locator.filter({ hasText: /\S/u });
  }
  return locator;
}

export async function waitForVisualCondition(page, step) {
  const target = page.locator(step.selector).waitFor({ state: step.state, timeout: step.timeoutMs });
  const failures = (step.rejectSelectors || []).map((selector) => rejectedStateLocator(page, selector)
    .waitFor({ state: "visible", timeout: step.timeoutMs })
    .then(() => selector, () => new Promise(() => {})));
  const failureSelector = await Promise.race([...failures, target.then(() => null)]);
  if (failureSelector) {
    throw new Error(`Visual wait failed because an error state became visible: ${failureSelector}`);
  }
  for (const selector of step.rejectSelectors || []) {
    if (await rejectedStateLocator(page, selector).isVisible()) {
      throw new Error(`Visual wait failed because an error state became visible: ${selector}`);
    }
  }
}

function withActionTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`DOM probe timed out while ${label}.`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

export async function captureRenderedDomProbe(page, step) {
  const scope = step.frameSelector ? page.frameLocator(step.frameSelector) : page;
  const documentRoot = scope.locator("html");
  const deadline = Date.now() + step.timeoutMs;
  const remaining = () => Math.max(1, deadline - Date.now());
  await withActionTimeout(
    documentRoot.waitFor({ state: "attached", timeout: remaining() }),
    remaining(),
    "resolving the document root",
  );
  const evaluationTimeoutMs = Math.max(1, remaining() - 25);
  return withActionTimeout(documentRoot.evaluate(async (root, options) => {
    const doc = root.ownerDocument;
    const win = doc.defaultView;
    const evaluationDeadline = Date.now() + options.timeoutMs;
    const remaining = () => Math.max(1, evaluationDeadline - Date.now());
    const withinDeadline = async (promise, label) => {
      let timer;
      try {
        return await Promise.race([
          promise,
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error(`DOM probe timed out while waiting for ${label}.`)), remaining());
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    };

    if (doc.fonts?.ready) await withinDeadline(doc.fonts.ready, "fonts");
    const maxTextChildNodesPerElement = 100;
    const totalImageCount = doc.images.length;
    const scannedImageCount = Math.min(totalImageCount, options.maxElements);
    const imagesTruncated = totalImageCount > scannedImageCount;
    const visibleImages = Array.from({ length: scannedImageCount }, (_, index) => doc.images[index]).filter((image) => {
      const rect = image.getBoundingClientRect();
      const style = win.getComputedStyle(image);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    });
    const pendingImageWaits = new Set();
    const waitForImage = (image) => new Promise((resolve) => {
      let settled = false;
      const cleanup = () => {
        image.removeEventListener("load", onReady);
        image.removeEventListener("error", onReady);
        pendingImageWaits.delete(cancel);
      };
      const settle = (ready) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(ready);
      };
      const onReady = () => settle(true);
      const cancel = () => settle(false);
      pendingImageWaits.add(cancel);
      image.addEventListener("load", onReady, { once: true });
      image.addEventListener("error", onReady, { once: true });
    });
    try {
      const imageReady = visibleImages.map((image) => image.complete || waitForImage(image));
      await withinDeadline(Promise.all(imageReady), "visible images");
    } finally {
      for (const cancel of [...pendingImageWaits]) cancel();
    }

    await withinDeadline(new Promise((resolve, reject) => {
      let stableTimer;
      const cleanup = () => {
        observer.disconnect();
        clearTimeout(stableTimer);
        clearTimeout(deadlineTimer);
      };
      const finish = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error("DOM probe timed out while waiting for a stable DOM.")); };
      const observer = new MutationObserver(() => {
        clearTimeout(stableTimer);
        stableTimer = setTimeout(finish, options.stableForMs);
      });
      const deadlineTimer = setTimeout(fail, remaining());
      observer.observe(doc.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
      stableTimer = setTimeout(finish, options.stableForMs);
    }), "a stable DOM");

    const semanticSelector = "address, article, aside, blockquote, button, caption, dd, details, dialog, dt, fieldset, figcaption, figure, footer, form, h1, h2, h3, h4, h5, h6, header, img, input, label, li, main, nav, ol, option, p, section, select, summary, svg, table, td, textarea, th, ul, [role], [aria-label], [data-section-order]";
    const styleProperties = [
      "display", "position", "box-sizing", "width", "height", "font-family", "font-size", "font-weight", "line-height", "letter-spacing",
      "color", "background-color", "background-image", "text-align", "text-transform", "padding-top", "padding-right", "padding-bottom", "padding-left",
      "margin-top", "margin-right", "margin-bottom", "margin-left", "gap", "row-gap", "column-gap", "border-top-width", "border-right-width",
      "border-bottom-width", "border-left-width", "border-top-style", "border-right-style", "border-bottom-style", "border-left-style",
      "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "border-top-left-radius", "border-top-right-radius",
      "border-bottom-right-radius", "border-bottom-left-radius", "object-fit", "overflow", "opacity", "z-index",
    ];
    const styleValue = (property, value) => {
      const sanitized = property === "background-image" ? value.replace(/url\([^)]*\)/gu, "url([asset])") : value;
      return sanitized.slice(0, 160);
    };
    const attributeValue = (element, name) => element.getAttribute(name)?.slice(0, 240) || undefined;
    const round = (value) => Math.round(value * 100) / 100;
    const visible = (element) => {
      const rect = element.getBoundingClientRect();
      const style = win.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) !== 0;
    };
    const readOwnText = (element) => {
      const childNodes = element.childNodes;
      const childNodeCount = childNodes.length;
      const inspectedChildCount = Math.min(childNodeCount, maxTextChildNodesPerElement);
      let rawText = "";
      let textTruncated = childNodeCount > inspectedChildCount;
      for (let childIndex = 0; childIndex < inspectedChildCount; childIndex += 1) {
        if (Date.now() >= evaluationDeadline) throw new Error("DOM probe timed out while reading element text.");
        const node = childNodes[childIndex];
        if (node.nodeType !== 3) continue;
        const availableChars = 240 - rawText.length;
        if (availableChars <= 0) {
          textTruncated = true;
          break;
        }
        const value = node.textContent || "";
        if (value.length > availableChars) textTruncated = true;
        rawText += value.slice(0, availableChars);
      }
      return { text: rawText.replace(/\s+/gu, " ").trim().slice(0, 240), textTruncated };
    };
    const elements = [];
    const maxVisitedNodes = Math.min(options.maxElements * 20, 10000);
    const walker = doc.createTreeWalker(doc.body, win.NodeFilter.SHOW_ELEMENT);
    const isStructuralCandidate = (node) => node.matches(semanticSelector) || node.tagName === "DIV";
    let visitedNodes = 0;
    let truncated = imagesTruncated;
    let traversalLimitReached = false;
    let element = walker.nextNode();
    while (element) {
      if (Date.now() >= evaluationDeadline) throw new Error("DOM probe timed out while collecting rendered elements.");
      if (visitedNodes >= maxVisitedNodes) {
        truncated = true;
        traversalLimitReached = true;
        break;
      }
      visitedNodes += 1;
      const semanticOrLayoutCandidate = isStructuralCandidate(element);
      const ownText = readOwnText(element);
      if (!semanticOrLayoutCandidate && !ownText.text) {
        element = walker.nextNode();
        continue;
      }
      const rect = element.getBoundingClientRect();
      const style = win.getComputedStyle(element);
      const isVisible = rect.width > 0 && rect.height > 0
        && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) !== 0;
      if (isVisible && elements.length < options.maxElements) {
        const tag = element.tagName.toLowerCase();
        const record = {
          index: elements.length,
          tag,
          text: ownText.text || undefined,
          textTruncated: ownText.textTruncated || undefined,
          role: attributeValue(element, "role") || attributeValue(element, "aria-roledescription"),
          ariaLabel: attributeValue(element, "aria-label"),
          ariaLabelledby: attributeValue(element, "aria-labelledby"),
          alt: attributeValue(element, "alt"),
          sectionOrder: element.getAttribute("data-section-order") || undefined,
          rect: {
            x: round(rect.x + win.scrollX), y: round(rect.y + win.scrollY),
            width: round(rect.width), height: round(rect.height),
          },
          styles: Object.fromEntries(styleProperties.map((property) => [property, styleValue(property, style.getPropertyValue(property))])),
        };
        for (const key of Object.keys(record)) if (record[key] === undefined) delete record[key];
        elements.push(record);
      } else if (isVisible) {
        truncated = true;
        break;
      }
      element = walker.nextNode();
    }
    const body = doc.body;
    return {
      schemaVersion: 1,
      source: { pathname: win.location.pathname, frame: Boolean(win.frameElement) },
      viewport: { width: win.innerWidth, height: win.innerHeight, devicePixelRatio: win.devicePixelRatio },
      document: {
        width: Math.max(doc.documentElement.scrollWidth, body?.scrollWidth || 0),
        height: Math.max(doc.documentElement.scrollHeight, body?.scrollHeight || 0),
      },
      coverage: {
        imageCount: totalImageCount,
        imagesScanned: scannedImageCount,
        visibleImagesAwaited: visibleImages.length,
        imagesTruncated,
        maxElements: options.maxElements,
        maxTextChildNodesPerElement,
        traversalLimitReached,
        maxVisitedNodes,
      },
      elementCount: elements.length,
      truncated,
      elements,
    };
  }, {
    timeoutMs: evaluationTimeoutMs,
    stableForMs: step.stableForMs,
    maxElements: step.maxElements,
  }), remaining(), "evaluating the document probe");
}

export async function captureScrolledSections(page, step, capture) {
  const scope = step.frameSelector ? page.frameLocator(step.frameSelector) : page;
  const sections = scope.locator(step.selector);
  const deadline = Date.now() + step.timeoutMs;

  while (Date.now() < deadline) {
    const settledSections = await waitForStableSections(sections, page, step, deadline);
    const count = settledSections.length;
    if (count > step.maxSections) {
      throw new Error(`Section checkpoint count ${count} exceeds the configured maximum ${step.maxSections}.`);
    }

    let batchChanged = false;
    for (let index = 0; index < count; index += 1) {
      const currentSections = await readSectionSnapshot(sections);
      if (!currentSections || !sameSectionSnapshot(currentSections, settledSections)) {
        batchChanged = true;
        break;
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) break;
      const section = sections.nth(index);
      await section.scrollIntoViewIfNeeded({ timeout: remainingMs });
      await section.waitFor({ state: "visible", timeout: Math.max(1, deadline - Date.now()) });
      const ordinal = String(index + 1).padStart(2, "0");
      await capture({
        ...step,
        timeoutMs: Math.max(1, deadline - Date.now()),
        id: `${step.idPrefix}-section-${ordinal}`,
        checkpoint: `${step.checkpoint} (section ${index + 1} of ${count})`,
        fullPage: false,
        captureOnly: true,
      });
      const sectionsAfterCapture = await readSectionSnapshot(sections);
      if (!sectionsAfterCapture || !sameSectionSnapshot(sectionsAfterCapture, settledSections)) {
        batchChanged = true;
        break;
      }
    }

    if (!batchChanged && Date.now() < deadline) return count;
  }

  throw new Error(`Rendered sections kept changing before a complete batch could be captured within the ${step.timeoutMs}ms timeout.`);
}

async function waitForStableSections(sections, page, step, deadline) {
  const timeoutMs = step.timeoutMs;
  const stableForMs = step.stableForMs ?? 3000;
  const pollIntervalMs = Math.min(100, Math.max(10, stableForMs));
  let lastSignature = null;
  let stableSince = null;
  let sawSections = false;

  while (Date.now() <= deadline) {
    let html;
    try {
      html = await sections.evaluateAll((elements) => elements.map((element) => element.outerHTML));
    } catch (error) {
      if (!isTransientNavigationError(error)) throw error;
      lastSignature = null;
      stableSince = null;
    }

    if (html?.length > 0) {
      sawSections = true;
      const signature = JSON.stringify({ count: html.length, html });
      if (signature !== lastSignature) {
        lastSignature = signature;
        stableSince = Date.now();
      } else if (Date.now() - stableSince >= stableForMs) {
        return html;
      }
    } else if (html) {
      lastSignature = null;
      stableSince = null;
    }

    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) break;
    await page.waitForTimeout(Math.min(pollIntervalMs, remainingMs));
  }

  throw new Error(sawSections
    ? `Rendered sections did not remain unchanged for ${stableForMs}ms within the ${timeoutMs}ms timeout.`
    : `No rendered sections appeared within the ${timeoutMs}ms timeout.`);
}

async function readSectionSnapshot(sections) {
  try {
    return await sections.evaluateAll((elements) => elements.map((element) => element.outerHTML));
  } catch (error) {
    if (isTransientNavigationError(error)) return null;
    throw error;
  }
}

function sameSectionSnapshot(left, right) {
  return left.length === right.length && JSON.stringify(left) === JSON.stringify(right);
}

function isTransientNavigationError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /execution context was destroyed|most likely because of a navigation|cannot find context with specified id/iu.test(message);
}
