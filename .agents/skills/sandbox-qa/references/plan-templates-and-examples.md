# Sandbox QA: Plan Templates & Examples

This reference provides ready-to-use visual plan templates for common testing workflows across product flavors.

---

## 1. Quick Flavor Entry Smoke Test (Version 1 Plan)
Ideal for fast verification of landing page routing and initial DOM readiness.

`.sandbox/visual-plans/flavor-smoke.json`:
```json
{
  "version": 1,
  "viewport": { "width": 1440, "height": 900 },
  "scenarios": [
    {
      "id": "pubmaster-entry",
      "checkpoint": "PubMaster landing entry is loaded and styled.",
      "profile": "pubmaster",
      "path": "/es",
      "waitForSelector": "body",
      "maskSelectors": [".timestamp", "[data-testid='live-badge']"]
    },
    {
      "id": "nielsen-entry",
      "checkpoint": "Nielsen landing entry is loaded and styled.",
      "profile": "nielsen",
      "path": "/es",
      "waitForSelector": "body",
      "maskSelectors": [".timestamp"]
    },
    {
      "id": "pageclone-entry",
      "checkpoint": "PageClone landing entry is loaded and styled.",
      "profile": "pageclone",
      "path": "/es",
      "waitForSelector": "body"
    }
  ]
}
```

---

## 2. Multi-Step User Journey with Form Interaction (Version 2 Plan)
Ideal for testing authenticated flows, onboarding forms, and interactive state changes.

`.sandbox/visual-plans/nielsen-audit-journey.json`:
```json
{
  "version": 2,
  "viewport": { "width": 1440, "height": 900 },
  "maxDiffPixels": 2000,
  "storageState": ".sandbox/fixtures/authenticated-session.json",
  "stepTimeoutMs": 15000,
  "scenarioTimeoutMs": 180000,
  "scenarios": [
    {
      "id": "nielsen-audit-generation-flow",
      "profile": "nielsen",
      "maskSelectors": ["[data-testid='user-balance']", ".time-stamp"],
      "steps": [
        {
          "action": "goto",
          "path": "/es/app/usability/nielsen"
        },
        {
          "action": "waitFor",
          "selector": "input[name='targetUrl']",
          "state": "visible"
        },
        {
          "action": "fill",
          "selector": "input[name='targetUrl']",
          "valueFromEnv": "SANDBOX_AUDIT_TARGET_URL"
        },
        {
          "action": "click",
          "selector": "button[type='submit']"
        },
        {
          "action": "screenshot",
          "id": "01-audit-started-state",
          "checkpoint": "Audit progress ring or banner is displayed.",
          "fullPage": false
        },
        {
          "action": "waitFor",
          "selector": "[data-testid='audit-completed-score']",
          "state": "visible",
          "timeoutMs": 120000
        },
        {
          "action": "screenshot",
          "id": "02-audit-results-with-soms",
          "checkpoint": "Completed Nielsen report with score ring and Set-of-Mark pins.",
          "fullPage": true,
          "maxDiffPixels": 3000
        }
      ]
    }
  ]
}
```

---

## 3. Storage State Fixtures
When testing authenticated views, place storage state files strictly within `.sandbox/fixtures/` (e.g. `.sandbox/fixtures/session.json`). The schema validator prohibits references outside `.sandbox/` to prevent credential leakage.
