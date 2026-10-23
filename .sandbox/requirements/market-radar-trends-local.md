# Requirement: Local Market Radar Trends

## Scope

Verify the Proposal Autopilot Market Radar against the local Docker stack only. The run uses deterministic, temporary local fixtures and must not call EasyPanel or production.

## Acceptance criteria

1. The Radar renders category metrics from persisted local snapshots.
2. A category with two daily snapshots displays observed deltas and its comparison date.
3. The movements section lists only categories whose observed values changed.
4. An evidence drill-down lists the source jobs and preserves unknown fields as unavailable.
5. The API response includes a non-empty category collection with a persisted trend and evidence records.
6. Cleanup removes only the fixture jobs and snapshots after the run.
7. A `READY` category records a human `PRIORITIZED` decision with the operator and rationale provided by the test environment.
8. The recorded decision remains visible beside its category after the Radar refreshes.
9. An evidence job and its deterministic proposal can be linked to the decision.
10. The complete outcome chain records submitted, qualified response, interview, contract, and realized value for that association.
11. The table labels an observed profile category as Eligible and shows its declared AI leverage capability.
12. A category without declared taxonomy AI leverage is shown as Not applicable, never as a numeric zero.
