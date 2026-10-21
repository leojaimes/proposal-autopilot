---
name: sandbox-qa
description: "Trigger: sandbox qa, visual plan, sandbox:run, sandbox:verify, e2e test, probar stack real, visual regression, visual checkpoints, generar sandbox qa. Generate and execute deterministic, zero-token Sandbox QA visual plans across local Docker and remote staging/production environments with arbitrary URLs."
license: Apache-2.0
metadata:
  author: spotlight-engineering
  version: "2.0"
---

# Sandbox QA: Declarative Visual Verification & E2E Testing

## Activation Contract

Activate this skill whenever you need to:
1. **Generate or modify Sandbox QA visual plans** (`.sandbox/visual-plans/<name>.json`) and requirements (`.sandbox/requirements/<name>.md`).
2. **Execute end-to-end visual tests with ZERO LLM token burn** across any product flavor (`pubmaster`, `nielsen`, `pageclone`).
3. **Run tests against Local Docker** (`:3008`, `:3014`, `:3015`, backend `:3007`) or **Remote Staging/Production** (`https://nielsen.spotlightus.org`, `https://pubmaster.spotlightus.org`, `https://clone.spotlightus.org`, or any arbitrary preview URL).
4. **Capture and verify visual checkpoints** (`.png`) for pull request walkthroughs without interactive browser subagents.

---

## 🛑 HARD RULES & GUARDRAILS

### 1. Zero-Token Visual Automation Directive (Anti-LLM-Burn)
- **STRICTLY PROHIBITED**: Never use interactive LLM browser subagents (`browser_subagent`) to click through and test UI flows. Doing so consumes hundreds of thousands of tokens and is prone to hallucinated loops.
- **MANDATORY**: Always execute tests via the native headless Playwright Sandbox QA runner:
  ```bash
  npm run sandbox:run -- --requirement .sandbox/requirements/<name>.md --visual-plan .sandbox/visual-plans/<name>.json
  ```
- **Walkthrough Evidence**: Reference the generated `.png` screenshots under `.sandbox/runs/<run-id>/visual/checkpoints/` in your walkthrough documentation.

### 2. Dual-Mode Execution: Local vs Remote Decoupling
- **Local Mode (Default)**: Verifies Docker daemon status, auto-starts containers (`pub-backend`, `publications-frontend*`), checks loopback ports (`:3008`, `:3014`, `:3015`, `:3007`), and enforces loopback origin confinement.
- **Remote Mode (`--remote` or `SANDBOX_REMOTE=1`)**: Bypasses local Docker checks completely. Validates HTTP target endpoints directly, allows arbitrary remote HTTP/HTTPS origins, and executes Playwright tests against live staging/production hosts. Docker Desktop is NOT required to be running.

### 3. Declarative Test Reusability (Write Once, Run Anywhere)
- Never create throwaway, one-off Playwright test scripts for standard user journeys.
- Define tests once declaratively as a **Visual Plan JSON** (`.sandbox/visual-plans/<name>.json`). The same plan runs seamlessly in local development, CI/CD, staging, and production simply by toggling `--remote`, `--target`, or `--url`.

### 4. Baseline Protection Invariant
- Visual snapshot baselines must NEVER be updated implicitly.
- Only pass `--update-visual-baselines` when intentionally establishing or upgrading approved visual references.

---

## 🚀 CLI Commands & Usage Reference

### 1. Local Docker Testing (Port 3008, 3014, 3015, 3007)
```bash
# Verify local stack and tunnel health
npm run sandbox:verify -- --requirement .sandbox/requirements/<req>.md

# Run full visual test plan against local Docker
npm run sandbox:run -- --requirement .sandbox/requirements/<req>.md --visual-plan .sandbox/visual-plans/<plan>.json

# Update baselines explicitly (when visual redesign is intentional)
npm run sandbox:run -- --requirement .sandbox/requirements/<req>.md --visual-plan .sandbox/visual-plans/<plan>.json --update-visual-baselines
```

### 2. Remote Staging / Production Testing (EasyPanel, Cloud, Custom Domains)
```bash
# Run against default production hosts (bypasses local Docker checks)
npm run sandbox:run -- --requirement .sandbox/requirements/<req>.md --visual-plan .sandbox/visual-plans/<plan>.json --remote

# Target a single product flavor in production
npm run sandbox:run -- --requirement .sandbox/requirements/<req>.md --visual-plan .sandbox/visual-plans/<plan>.json --remote --target nielsen

# Target an arbitrary custom URL (staging, PR preview, EasyPanel host)
npm run sandbox:run -- --requirement .sandbox/requirements/<req>.md --visual-plan .sandbox/visual-plans/<plan>.json --target nielsen --url https://staging-nielsen.spotlightus.org/es
```

### 3. Environment Variable Overrides
Any target or profile origin can be overridden via environment variables without altering files:
| Variable | Description | Default Local | Default Remote |
| :--- | :--- | :--- | :--- |
| `SANDBOX_REMOTE` | Force remote mode (`1` = active) | `0` | `1` |
| `SANDBOX_NIELSEN_ORIGIN` | Origin for Nielsen flavor | `http://127.0.0.1:3014` | `https://nielsen.spotlightus.org` |
| `SANDBOX_PUBMASTER_ORIGIN` | Origin for PubMaster flavor | `http://127.0.0.1:3008` | `https://pubmaster.spotlightus.org` |
| `SANDBOX_PAGECLONE_ORIGIN` | Origin for PageClone flavor | `http://127.0.0.1:3015` | `https://clone.spotlightus.org` |
| `SANDBOX_BACKEND_URL` | Backend health check URL | `http://127.0.0.1:3007/api/docs` | `https://pepper-tix-pub-backend...` |

Example:
```bash
SANDBOX_REMOTE=1 SANDBOX_NIELSEN_ORIGIN=https://preview-123.easypanel.host npm run sandbox:run -- --requirement .sandbox/requirements/nielsen-audit.md --visual-plan .sandbox/visual-plans/nielsen-audit.json
```

---

## 📋 Declarative Visual Plan Specification (V2)

A Visual Plan is a structured JSON document under `.sandbox/visual-plans/<name>.json`.

### Structure:
```json
{
  "version": 2,
  "viewport": { "width": 1440, "height": 900 },
  "maxDiffPixels": 1000,
  "storageState": ".sandbox/fixtures/auth-state.json",
  "stepTimeoutMs": 15000,
  "scenarioTimeoutMs": 120000,
  "scenarios": [
    {
      "id": "scenario-unique-id",
      "profile": "nielsen",
      "maskSelectors": [".dynamic-timestamp", "[data-testid='user-avatar']"],
      "steps": [
        { "action": "goto", "path": "/es/app/usability/nielsen" },
        { "action": "waitFor", "selector": "[data-testid='nielsen-grid']", "state": "visible" },
        { "action": "click", "selector": "button[type='submit']" },
        { "action": "fill", "selector": "input[name='url']", "valueFromEnv": "TEST_AUDIT_URL" },
        {
          "action": "screenshot",
          "id": "checkpoint-step-name",
          "checkpoint": "User can see audit results loaded successfully.",
          "fullPage": true,
          "maxDiffPixels": 2000,
          "maskSelectors": [".random-seed"]
        }
      ]
    }
  ]
}
```

### Supported Step Actions:
1. `goto`: `{ "action": "goto", "path": "/relative/path" }` (First step MUST always be `goto`).
2. `click`: `{ "action": "click", "selector": "button.submit", "timeoutMs": 5000 }`
3. `fill`: `{ "action": "fill", "selector": "input#email", "valueFromEnv": "TEST_USER_EMAIL" }` (Protects secrets by pulling exclusively from environment variables).
4. `waitFor`: `{ "action": "waitFor", "selector": ".ready-indicator", "state": "visible|hidden|attached|detached" }`
5. `screenshot`: `{ "action": "screenshot", "id": "<safe-id>", "checkpoint": "<description>", "fullPage": true, "maxDiffPixels": 1000 }`

---

## ⚡ Handling Stateful Live AI & Long-Running Pipelines

When testing real production stacks involving external AI services (Gemini Vision, AWS Lambda Scrapers, scraping agents):
1. **Never use static `sleep`**: Use reactive `waitFor` on DOM mutations or indicators:
   ```json
   { "action": "waitFor", "selector": "[data-mark-id='1']", "state": "visible", "timeoutMs": 180000 }
   ```
2. **Realistic Timeouts**: Real AI analysis pipelines take 90s to 150s. Set `scenarioTimeoutMs: 240000` and step `timeoutMs: 180000` for scenarios involving full audits.
3. **Mask Dynamic Elements**: Timestamps, real-time credit counters, and random test user IDs MUST be masked in screenshots to ensure repeatable pixel comparisons:
   ```json
   "maskSelectors": ["[data-testid='credit-balance']", ".time-ago", ".audit-id"]
   ```

---

## 🛠️ Step-by-Step Workflow for New Features

1. **Create Requirement**:
   Write `.sandbox/requirements/<feature-name>.md` detailing acceptance criteria.
2. **Create Visual Plan**:
   Write `.sandbox/visual-plans/<feature-name>.json` defining user journey and checkpoints.
3. **Verify Locally (or Remotely)**:
   ```bash
   # Local run
   npm run sandbox:run -- --requirement .sandbox/requirements/<feature-name>.md --visual-plan .sandbox/visual-plans/<feature-name>.json

   # Remote run against staging/prod
   npm run sandbox:run -- --requirement .sandbox/requirements/<feature-name>.md --visual-plan .sandbox/visual-plans/<feature-name>.json --remote
   ```
4. **Approve Baselines** (Initial Creation Only):
   ```bash
   npm run sandbox:run -- --requirement .sandbox/requirements/<feature-name>.md --visual-plan .sandbox/visual-plans/<feature-name>.json --update-visual-baselines
   ```
5. **Attach Evidence**:
   Include the checkpoint PNGs from `.sandbox/runs/<run-id>/visual/checkpoints/` in your walkthrough.
