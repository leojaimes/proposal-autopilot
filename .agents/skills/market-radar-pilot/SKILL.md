---
name: market-radar-pilot
description: "Trigger: market radar pilot, live Upwork radar E2E, ejecutar Radar, scrape y validar Radar. Orchestrate safe Apify ingestion, persisted snapshot checks, and declarative Playwright evidence."
license: Apache-2.0
metadata:
  author: spotlight-engineering
  version: "1.0"
---

## Activation Contract

Use this skill for a new Market Radar pilot, a live Upwork ingestion, or a full Radar E2E revalidation.

## Hard Rules

- Never print `APIFY_TOKEN`; verify only that it is configured.
- Check `batch_runs` for an active or matching completed batch before triggering Apify. Reuse completed data when possible.
- The active actor is `flash_mage/upwork`; verify that returned URLs are real `upwork.com/jobs/...` URLs and record the actor in the handoff.
- Do not claim that every requested filter is enforced unless the trigger and actor actually persist it. Report unsupported filters explicitly.
- Never apply the deterministic fixture over non-empty snapshots. Use a read-only live plan or an isolated database; clean only rows marked by the fixture.
- Use declarative Sandbox QA plans, not interactive browser agents or static sleeps. Scope text selectors to a unique row/section to avoid Playwright strict-mode failures.

## Execution Steps

1. Read `references/market-radar-live-runbook.md` and inspect Docker, token presence, and recent batches.
2. Trigger only with explicit approval, then poll until `COMPLETED` or `FAILED`.
3. Validate job count, structured fields, source URLs, snapshot health, and Radar category coverage.
4. Run the reusable `.sandbox/requirements/market-radar-live-e2e.md` and `.sandbox/visual-plans/market-radar-live-e2e.json` plan.
5. Record the batch ID, Sandbox run ID, checkpoints, limitations, and cleanup status in the handoff.

## Output Contract

Return batch status/counts, Radar health and visible categories, Playwright result and screenshot paths, active actor, known filter limitations, and whether any fixture data was touched.

## References

- `references/market-radar-live-runbook.md`
- `../../.sandbox/requirements/market-radar-live-e2e.md`
- `../../.sandbox/visual-plans/market-radar-live-e2e.json`
