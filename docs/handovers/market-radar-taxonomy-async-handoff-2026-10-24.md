# Market Radar taxonomy and async updates — handoff

## Current status

The taxonomy reliability work is in progress. Phases 1 and 2 are implemented and verified locally. Phase 3 has an incomplete implementation and must not be treated as ready. Phase 4 has not started.

## Completed and verified

### Phase 1 — auditable classification

- `JobPost` records `PENDING`, `CLASSIFIED`, `FALLBACK`, or `FAILED`, including classifier version, taxonomy version, fallback reason, error, and completion time.
- `JobCategoryAssignment` stores taxonomy version.
- Missing `other-services` fallback is an explicit failure instead of a silent successful classification.
- Replaying a classification retains one primary assignment.

### Phase 2 — durable classification delivery

- `taxonomy_classification_work` provides a database-backed queue created transactionally with the job ingest.
- Work uses leases, owner tokens, compare-and-set completion/failure, retries, terminal errors, and startup recovery.
- A stale worker cannot overwrite a newer owner or mark its job as failed.
- Reprocess uses the same work contract.
- The migration deduplicates historical primary assignments before adding the partial unique index.
- Recovery schedules a Radar rebuild for tenants whose recovered work completed.

Validated before beginning Phase 3:

- Prisma validation and generated client.
- Backend TypeScript typecheck.
- Classifier and event-worker unit specs.
- Local PostgreSQL integration for idempotent replay, duplicate delivery, stale completion/failure, terminal retry, tenant isolation, and one primary assignment.
- `git diff --check`.

## Phase 3 — partial and blocked

The schema migration `20261023210000_market_radar_snapshot_revisions` and `MarketSnapshotService` have been changed toward immutable, content-addressed revisions:

- A revision contains metrics, evidence, taxonomy lineage, profile opportunities, and a content hash.
- Identical content reuses the current revision.
- Changed content creates a new revision and deactivates the prior current revision.
- Earlier decision-linked snapshots are not rewritten.

The partial implementation compiled after `npx prisma generate` and the backend TypeScript typecheck, but it is not complete or fully tested.

### Required next work

1. Complete `market-radar-rebuild-queue.service.ts` so work scheduled during an active rebuild arms a follow-up rebuild after the current one finishes.
2. Read only `isCurrent: true` revisions in:
   - `market-radar-operations.service.ts` health calculations.
   - Market Radar GET query in `scraping.controller.ts`.
3. Update snapshot integration coverage for removed `uq_market_snapshot_version` and add:
   - same payload reuses the current revision;
   - changed payload with an existing decision creates a new revision and preserves the old evidence/metrics;
   - health and GET return only the current revision;
   - tenant isolation.
4. Add a focused queue test for `schedule()` while rebuild is running.
5. Apply the Phase 3 migration to the local Docker PostgreSQL database, then run focused tests, Prisma validation, TypeScript typecheck, and `git diff --check`.

## Phase 4 — not started

- Revision-aware SSE events and recovery after reconnect.
- `READY` based on classification completion plus current valid snapshot.
- UI states for pending/retrying/failed work and stale data.
- Reconciliation report, latency measurements, and browser E2E for progressive Radar refresh.

## Important files

- `docs/plans/market-radar-taxonomy-async-validation-2026-10-23.md` — approved four-phase plan.
- `backend/prisma/schema.prisma` — classification state, durable work queue, and partial snapshot revision model.
- `backend/prisma/migrations/20261023190000_taxonomy_classification_audit_state/migration.sql` — Phase 1.
- `backend/prisma/migrations/20261023200000_taxonomy_classification_work_outbox/migration.sql` — Phase 2.
- `backend/prisma/migrations/20261023210000_market_radar_snapshot_revisions/migration.sql` — partial Phase 3; do not deploy until the remaining items above are complete and verified.
- `backend/src/modules/scraping/services/taxonomy-classification-work.service.ts` — durable work queue.
- `backend/src/modules/scraping/services/taxonomy-classification-events.service.ts` — work drain and Radar rebuild scheduling.
- `backend/src/modules/scraping/services/market-snapshot.service.ts` — partial immutable revision implementation.
- `backend/src/modules/scraping/services/market-radar-rebuild-queue.service.ts` — queue race still open.

## Safe restart sequence

1. Inspect the dirty tree before editing. Preserve unrelated untracked `.agents/skills/*`, `AGENTS.md`, and `CLAUDE.md` files.
2. Finish Phase 3 before touching SSE or frontend behavior.
3. Use the local Docker PostgreSQL database at `127.0.0.1:5438` for integration tests; the host default database URL may point at the Docker hostname and fail outside the container.
4. After Phase 3 passes, run a fresh-context review before beginning Phase 4.

## No external changes

No commit, push, deployment, or production migration was made in this work session.
