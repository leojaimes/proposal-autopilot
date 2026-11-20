# Market Radar shared evidence: verified local deployment

The shared market-evidence feature is implemented, deployed to the local backend and frontend, and verified through Sandbox QA. No Apify call was required.

## Verified outcome

1. Docker CLI communication was restored; `docker version` returned server version `28.4.0`.

2. The local application services were rebuilt and restarted:

   ```powershell
   docker compose up -d --build backend frontend
   ```

3. Sandbox QA passed both checks on 2026-11-20:

   ```powershell
   npm run sandbox:run -- --remote --target nielsen --url http://127.0.0.1:7001 --requirement .sandbox/requirements/market-radar-shared-evidence-local.md --visual-plan .sandbox/visual-plans/market-radar-shared-evidence-local.json
   ```

   Evidence: `.sandbox/runs/2026-11-20T14-30-16-715Z-46a82a88`.

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
- Sandbox QA passes both the HTTP check and the authenticated Playwright flow after rebuilding backend and frontend.

## Resolved blockers and follow-up

The earlier stale-image failure was resolved by rebuilding the backend and frontend. The initial regenerated backend invalidated the prior synthetic QA token; regenerating the local QA storage state resolved the authenticated Playwright run.

The frontend Docker context transferred approximately 4 GB during the build. This does not affect Radar correctness, but `frontend/.dockerignore` should be tightened in a separate change to exclude local dependency and cache directories.

Docker Desktop's UI showed **Engine running**, but the CLI had temporarily stalled. A read-only service check found:

```text
com.docker.service  Stopped  Manual
```

The Docker CLI subsequently recovered without deleting images, containers, or database data. Do not run another Apify scrape solely for this deployment validation.

## Scope and safety

- No commit or production deployment has been made.
- No local database rows need to be deleted or recreated.
- A local synthetic QA user and a Playwright storage-state fixture were created solely to make the visual test authenticated. The fixture is under `.sandbox/` and is ignored by Git.
- An Apify token was saved only in a Git-ignored local pending file. Do not copy it into source, test output, handoffs, backups, or commits. It is not needed for this handoff's verification.

## Completion checklist

- [x] `docker version` reports both Client and Server.
- [x] `docker compose up -d --build backend frontend` completes.
- [x] Sandbox QA passes both the HTTP and Playwright checks.
- [x] The checkpoint shows `Shared market evidence`, `social-media-content`, and `Partial coverage`.
- [ ] Review the uncommitted diff before any commit; keep credentials and `.sandbox/fixtures/` out of Git.
