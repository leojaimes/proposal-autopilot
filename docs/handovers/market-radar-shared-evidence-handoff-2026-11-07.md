# Market Radar shared evidence: local-deployment handoff

The shared market-evidence feature is implemented and unit-tested. The remaining task is to rebuild the **local backend and frontend** so the Docker-served Radar uses the current source, then rerun the existing Sandbox QA plan. No Apify call is required for this step.

## Quick path

1. In an elevated PowerShell, restore Docker CLI communication:

   ```powershell
   Start-Service com.docker.service
   docker version
   ```

   Continue only when `docker version` prints both `Client` and `Server` sections.

2. From the repository root, rebuild only the application services:

   ```powershell
   docker compose up -d --build backend frontend
   ```

   This leaves the `postgres` service and its named volume untouched.

3. Run the visual regression flow:

   ```powershell
   npm run sandbox:run -- --remote --target nielsen --url http://127.0.0.1:7001 --requirement .sandbox/requirements/market-radar-shared-evidence-local.md --visual-plan .sandbox/visual-plans/market-radar-shared-evidence-local.json
   ```

## What changed

| Area | Result |
| --- | --- |
| Shared catalog evidence | `SharedMarketEvidenceService` aggregates shared Upwork jobs by segment and exposes sample count, date range, and coverage status. |
| Radar API | `GET /scraping/market-radar` returns `sharedMarketEvidence` separately from tenant-specific categories and fit. |
| Radar UI | A `Shared market evidence` section makes global evidence visible without implying it is a tenant's personal fit. |
| Ingestion safety | The approved-page path distinguishes actor polling failure from import failure and preserves cursor evidence. |
| QA | The declarative Sandbox QA flow opens `/radar/market`, asserts the shared-evidence region and partial coverage, then captures a full-page checkpoint. |

## Validation already completed

- Backend focused suite: 24 passing tests for the Apify actor client, approved-page command, page workflow, and runner script.
- Angular focused component test: passed after adding the shared-evidence section.
- Node date utility test: 3 passing tests; it was excluded from Angular's TypeScript spec compilation because it is a Node-native test.
- Sandbox QA reaches the local application and passes its HTTP check.

## Current blocker and interpretation

The current Docker images are older than the source changes. Sandbox QA correctly fails its Playwright assertion waiting for `[aria-label='Shared market evidence']`; this is deployment drift, not evidence that the component implementation is absent.

Docker Desktop's UI showed **Engine running**, but the CLI from the agent and the user's terminal stalled. A read-only service check found:

```text
com.docker.service  Stopped  Manual
```

The agent's attempt to start that service was denied by Windows service permissions. Use an elevated user terminal for the quick-path commands above. Do not run another Apify scrape while resolving this local deployment issue.

## Scope and safety

- No commit or production deployment has been made.
- No local database rows need to be deleted or recreated.
- A local synthetic QA user and a Playwright storage-state fixture were created solely to make the visual test authenticated. The fixture is under `.sandbox/` and is ignored by Git.
- An Apify token was saved only in a Git-ignored local pending file. Do not copy it into source, test output, handoffs, backups, or commits. It is not needed for this handoff's verification.

## Completion checklist

- [ ] `docker version` reports both Client and Server.
- [ ] `docker compose up -d --build backend frontend` completes.
- [ ] Sandbox QA passes both the HTTP and Playwright checks.
- [ ] The checkpoint shows `Shared market evidence`, `social-media-content`, and `Partial coverage`.
- [ ] Review the uncommitted diff before any commit; keep credentials and `.sandbox/fixtures/` out of Git.
