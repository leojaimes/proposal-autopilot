# Market radar and AI-Native UX profile handoff

## Scope and safety constraints

- Work exclusively in `proposal-autopilot`.
- Do not modify other projects, including pubmaster, nielsen, or clone.
- Production/EasyPanel must remain untouched while local validation is in progress.
- Local Docker is the test environment. The production/staging database is intentionally left blank.
- `positioning.md` is the canonical source for the AI-Native UX profile and future proposal/cover-letter voice.

## Completed

### Market radar

Phases 1 through 5A are implemented locally:

- Replaced legacy hardcoded radar calculations with taxonomy, policy, snapshot, trend, and confidence-based calculations.
- Added market-radar operational safeguards: a snapshot is persisted before a batch completes, snapshot retention is configurable, and the API exposes `READY`, `PARTIAL`, `STALE`, and `NO_SNAPSHOTS` health states.
- Connected health information to the market-radar UI.
- Local sandbox E2E `market-radar-trends-local-fixed` passed 2/2. Its temporary fixture jobs and snapshots were cleaned up afterward.

### AI-Native UX profile flow

- Added local-only sandbox assets:
  - `.sandbox/requirements/ai-native-ux-profile-local-e2e.md`
  - `.sandbox/visual-plans/ai-native-ux-profile-local-e2e.json`
- Fixed the sandbox visual runner so API response capture works when the frontend is on port 7001 and its API is on port 7000. Matching now uses protocol, hostname, path, query, and HTTP method rather than requiring identical ports.
- Initial UI/API E2E `ai-native-ux-profile-local-verified` passed 2/2. Evidence is under `.sandbox/runs/ai-native-ux-profile-local-verified/`.
- A semantic audit found that Markdown `## Voice rules` bullets were being misclassified as proof stories. The profile generator was corrected so:
  - any Markdown heading closes proof-story parsing;
  - structured offer and target sections are read directly from `positioning.md`;
  - the six explicit proof stories remain exact and exclusive;
  - the four voice rules remain exact and exclusive;
  - without an AI provider configured, the structured AI-Native UX positioning uses a deterministic UX-specific fallback rather than a generic consultant profile.

## Verification completed

- `market-radar-operations.service.spec.ts`: 3/3 passed.
- `claude-proposal.service.spec.ts`: 3/3 passed, including the structured `positioning.md` regression case.
- `backend npm run build`: passed after the profile-parser fix.
- Frontend production build passed earlier; pre-existing warning noise remains.

Known unrelated repository issue: global TypeScript no-emit still reports an existing mock assertion error in `backend/src/modules/proposals/claude-proposal.service.spec.ts` around line 55. It is outside this change and must not be silently folded into it.

## Current local state

- The local Docker backend was rebuilt from the latest source and left running, along with the local frontend and database.
- The initial final semantic E2E run (`ai-native-ux-profile-local-final`) did not produce a summary because the runner/Playwright processes became stuck. Those exact local E2E processes were stopped at session close. Docker was not stopped.
- Continuation verification completed successfully with `ai-native-ux-profile-local-semantic-canonical` (2/2 checks passed). The active profile is `AI-Native UX Architect` with the canonical offer and target-client text, exactly six proof stories, exactly four voice rules, and no voice-rule text persisted as a proof story.
- The verification surfaced and fixed a persistence limit: the canonical offer is 259 characters while `offer_headline` was `VARCHAR(255)`. Migration `20261022210000_expand_profile_offer_headline` changes it to `TEXT` without truncating the positioning. Structured AI-Native UX input now also keeps the canonical persona name even when Gemini proposes a subtitle.
- Do not delete local profiles or scraped jobs without a new explicit request. Earlier cleanup only removed temporary radar test fixtures.

## First continuation steps

1. Confirm Docker is healthy (`backend`, `frontend`, and `db`) without changing production/EasyPanel.
2. Re-run the semantic E2E with a fresh run ID:

   ```powershell
   $env:AI_NATIVE_UX_POSITIONING = Get-Content -Raw positioning.md
   npm run sandbox:run -- --requirement .sandbox/requirements/ai-native-ux-profile-local-e2e.md --visual-plan .sandbox/visual-plans/ai-native-ux-profile-local-e2e.json --remote --target nielsen --url http://localhost:7001 --run-id ai-native-ux-profile-local-semantic-final
   ```

   `--remote` only bypasses the runner's fixed local profile port; the target URL is still loopback (`localhost:7001`), not EasyPanel.

3. Query the local workspace/profile API and verify the active generated profile has all of the following:
   - name: `AI-Native UX Architect`;
   - the supplied offer and target client text;
   - exactly six proof stories;
   - exactly four voice rules;
   - no voice-rule text in proof stories.
4. Save the final run evidence and only then decide whether the generated profile should remain active or local test data should be cleaned.

## Deferred work

The user previously approved exploring a 7:00 AM America/Mexico_City EasyPanel schedule to trigger Apify. It is deliberately not configured here: it needs an explicit deployment/workflow decision and must be separated from local profile/radar verification. No EasyPanel service, schedule, or production database was changed in this session.

## Relevant files

- `positioning.md` — canonical positioning input.
- `backend/src/modules/proposals/claude-proposal.service.ts` — structured positioning parsing and profile generation.
- `backend/src/modules/proposals/claude-proposal.service.spec.ts` — regression coverage for proof stories and voice rules.
- `backend/src/modules/scraping/services/market-radar-operations.service.ts` — radar operational lifecycle and health.
- `backend/src/modules/scraping/services/market-radar-operations.service.spec.ts` — operation lifecycle coverage.
- `backend/src/modules/scraping/scraping.controller.ts` — radar health endpoint.
- `frontend/src/app/features/radar/market-radar.component.ts` — radar health presentation.
- `tests/sandbox-visual/visual-plan.spec.mjs` — local frontend/backend API capture correction.
- `.sandbox/requirements/ai-native-ux-profile-local-e2e.md` — local E2E contract.
- `.sandbox/visual-plans/ai-native-ux-profile-local-e2e.json` — local E2E checkpoints.
