# Requirement: Live Market Radar E2E

## Scope

Verify the completed live Upwork ingestion against the local Docker stack using the persisted batch created by the pilot input. This run is read-only at the UI layer: it must not apply fixtures, create decisions, or modify the live snapshot.

## Pilot input

- Keywords: UX research, design system, Figma design system, AI product design, usability testing, AI prototyping, vibe coding, agentic workflow design, N8N automation design, GenAI UX
- Posted within: 3 days
- Minimum budget: $1,000 fixed or $40/hour
- Experience: Intermediate or Expert
- Verified payment method: required
- Target: 15–25 fresh jobs

## Acceptance criteria

1. The local app loads the persisted Market Radar snapshot created by the live batch.
2. The Radar reports a healthy snapshot and renders the category opportunity table.
3. The table exposes category, profile eligibility, AI leverage, demand, proposals, budget, verified clients, profile fit, opportunity, confidence, trend, decision, and evidence columns.
4. Categories observed in the live batch include Design systems, Product UX, and UX research.
5. The evidence drill-down exposes real structured fields such as title, posted date, proposal count, fixed budget, payment verification, and source URL.
6. Screenshots are captured for the loaded table and evidence drill-down.
7. No fixture data is applied or cleaned during this run.
