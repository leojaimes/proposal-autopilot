# Market Radar P2 — handoff para 2026-10-23

P2 está implementado, validado en Docker local y listo para revisión. No hubo despliegue ni cambios en producción.

## Resultado actual

| Área | Estado |
| --- | --- |
| Elegibilidad por perfil | Persistida y expuesta como `ELIGIBLE`, `EXCLUDED` o `PENDING`. `ELIGIBLE` exige fit observado y lane `CORE`/`ADJACENT`; el fallback sintético no habilita elegibilidad. |
| AI leverage | `APPLICABLE` sólo con `ProfileCategoryPolicy.aiLeverageEnabled` y metadata taxonómica explícita `metadata.aiLeverage`. Sin metadata, aunque la política esté habilitada, queda `NOT_APPLICABLE`. |
| Tabla Radar | Muestra badges/labels de elegibilidad y AI leverage. `PENDING` se presenta como `Pending — not observed`; `NOT_APPLICABLE` como `Not applicable`; no se usa `0` como sustituto. |
| Integración de perfiles | El sincronizador de tenants persiste `aiLeverageEnabled` en la política del perfil. |
| P1 | Continúa cubierto: decisiones, trazabilidad y resultados pasan las pruebas y el Sandbox aprobado de P1 sigue siendo la referencia. |

## Corrida live del piloto

- Batch Apify completado: `c9fa61e5-fddb-4cea-8339-7a0ad10555b8` (`COMPLETED`, 20 jobs, 1 Medium Fit).
- Plan Playwright reproducible: `.sandbox/requirements/market-radar-live-e2e.md` + `.sandbox/visual-plans/market-radar-live-e2e.json`.
- Sandbox aprobado: `2026-10-23T18-45-24-782Z-573735ee` (`HTTP 200` + Playwright `2/2`).
- Capturas: `.sandbox/runs/2026-10-23T18-45-24-782Z-573735ee/visual/checkpoints/market-radar-live-table.png` y `market-radar-live-evidence.png`.
- El plan live es de lectura: no aplica fixtures ni crea decisiones. El intento de fixture se rechazó porque ya existían 9 snapshots live y se preservaron intactos.

## Archivos P2 principales

- `backend/prisma/migrations/20261023170000_market_radar_profile_eligibility_ai_leverage/` — migración P2.
- `backend/prisma/schema.prisma` — enums, campos persistidos y `aiLeverageEnabled`.
- `backend/src/modules/scraping/services/market-snapshot.service.ts` — cálculo de elegibilidad/leverage; conserva metadata de categoría y no usa `aiFeasibilityScore`.
- `backend/src/modules/scraping/scraping.controller.ts` — expone `profileEligibility` y `aiLeverage` en el GET de Radar.
- `backend/src/modules/tenants/tenants.service.ts` — persiste la política explícita.
- `frontend/src/app/features/radar/market-radar.component.{ts,html}` — tipos, helpers y columnas de tabla.
- `backend/src/modules/scraping/services/market-snapshot.local.spec.ts` — cubre `ELIGIBLE` + `APPLICABLE`, `ELIGIBLE` + `NOT_APPLICABLE`, `EXCLUDED` y `PENDING`.
- `backend/src/modules/scraping/services/market-radar-decision.service.spec.ts` — además verifica que `PENDING`/`EXCLUDED` no puedan priorizarse.

## Validación realizada

- `npx prisma validate --schema prisma/schema.prisma` — aprobado.
- `npm run prisma:generate` — aprobado.
- `npx ts-node --transpile-only src/modules/scraping/services/market-snapshot-calculator.service.spec.ts` — 2/2 aprobado.
- `npx ts-node --transpile-only src/modules/scraping/services/market-radar-decision.service.spec.ts` — 4/4 aprobado.
- `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public npx ts-node --transpile-only src/modules/scraping/services/market-snapshot.local.spec.ts` — 1/1 aprobado después de aplicar la migración local.
- `npm run build` desde `frontend/` — aprobado; sólo warnings preexistentes de imports opcionales/CommonJS.

La migración se aplicó únicamente a la base Docker local. No hubo despliegue ni cambios en producción.

## Pendiente inmediato

- [x] Hacer que `backend/scripts/market-radar-local-fixture.ts` configure de forma determinista una fila `ELIGIBLE` + `APPLICABLE` y otra `NOT_APPLICABLE`/`PENDING` para el perfil activo.
- [x] Extender `.sandbox/requirements/market-radar-trends-local.md` y `.sandbox/visual-plans/market-radar-trends-local.json` con assertions no ambiguas para las dos columnas P2.
- [x] Reconstruir `backend`/`frontend` Docker con la migración aplicada.
- [x] Ejecutar Sandbox remoto contra `http://127.0.0.1:7001` con fixture apply y cleanup garantizado.
- [x] Ejecutar E2E live de lectura contra el batch Apify completado y capturar tabla + evidencia.
- [ ] Revisar el diff completo antes de commit; conservar los archivos ajenos no relacionados (`.agents/skills/backlog/`, `.agents/skills/pair/`, `.agents/skills/story/`, `AGENTS.md`, `CLAUDE.md`) sin modificarlos ni eliminarlos.

## Reanudación rápida

Desde `backend/`:

```powershell
$env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public'
npx prisma migrate deploy
npx ts-node --transpile-only src/modules/scraping/services/market-snapshot.local.spec.ts
```

La última corrida Sandbox aprobada fue `2026-10-23T18-32-25-371Z-d8e8c8cc` (HTTP y Playwright aprobados). El fixture se limpió con `MARKET_RADAR_FIXTURE_MODE=cleanup`.

## Fuera de alcance

- No ajustar pesos/taxonomía por intuición: sólo usar metadata explícita versionada.
- No reciclar `aiFeasibilityScore` como AI leverage; representa competencia/propuestas.
- No inferir resultados P2 desde filas de ejemplo ni desde el fallback `ADJACENT`.
