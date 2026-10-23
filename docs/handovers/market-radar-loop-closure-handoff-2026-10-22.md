# Cerrar el loop de valor del Radar de mercado

El Radar de mercado está verificado técnicamente en local: persiste snapshots, expone tendencias y evidencia, comunica la salud de los datos y su E2E local pasó. El trabajo pendiente es demostrar que sus recomendaciones mejoran decisiones comerciales en lugar de sólo mostrar datos de mercado.

## Outcome and definition of done

The loop is closed when a team member can trace a Radar recommendation through the action taken and its commercial result, then compare Radar-led work with a defined baseline.

The work is done only when all of the following are true:

- A chosen or dismissed Radar category records its snapshot, profile, evidence jobs, decision, and rationale.
- A decision can be linked to downstream proposal and commercial outcomes.
- The UI explains why a category is recommended and what to do next.
- A time-boxed pilot compares Radar-led work against a pre-defined baseline.
- The pilot has a documented outcome: retain, adjust, or retire the recommendation rules.

## Guardrails

- Work only in `proposal-autopilot` until the local pilot contract is accepted.
- Do not deploy to EasyPanel or schedule Apify as part of this change.
- Do not delete existing local profiles or scraped jobs without a separate explicit request.
- `positioning.md` remains the canonical AI-Native UX positioning source.
- A `READY` Radar state is required before a human uses a recommendation in the pilot. `PARTIAL`, `STALE`, and `NO_SNAPSHOTS` are information, not a green light.

## Quick path

1. Define a decision/outcome record that preserves the Radar context at the time of the decision.
2. Add an explicit action from each category and evidence drill-down.
3. Explain recommendation drivers, confidence, and invalid-data states in the UI.
4. Run a local end-to-end verification of the full decision-to-outcome lineage.
5. Agree a production pilot baseline and success threshold before any deployment.
6. Run the pilot, compare results, and decide whether the Radar rules need adjustment.

## Delivery sequence

### P0 — Freeze the pilot contract

**Goal:** Establish how value will be measured before collecting outcomes.

Record the following in the pilot brief:

| Decision | Required choice |
|---|---|
| Comparison | Historical baseline, concurrent control group, or both |
| Pilot duration | At least two complete weekly decision cycles |
| Primary success metric | Qualified reply rate, interview rate, contract rate, or revenue per connect |
| Secondary metrics | High-fit share, proposal volume, time-to-shortlist, and connects spent |
| Inclusion rule | Which proposals count as Radar-led |
| Owner | Person responsible for weekly review and the final keep/adjust/retire decision |

Do not define success after seeing the pilot outcome. That turns measurement into storytelling.

### P1 — Persist the decision-to-outcome lineage

**Goal:** Make every recommendation auditable after the fact.

Introduce a durable decision record. Its minimum fields should preserve:

| Field | Why it is needed |
|---|---|
| `marketCategorySnapshotId` | Reconstructs the market evidence visible at decision time |
| `positioningProfileId` | Prevents comparing decisions made for different offers |
| `categoryId` and evidence job IDs | Identifies the signal and its supporting jobs |
| Decision | `PRIORITIZED`, `WATCHED`, or `DISMISSED` |
| Reason and operator | Captures human judgment rather than hiding it |
| Created time | Supports time-bound comparison |
| Related job/proposal IDs | Connects the decision to execution |
| Outcome milestones | Submitted, replied, interviewed, won, and realized value |

Keep the snapshot immutable. Later recalculation must not rewrite the evidence that justified an earlier decision.

**Acceptance checks**

- [ ] A decision cannot be stored without snapshot, active profile, and category context.
- [ ] A later proposal or job-status change can be attached to the decision.
- [ ] Changing the active profile does not change historical decision context.

### P2 — Turn the report into an action surface

**Goal:** Let an operator act from evidence instead of copying data into another workflow.

For each eligible category, show one of these recommendations:

- **Prioritize:** sufficient confidence, useful profile fit, and a favorable demand/competition signal.
- **Watch:** useful signal but insufficient confidence, history, or evidence.
- **Deprioritize:** poor fit, deteriorating opportunity, or explicitly excluded lane.

The category panel should provide:

1. A short "why now" explanation using demand change, proposal change, fit, confidence, and data date.
2. The evidence jobs already available through `Inspect`.
3. A `Prioritize`, `Watch`, or `Dismiss` action that creates the decision record.
4. A path to the relevant jobs or proposal workflow, carrying the category context forward.

The recommendation must not appear when Radar health is not `READY`.

### P3 — Make the score intelligible

**Goal:** Ensure `Opportunity` is trusted because it is inspectable, not because it is a badge.

Add a compact methodology panel beside the opportunity score that states:

- current calculation version;
- contributing inputs: demand, observed competition, profile fit, and lane eligibility;
- whether each input is observed or unavailable;
- confidence and sample coverage;
- the compared snapshot date for a trend.

Use plain language. `Not observed` must continue to mean insufficient source evidence, never zero.

### P4 — Add operational focus controls

**Goal:** Surface decisions worth reviewing without turning the Radar into alert noise.

Add only after P1–P3 are verified:

- saved filters for lane, confidence, budget, verified-client coverage, geography, and time period;
- a "newly prioritized" view based on a configurable threshold;
- an alert only when a `READY` category crosses that threshold;
- a weekly review summary that lists decisions needing an outcome update.

Notifications must link to a category and its evidence, never to an unexplained aggregate score.

## Pilot measurement

### Baseline

Before the pilot begins, record the same period from the existing process:

- eligible jobs reviewed;
- High Fit share;
- proposals sent;
- replies and interviews;
- contracts and realized value;
- connects spent;
- time from discovery to proposal.

### Radar-led cohort

A proposal is Radar-led only when it has a persisted `PRIORITIZED` decision made from a `READY` snapshot before the proposal is sent. Everything else remains in the baseline/control cohort.

### Weekly review

For each cohort, calculate:

| Metric | Interpretation |
|---|---|
| Qualified reply rate | Are selected opportunities producing real client engagement? |
| Interview rate | Is the signal identifying commercially credible work? |
| Contract rate / realized value | Is the Radar improving the outcome that matters? |
| Value per connect | Is it improving capital efficiency? |
| Time-to-shortlist | Is it reducing research work? |

Report sample sizes with every rate. Do not claim an uplift from a handful of proposals.

## Verification plan

### Automated local checks

- Unit tests for decision eligibility, immutable snapshot linkage, and outcome aggregation.
- API tests for creating, reading, and updating decision/outcome records.
- A Sandbox QA visual plan that proves: `READY` category → inspect evidence → prioritize → related job/proposal → outcome update → cohort metric visible.
- A negative test proving `PARTIAL`, `STALE`, and `NO_SNAPSHOTS` cannot create a `PRIORITIZED` decision.

### Human review

Before a pilot run, confirm that a reviewer can answer these questions from the UI alone:

1. Why was this category recommended today?
2. Which observed jobs support the recommendation?
3. Which active profile and snapshot produced it?
4. What action was taken, by whom, and what happened afterwards?

## Risks and responses

| Risk | Response |
|---|---|
| Thin or stale sample | Block priority actions unless Radar health is `READY`; retain confidence and coverage beside each recommendation. |
| Self-confirming selection bias | Keep a baseline/control cohort and predefine inclusion rules. |
| Profile changes distort comparisons | Store `positioningProfileId` with every decision. |
| Outcome arrives weeks later | Maintain pending milestones and review them weekly rather than treating missing outcomes as failures. |
| Alert fatigue | Require a threshold crossing and evidence-backed category link. |

## Explicitly out of scope

- EasyPanel deployment, production database changes, and the 7:00 AM Apify schedule.
- Automatic bid submission or autonomous commercial decisions.
- Claiming commercial uplift before the pilot reaches its agreed duration and sample size.

## Existing evidence and references

- [Current Radar and profile handoff](market-radar-profile-e2e-handoff-2026-10-22.md)
- [Local Radar requirement](../../.sandbox/requirements/market-radar-trends-local.md)
- [Local Radar visual plan](../../.sandbox/visual-plans/market-radar-trends-local.json)
- [Passing local Radar evidence](../../.sandbox/runs/market-radar-trends-local-fixed/summary.json)

## Next handoff action

Start with P0: the owner must choose the comparison method, primary business metric, pilot duration, and success threshold. Once those choices are recorded, implement P1 before adding alerts, filters, or new visual polish.
