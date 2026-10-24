# Market Radar taxonomy and async updates — handoff

## Current status: COMPLETADO Y DESPLEGADO A MAIN

Todas las fases (1, 2, 3 y 4) junto con la verificación visual E2E han sido implementadas, probadas con tests unitarios y de integración en PostgreSQL, auditadas por el Consejo de Calidad de la AI Factory y desplegadas a `main` (`origin/main`).

## Resumen de Fases Completadas

### Phase 1 — Auditable Classification (Completado)
- `JobPost` registra estados `PENDING`, `CLASSIFIED`, `FALLBACK`, o `FAILED`, incluyendo versión de clasificador, versión de taxonomía, razón de fallback, errores y tiempos.
- `JobCategoryAssignment` almacena `taxonomyVersion`.
- Fallback seguro con reporte explícito en caso de no clasificación.
- Pruebas verdes: `market-taxonomy-classifier.service.spec.ts` (4/4 tests).

### Phase 2 — Durable Classification Outbox (Completado)
- `taxonomy_classification_work` provee una cola respaldada por DB creada transaccionalmente con el ingest del empleo.
- Leases, tokens de propietario, compare-and-set para completado/fallo, reintentos y recuperación en reinicio.
- Aislamiento multi-inquilino estricto.
- Pruebas verdes: `taxonomy-classification-work.local.spec.ts` (3/3 tests en Postgres 5438).

### Phase 3 — Immutable Snapshot Revisions (Completado)
- Fix de condición de carrera en `market-radar-rebuild-queue.service.ts`: si se solicita un rebuild durante una ejecución en progreso, se re-agenda automáticamente un rebuild posterior.
- Fix de `previousRevision` nulo en `MarketSnapshotService` (fallback numérico en 0).
- Filtro estricto `isCurrent: true` en `market-radar-operations.service.ts` y `scraping.controller.ts`.
- Pruebas verdes: `market-radar-rebuild-queue.service.spec.ts` (1/1 test) y `market-snapshot.local.spec.ts` (1/1 test en Postgres 5438).

### Phase 4 — Revision-Aware SSE & Reactive UI (Completado)
- Emisión de `radarRevision` a través del stream SSE de scraping (`scraping-progress.service.ts` y `market-radar-rebuild-queue.service.ts`).
- Estado `READY` condicionado a que no existan trabajos de clasificación pendientes (`pendingClassificationJobs === 0`).
- Frontend Angular con señal `currentRadarRevision`, badge visual de revisión activa e indicadores de salud (`market-radar.component.html`/`.ts`).
- Pruebas verdes: `market-radar-operations.service.spec.ts` (4/4 tests) y `ng build` 100% limpio.

### E2E Flow Discovery & Storyboard (Completado)
- Motor determinista `scripts/factory/flow.mjs` (`npm run factory flow`).
- Valida el flujo en vivo en `http://localhost:7001`:
  1. Captura del Baseline en Radar de Mercado (41 empleos).
  2. Clic en "Buscar Más Proyectos" con activación reactiva de botón y banner SSE en vuelo.
  3. Ejecución del ciclo completo y actualización reactiva de la interfaz.

---

## Commits Desplegados en `origin/main`

1. `2751ae7` — `feat(factory): add AI software factory CLI, zero-downtime migrations skill, and telemetry`
2. `6d0d45a` — `feat(scraping): auditable taxonomy classification and durable outbox queue (phases 1-2)`
3. `ce9ad2d` — `feat(radar): immutable snapshot revisions, isCurrent filter, and queue race fix (phase 3)`
4. `91a229c` — `feat(radar): progressive SSE revisions, strict READY condition, and UI indicators (phase 4)`
5. `840c913` — `feat(factory): integrate deterministic E2E flow discovery runner for Market Radar ingestion`
6. `1159cdc` — `chore(factory): update validation scorecard and telemetry metrics`
