# SPEC: Complete profile English i18n & GHCR deployment verification
<!-- BRAIN HYDRATION CONTEXT (Extracted from 02-DOCS) -->
### Ref: docs\architecture\UI_NAVIGATION_MAP.md
```markdown
HEADER -->|"Tab 'Radar de Mercado'"| RADAR["Radar de Mercado (MarketRadar)"]:::primary
    HEADER -->|"Tab 'Perfil & Ajustes'"| PROFILE["Perfil Profesional & Preferencias i18n (UserProfile)"]:::primary

    HEADER -->|"Botón 'Calibrar'"| DRAWER["Cajón de Calibración (EngineSettingsDrawer)"]:::drawer
```
```markdown
TERMINAL -->|"Atajo J/K / D"| LEAD_DISPATCH["Despacho / Descarte de Lead"]:::action
    PROFILE -->|"Conmutar Idioma"| I18N_SWITCH["Actualización Reactiva de Idioma"]:::action

```
```
```markdown
| `RADAR` | Vista | Radar de Mercado | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
| `PROFILE` | Vista | Perfil & Preferencias i18n | `tests/journeys/journey-user-profile.json` | 🟢 100% |
| `DRAWER_CALIBRATION` | Cajón | Ajustes de Motor | `tests/journeys/journey-calibration-drawer.json` | 🟢 100% |
| `ACTION_SCRAPING` | Pipeline | Búsqueda en Upwork (SSE) | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
```
### Ref: docs\handovers\market-radar-loop-closure-handoff-2026-10-22.md
```markdown
- A chosen or dismissed Radar category records its snapshot, profile, evidence jobs, decision, and rationale.
- A decision can be linked to downstream proposal and commercial outcomes.
- The UI explains why a category is recommended and what to do next.
```
```markdown
- Do not deploy to EasyPanel or schedule Apify as part of this change.
- Do not delete existing local profiles or scraped jobs without a separate explicit request.
- `positioning.md` remains the canonical AI-Native UX positioning source.
- A `READY` Radar state is required before a human uses a recommendation in the pilot. `PARTIAL`, `STALE`, and `NO_SNAPSHOTS` are information, not a green light.
```
```markdown
3. Explain recommendation drivers, confidence, and invalid-data states in the UI.
4. Run a local end-to-end verification of the full decision-to-outcome lineage.
5. Agree a production pilot baseline and success threshold before any deployment.
6. Run the pilot, compare results, and decide whether the Radar rules need adjustment.
```
### Ref: docs\handovers\market-radar-p1-pilot-handoff-2026-10-23.md
```markdown
| --- | --- |
| Perfil aplicable | El Radar resuelve únicamente un `PositioningProfile` activo. Un nombre cacheado de un perfil inactivo ya no puede decidir el resultado. |
| Decisión | Se pueden registrar `PRIORITIZED`, `WATCHED` o `DISMISSED` con responsable y razón obligatorios. |
| Guardas | `PRIORITIZED` exige Radar `READY`, afinidad observada al perfil y una lane permitida; no se habilita por valores de ejemplo. |
```
```markdown
$env:MARKET_RADAR_FIXTURE_MODE = 'apply'
$env:MARKET_RADAR_FIXTURE_PROFILE_NAME = 'AI-Native UX Architect'
npx ts-node --transpile-only scripts/market-radar-local-fixture.ts
```
```markdown
$env:MARKET_RADAR_DECISION_OPERATOR = 'Local QA'
$env:MARKET_RADAR_DECISION_RATIONALE = 'Observed profile fit and available evidence'
npm run sandbox:run -- --requirement .sandbox/requirements/market-radar-trends-local.md --visual-plan .sandbox/visual-plans/market-radar-trends-local.json --remote --target nielsen --url http://127.0.0.1:7001
```
### Ref: docs\handovers\market-radar-p2-handoff-2026-10-23.md
```markdown
| Elegibilidad por perfil | Persistida y expuesta como `ELIGIBLE`, `EXCLUDED` o `PENDING`. `ELIGIBLE` exige fit observado y lane `CORE`/`ADJACENT`; el fallback sintético no habilita elegibilidad. |
| AI leverage | `APPLICABLE` sólo con `ProfileCategoryPolicy.aiLeverageEnabled` y metadata taxonómica explícita `metadata.aiLeverage`. Sin metadata, aunque la política esté habilitada, queda `NOT_APPLICABLE`. |
| Tabla Radar | Muestra badges/labels de elegibilidad y AI leverage. `PENDING` se presenta como `Pending — not observed`; `NOT_APPLICABLE` como `Not applicable`; no se usa `0` como sustituto. |
| Integración de perfiles | El sincronizador de tenants persiste `aiLeverageEnabled` en la política del perfil. |
```
```markdown
- Batch Apify completado: `c9fa61e5-fddb-4cea-8339-7a0ad10555b8` (`COMPLETED`, 20 jobs, 1 Medium Fit).
- Plan Playwright reproducible: `.sandbox/requirements/market-radar-live-e2e.md` + `.sandbox/visual-plans/market-radar-live-e2e.json`.
- Sandbox aprobado: `2026-10-23T18-45-24-782Z-573735ee` (`HTTP 200` + Playwright `2/2`).
```
```markdown
- `backend/prisma/migrations/20261023170000_market_radar_profile_eligibility_ai_leverage/` — migración P2.
- `backend/prisma/schema.prisma` — enums, campos persistidos y `aiLeverageEnabled`.
- `backend/src/modules/scraping/services/market-snapshot.service.ts` — cálculo de elegibilidad/leverage; conserva metadata de categoría y no usa `aiFeasibilityScore`.
```

## Story
As an operator, I want all profile subheadings, explanations, and metrics in UserProfileComponent to translate dynamically into English when English is selected, and have the AI Factory pipeline actively verify Docker compilation and deployment to GHCR, so that international users experience zero English/Spanish language mismatch and deployments are guaranteed in GHCR.

## Acceptance criteria
- [x] Given UserProfileComponent, when the user switches language to English, then all cards, labels, and explanations display in English without remaining hardcoded Spanish.
- [x] Given `finishTask` in `scripts/factory/finish.mjs`, when executed, then it actively polls and watches the GitHub Actions workflow run until Docker images are published to GHCR.
- [x] [Visual Verification] Given the browser at http://localhost:7001, when running `journey-user-profile`, then all steps pass and evidence screenshot `04-04-switch-to-english.png` shows 100% English text.

## Allowed Files Whitelist (Max 3 files)
- frontend/src/app/core/services/i18n.service.ts
- frontend/src/app/features/profile/user-profile.component.html
- scripts/factory/finish.mjs
- scripts/factory/
- SCORECARD.md

## Test Plan (TDD)
- test: tests/journeys/journey-user-profile.json
- test: frontend/src/app/core/services/i18n.service.spec.ts

## Out of scope
- Database schema changes.

