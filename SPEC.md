# SPEC: Profile screen, avatar menu, i18n and e2e journeys
<!-- BRAIN HYDRATION CONTEXT (Extracted from 02-DOCS) -->
### Ref: docs\architecture\UI_NAVIGATION_MAP.md
```markdown
## 📊 Matriz de Cobertura E2E Descubierta

| Identificador | Tipo | Elemento | Recorrido Declarativo Asociado | Cobertura |
```
```markdown
| :--- | :---: | :--- | :--- | :---: |
| `TERMINAL` | Vista | Cabina de Despacho | `tests/journeys/journey-dispatch-terminal.json` | 🟢 100% |
| `EXPLORER` | Vista | Motor de Búsqueda | `tests/journeys/journey-job-explorer.json` | 🟢 100% |
| `RADAR` | Vista | Radar de Mercado | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
```
```markdown
| `RADAR` | Vista | Radar de Mercado | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
| `DRAWER_CALIBRATION` | Cajón | Ajustes de Motor | `tests/journeys/journey-calibration-drawer.json` | 🟢 100% |
| `ACTION_SCRAPING` | Pipeline | Búsqueda en Upwork (SSE) | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
| `ACTION_REPROCESS` | Pipeline | Re-evaluación ($0) | *(Listo para ampliación)* | 🟡 Parcial |
```
### Ref: docs\handovers\market-radar-functional-requirement-2026-10-22.md
```markdown
Una categoría sólo puede ser `PRIORITIZED` cuando se cumplen todas estas condiciones:

- Existe un perfil activo con profesión, habilidades y oferta definidos.
```
```markdown
| Overall opportunity | Orden relativo para ese perfil y snapshot | Componentes de mercado + ajuste personal observados |
| Market score | Desglose visible de demanda, competencia y pago | No se muestra como caja negra; cada componente declara cobertura |
| Personal fit / Skill affinity | Compatibilidad con profesión, roles y habilidades | Evaluaciones de ajuste asociadas al perfil activo |
| AI leverage | Capacidad de usar IA para código o automatización en esa categoría | Perfil + explicación de tarea; `Not applicable` si no corresponde |
```
```markdown
| AI leverage | Capacidad de usar IA para código o automatización en esa categoría | Perfil + explicación de tarea; `Not applicable` si no corresponde |
| New jobs per hour | Ritmo de aparición dentro de una ventana observada | Demanda observada / duración de la ventana |
| Median proposals / % under 10 | Competencia observada | Sólo trabajos con conteo de propuestas conocido |
| Median hourly / Median fixed | Compensación observada | Unidades separadas; no se mezclan ni se imputan |
```
### Ref: docs\handovers\market-radar-loop-closure-handoff-2026-10-22.md
```markdown
El Radar de mercado está verificado técnicamente en local: persiste snapshots, expone tendencias y evidencia, comunica la salud de los datos y su E2E local pasó. El trabajo pendiente es demostrar que sus recomendaciones mejoran decisiones comerciales en lugar de sólo mostrar datos de mercado.

## Outcome and definition of done
```
```markdown
The loop is closed when a team member can trace a Radar recommendation through the action taken and its commercial result, then compare Radar-led work with a defined baseline.

The work is done only when all of the following are true:
```
```markdown
- A chosen or dismissed Radar category records its snapshot, profile, evidence jobs, decision, and rationale.
- A decision can be linked to downstream proposal and commercial outcomes.
- The UI explains why a category is recommended and what to do next.
```
### Ref: docs\handovers\market-radar-p1-pilot-handoff-2026-10-23.md
```markdown
# Market Radar P1 — handoff para 2026-10-23

P1 está implementado y validado en el stack Docker local. El Radar ya registra una decisión trazable por oportunidad, conserva el contexto que la justificó y permite registrar resultados. El siguiente trabajo no es inventar mejores puntajes: es operar y medir el piloto con propuestas reales.
```
```markdown
| --- | --- |
| Perfil aplicable | El Radar resuelve únicamente un `PositioningProfile` activo. Un nombre cacheado de un perfil inactivo ya no puede decidir el resultado. |
| Decisión | Se pueden registrar `PRIORITIZED`, `WATCHED` o `DISMISSED` con responsable y razón obligatorios. |
| Guardas | `PRIORITIZED` exige Radar `READY`, afinidad observada al perfil y una lane permitida; no se habilita por valores de ejemplo. |
```
```markdown
- `frontend/src/app/features/radar/market-radar.component.{ts,html}` — captura de decisiones y resultados desde la interfaz.
- `docs/handovers/market-radar-functional-requirement-2026-10-22.md` — contrato funcional y criterio de valor.

## Validación ya realizada
```

## Story
As an agency developer / freelancer, I want a dedicated positioning profile view with live i18n language switching, an avatar dropdown header menu that closes on click-outside, and automated E2E journey coverage, so that my proposal targeting matches my exact profile identity and preferences.

## Acceptance criteria
- [x] Given an active positioning profile, when the user navigates to the Profile view or toggles language between ES and EN, then the UI updates reactively using Angular Signals without reloading the page.
- [x] Given the header navigation, when the user opens the avatar dropdown menu and clicks outside or presses Escape, then the dropdown menu closes immediately.
- [x] [Visual Verification] Given the browser at http://localhost:7001, when running `journey-user-profile` and `journey-reprocess-leads`, then all steps pass and visual storyboard screenshots are saved.

## Allowed Files Whitelist (Max 3 files)
- frontend/src/app/
- docs/architecture/UI_NAVIGATION_MAP.md
- tests/journeys/
- scripts/factory/
- SCORECARD.md

## Test Plan (TDD)
- test: tests/journeys/journey-user-profile.json
- test: tests/journeys/journey-reprocess-leads.json
- test: frontend/src/app/core/services/i18n.service.spec.ts

## Out of scope
- Third-party translation cloud APIs (pure zero-dependency Angular Signals dictionary).
- Modifying backend PostgreSQL schema.

