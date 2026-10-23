# Market Radar P1 — handoff para 2026-10-23

P1 está implementado y validado en el stack Docker local. El Radar ya registra una decisión trazable por oportunidad, conserva el contexto que la justificó y permite registrar resultados. El siguiente trabajo no es inventar mejores puntajes: es operar y medir el piloto con propuestas reales.

## Arranque rápido

1. Preservar cambios ajenos: revisar `rtk git status --short` antes de editar o reconstruir contenedores.
2. Levantar el stack local si hace falta: `rtk docker compose up -d --build backend frontend`.
3. Confirmar la migración desde el contenedor: `rtk docker exec proposal_autopilot_backend sh -lc "npx prisma migrate status"`.
4. Antes de atribuir valor al Radar, iniciar la cohorte piloto y registrar los resultados reales de cada propuesta.

## Qué quedó entregado

| Área | Resultado |
| --- | --- |
| Perfil aplicable | El Radar resuelve únicamente un `PositioningProfile` activo. Un nombre cacheado de un perfil inactivo ya no puede decidir el resultado. |
| Decisión | Se pueden registrar `PRIORITIZED`, `WATCHED` o `DISMISSED` con responsable y razón obligatorios. |
| Guardas | `PRIORITIZED` exige Radar `READY`, afinidad observada al perfil y una lane permitida; no se habilita por valores de ejemplo. |
| Trazabilidad | La decisión almacena copias inmutables del snapshot, perfil y empleos-evidencia; el snapshot no se elimina por la retención mientras exista una decisión asociada. |
| Resultado | La UI permite marcar un empleo de evidencia como enviado, con respuesta calificada, entrevista o ganado; también puede asociarse propuesta y valor. |
| Tabla | Las columnas muestran métricas observadas y disponibilidad de datos. Ninguna fila de la tabla de ejemplo fue incorporada como dato operativo. |

## Archivos para revisar primero

- `backend/prisma/migrations/20261022213000_market_radar_decision_lineage/migration.sql` — persistencia de decisiones y resultados.
- `backend/src/modules/scraping/services/market-radar-decision.service.ts` — reglas de creación, contexto inmutable y resultados.
- `backend/src/modules/scraping/scraping.controller.ts` — resolución del perfil activo y endpoints de Radar.
- `frontend/src/app/features/radar/market-radar.component.{ts,html}` — captura de decisiones y resultados desde la interfaz.
- `docs/handovers/market-radar-functional-requirement-2026-10-22.md` — contrato funcional y criterio de valor.

## Validación ya realizada

- Prisma validó el esquema y el contenedor local confirmó la migración aplicada.
- `market-radar-decision.service.spec.ts`: 4/4 pruebas aprobadas.
- Docker recompiló backend y frontend locales correctamente.
- Sandbox QA aprobó el flujo completo: priorizar Design systems, abrir evidencia y marcar un empleo como enviado.
- Evidencia de la ejecución aprobada: `.sandbox/runs/2026-10-23T00-20-25-725Z-bddf4afe`.
- El fixture determinista se eliminó al terminar; la base local no conserva empleos ni snapshots de prueba.

## Cómo repetir la verificación visual local

El fixture sólo opera sobre la base Docker local expuesta en `127.0.0.1:5438`. Se niega a limpiar si encuentra snapshots distintos a los esperados.

```powershell
# Desde backend/
$env:DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public'
$env:MARKET_RADAR_FIXTURE_MODE = 'apply'
$env:MARKET_RADAR_FIXTURE_PROFILE_NAME = 'AI-Native UX Architect'
npx ts-node --transpile-only scripts/market-radar-local-fixture.ts

# Desde la raíz del repositorio
$env:MARKET_RADAR_DECISION_OPERATOR = 'Local QA'
$env:MARKET_RADAR_DECISION_RATIONALE = 'Observed profile fit and available evidence'
npm run sandbox:run -- --requirement .sandbox/requirements/market-radar-trends-local.md --visual-plan .sandbox/visual-plans/market-radar-trends-local.json --remote --target nielsen --url http://127.0.0.1:7001

# Desde backend/, siempre limpiar al final
$env:MARKET_RADAR_FIXTURE_MODE = 'cleanup'
npx ts-node --transpile-only scripts/market-radar-local-fixture.ts
```

`nielsen` es sólo el identificador heredado del runner Sandbox. El flag `--url http://127.0.0.1:7001` apunta la corrida al frontend local de Proposal Autopilot; no contacta producción. El modo `--remote` evita verificaciones heredadas de puertos y contenedores de otros productos.

## Piloto: el siguiente paso que prueba valor

| Elemento | Contrato de medición |
| --- | --- |
| Duración | 4 semanas. |
| Comparación | Cohorte Radar contra control concurrente o histórico contextualizado. |
| Mínimo | 30 propuestas válidas por cohorte antes de concluir. |
| Métrica principal | Respuesta calificada por propuesta enviada. |
| Umbral inicial | Al menos +10 puntos porcentuales frente al control. |
| Guardas | No sacrificar tasa de entrevista, tasa de contratación o valor promedio contratado. |

Registrar una decisión no demuestra valor por sí mismo. El valor se demuestra cuando la cohorte priorizada obtiene mejores resultados bajo estas mismas condiciones de comparación.

## Pendientes explícitos

- [ ] Definir quién registra cada envío y qué cuenta como “respuesta calificada”.
- [ ] Crear las dos cohortes, mantenerlas comparables y no mezclar resultados de fuera del período.
- [ ] Capturar propuestas, respuestas, entrevistas, contratos y valor contratado en los resultados de la decisión.
- [ ] Construir el resumen semanal de cohorte cuando exista volumen real suficiente; no extrapolar desde el fixture local.
- [ ] Revisar el resultado al final de las cuatro semanas y decidir si se ajustan taxonomy/pesos o se amplía la operación.

## Fuera de alcance y seguridad

- No hubo despliegue ni cambios en producción/EasyPanel.
- No se hardcodearon filas, métricas ni resultados ficticios como fuente de verdad.
- La taxonomía de categorías sigue siendo configuración versionada; la afinidad y los datos de mercado se calculan desde perfil, asignaciones y evidencia observada.
