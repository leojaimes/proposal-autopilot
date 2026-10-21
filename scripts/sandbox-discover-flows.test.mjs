import assert from "node:assert/strict";
import test from "node:test";

import { buildDiscoveryPlan, parseDiscoverArgs } from "./sandbox-discover-flows.mjs";
import { validateVisualPlan } from "./sandbox-visual-plan.mjs";

test("parseDiscoverArgs parses defaults correctly", () => {
  const options = parseDiscoverArgs(["--target", "nielsen", "--path", "/es/app/usability/nielsen"]);
  assert.equal(options.target, "nielsen");
  assert.equal(options.path, "/es/app/usability/nielsen");
  assert.equal(options.remote, false);
  assert.match(options.out, /nielsen-app-usability-nielsen-auto\.json/u);
});

test("parseDiscoverArgs rejects invalid target", () => {
  assert.throws(
    () => parseDiscoverArgs(["--target", "invalid", "--path", "/es"]),
    /Target must be one of: pubmaster, nielsen, pageclone/u
  );
});

test("parseDiscoverArgs rejects path without leading slash", () => {
  assert.throws(
    () => parseDiscoverArgs(["--target", "pubmaster", "--path", "es/app"]),
    /Path must start with a forward slash/u
  );
});

test("buildDiscoveryPlan produces a V2 plan fully compliant with sandbox-visual-plan parser", async () => {
  const discoveredElements = {
    tabs: [
      { id: "tab-audits", label: "Auditorías", selector: "[data-testid='tab-audits']" },
      { id: "tab-reports", label: "Reportes", selector: "[data-testid='tab-reports']" },
    ],
    modals: [
      {
        id: "btn-new-audit",
        label: "Nueva Auditoría",
        selector: "[data-testid='new-audit-btn']",
        waitForSelector: "[role='dialog']",
        closeSelector: "[role='dialog'] button[aria-label='Close']",
      },
    ],
    viewSwitchers: [
      { id: "view-split", label: "Vista Dividida", selector: "button[title='Vista Dividida']" },
    ],
  };

  const plan = buildDiscoveryPlan({
    target: "nielsen",
    targetPath: "/es/app/usability/nielsen",
    discoveredElements,
  });

  // Verify internal structure
  assert.equal(plan.version, 2);
  assert.equal(plan.scenarios[0].profile, "nielsen");
  const screenshots = plan.scenarios[0].steps.filter((s) => s.action === "screenshot");
  // 1 landing + 2 tabs + 1 modal + 1 view = 5 screenshots
  assert.equal(screenshots.length, 5);

  // Validate compliance with sandbox-visual-plan.mjs schema parser!
  const parsed = validateVisualPlan(plan, {
    env: { SANDBOX_NIELSEN_ORIGIN: "http://127.0.0.1:3014" },
  });
  assert.equal(parsed.version, 2);
  assert.equal(parsed.scenarios.length, 1);
  assert.equal(parsed.scenarios[0].steps.length, plan.scenarios[0].steps.length);
});
