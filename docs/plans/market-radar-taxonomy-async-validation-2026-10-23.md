# Validate taxonomy and asynchronous Market Radar updates

## Outcome and current path

Every ingested job must have an auditable classification, and the Radar must eventually show a snapshot derived from those classifications without slowing ingestion. Validate the whole path before adding filters or visual polish:

`JobPost upsert → classification event → primary taxonomy assignment → Radar rebuild → snapshot/evidence → SSE → refreshed table`.

Today classification runs through an in-memory RxJS worker with concurrency 4. A deterministic `other-services` fallback exists; Radar rebuilds are debounced and the UI listens for `radarSnapshotUpdated`. These mechanisms have focused tests, but the complete path and failure/restart behavior still need proof. Treat the findings below as verification targets, not as already fixed behavior.

## Phase 1 — Trust each incoming job

**Demonstration:** ingest a mixed fixture containing an exact match, ambiguous match, no match, missing source metrics, duplicate job and two tenants. Inspect each job and its classification in the UI.

- **DB:** enforce at most one current primary assignment per tenant and job, with taxonomy version, rule/evidence, confidence and explicit fallback reason. Record classification state (`pending`, `classified`, `fallback`, `failed`) so an absent fallback rule cannot look successful.
- **Backend:** validate source identity and normalize title/description before deterministic classification. Resolve missing fallback rules as a visible failure; never mark the worker successful when the classifier returns no assignment. Keep LLM out of the hot path.
- **Frontend:** show classification state, chosen category and evidence on the job detail; distinguish fallback from a confident rule match and unknown source fields from zero.
- **Unit tests:** rule precedence, ambiguity, missing fallback rule, duplicate event, source normalization and null-versus-zero metrics.
- **Integration tests:** real test DB verifies JobPost upsert → one tenant-scoped primary assignment, fallback evidence, idempotent replay and an explicit failed state when taxonomy configuration is incomplete.
- **Exit:** 100% of accepted fixture jobs have exactly one primary classification or a visible failure. No silent `unclassified` record is counted as classified.

## Phase 2 — Deliver classification reliably

**Demonstration:** ingest jobs, stop the worker between JobPost commit and classification, restart, then replay the pending work. Repeat while re-evaluating leads.

- **DB:** add a durable classification outbox or pending-work record in the same transaction as the JobPost write. Key work by tenant, job and taxonomy version; retain attempts and terminal failure. A reconciliation query finds stale pending jobs and missing assignments.
- **Backend:** consume pending work with bounded concurrency, retries/backoff and idempotent assignment writes. Reprocess and ordinary ingest share the same classification contract. A failed job must not block the rest of the batch.
- **Frontend:** expose pending, retrying and failed counts with a retry/reprocess action; keep Radar data-health explicit while work remains.
- **Unit tests:** state transitions, retry limit, duplicate delivery, version change and tenant isolation.
- **Integration tests:** process restart, duplicate delivery and partial batch failure against real DB; assert no lost jobs, no duplicate primary assignments and successful recovery through reconciliation.
- **Exit:** replay produces the same assignments as one uninterrupted run; all accepted jobs are accounted for as classified, fallback or failed after recovery.

## Phase 3 — Rebuild correct, stable snapshots

**Demonstration:** classify two jobs in a burst, change one assignment, then inspect Radar metrics and a previously recorded decision before and after rebuilding.

- **DB:** persist immutable snapshot revisions (or an equivalent decision-bound immutable payload) so a same-day rebuild cannot mutate metrics referenced by an earlier decision. Store the taxonomy version and source-job/evidence lineage for each revision.
- **Backend:** coalesce rebuild requests per tenant; fix the running-rebuild/timer race so pending changes always cause a subsequent rebuild. Recalculate demand 7d/30d, proposals, fixed-budget median, verified clients, profile eligibility, AI leverage, profile fit, opportunity, confidence and evidence from current assignments and source data. Trend uses retained historical revisions; operator decisions remain immutable.
- **Frontend:** show the active revision and its freshness; inspection links metrics to contributing jobs, while historical decisions show the revision on which they were made.
- **Unit tests:** rebuild state machine including an enqueue during an active rebuild, coalescing, stale completion, metric formulas and observed-versus-unknown inputs.
- **Integration tests:** real DB verifies two rapid classifications produce a final snapshot including both, replay makes no duplicate revision, tenant A never changes tenant B, and a decision's stored metrics/evidence remain unchanged after a later rebuild.
- **Exit:** snapshot aggregates match independent SQL/fixture expectations; every successful classification is reflected in a later revision; historical decisions retain their original evidence.

## Phase 4 — Prove progressive delivery end to end

**Demonstration:** run a controlled 15–25 job batch with Radar open. Jobs appear progressively; classification completes; SSE triggers table refresh; a reload returns identical final numbers. Induce one classification and one rebuild failure.

- **DB:** provide a read-only reconciliation report: accepted jobs, pending/failed assignments, current snapshot revision and count of classified jobs represented in it. Persist event/revision IDs needed to recover after an SSE disconnect.
- **Backend:** emit revision-aware SSE only after snapshot commit; reconnect/replay or refetch from the current revision. Define `READY` from completed classification and a current valid snapshot, not solely from scrape completion. Instrument ingest-to-classification, classification-to-snapshot and snapshot-to-visible latencies.
- **Frontend:** refresh once per newer revision, ignore duplicate/out-of-order SSE, recover by refetch after reconnect and display pending/failed/stale states without showing false `READY`.
- **Unit tests:** SSE event ordering, duplicate revision suppression, reconnect/refetch, READY-state rules and failure indication.
- **Integration tests:** API + DB + SSE + browser test for progressive updates, reconnect, tenant isolation and failure/retry; compare UI totals with the reconciliation report and direct fixture expectations.
- **Exit:** record a baseline for p50/p95 end-to-end latency and batch completion time, then agree numeric performance gates from that baseline. Require zero unexplained accepted jobs, zero cross-tenant leakage and exact final UI/API/DB agreement for the fixture before piloting live data.

## Review gates

For each phase, attach the fixture, test results, DB query/output and a short screen recording or screenshots showing the demonstration. Run the unit suite on every change and the DB integration suite in CI. Use a representative labeled sample to review taxonomy quality by category and fallback rate; investigate disagreements and adjust deterministic rules with a versioned replay. An LLM may propose offline rule candidates for human review, but it must not silently classify live jobs. Measure baseline quality and latency before setting targets; do not invent thresholds from a small fixture.
