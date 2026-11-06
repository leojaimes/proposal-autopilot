# Patrones comprobados y límites

## Comprobado en la implementación local

| Área | Evidencia | Uso seguro |
| --- | --- | --- |
| Ejecución con tope | `ApifyActorRunClient` envía `maxTotalChargeUsd` y exige `SUCCEEDED`. | Limitar cada corrida autorizada y conservar el ID retornado. |
| Resultado y cursor | `ApifyRunOutputReader` acepta el formato raíz y el formato real bajo `metadata`. | Leer `metadata.next_page` y `metadata.has_more_results`; no asumir que los campos están en la raíz. |
| Dataset | `readApifyDatasetPages` recorre offsets hasta una página corta; `findOldestApifyJobPostedAt` ignora fechas inválidas. | Guardar la fecha más antigua válida y el dataset completo. |
| Idempotencia | `PrismaSharedUpworkCatalogRepository.saveLive` usa `skipDuplicates` y crea etiquetas en `shared_upwork_job_segments`. | Reimportar un dataset es seguro para vacantes existentes; informar filas nuevas por separado. |
| Cursor | `PrismaMarketRadarCoverageRepository` exige que el cursor de entrada sea el cursor de salida de la página anterior. | No reconstruir ni editar cursores. |
| Input canónico | La comparación estable de JSON ordena claves de objetos y preserva orden de arrays. | Permitir distinto orden de claves; bloquear filtros distintos. |
| Filtro local | `matchesApifyJobText` busca frases exactas en título y descripción; `|` es OR y `&&` exige cada grupo. | Usar frases explícitas y guardar `post_filter_text`. |

## Específico de Upwork / este actor

- Actor live observado: `hyperbach/upwork-scraper-ai`.
- Campos usados para importar: `id`, `url`, `date_posted`, `title`, `description`, `refreshed_at` y payload crudo.
- Una página se consulta con `notifications_only: false`; la siguiente recibe `page_after` igual a `next_page`.
- El actor puede devolver candidatos irrelevantes incluso cuando acepta `keywords_match: strict`. La validación local es obligatoria para categorías de nicho.
- La cobertura se registra en `market_radar_coverage_windows` y `market_radar_coverage_pages`; las etiquetas compartidas viven en `shared_upwork_job_segments`.

## No comprobado: no prometerlo

- Que todos los parámetros de filtro aceptados por el actor se apliquen con la semántica esperada.
- Que un cursor terminal con una fecha mínima posterior al inicio de ventana pruebe días cero completos. La tabla guarda cursor terminal, pero el criterio de completitud actual se basa en la fecha mínima.
- Que una única clase ejecute actor, lectura de OUTPUT, importación y persistencia de cobertura de punta a punta. Hoy existen componentes y scripts separados.
- Que el postfiltro textual represente relevancia semántica, sinónimos o una taxonomía completa.

## Ejemplo: importar un dataset ya validado

Ejecuta desde `backend/`. Mantén los tokens fuera de la terminal y de los logs.

```powershell
$env:APIFY_RUN_ID = '<run-id>'
$env:APIFY_DATASET_ID = '<dataset-id>'
$env:APIFY_SEGMENT = 'aeo-geo'
$env:APIFY_TEXT_MATCH = 'answer engine optimization|generative engine optimization'
node -r ts-node/register/transpile-only scripts/import-apify-live-dataset.ts
```

El resultado distingue `received` (filas que pasaron el filtro) de `inserted` (vacantes nuevas). Un `inserted: 0` no implica fallo: puede significar que el catálogo ya tenía todas las vacantes.

## Ejemplo: registrar una página terminada

Después de validar la página, configura el input canónico y la procedencia. Para una primera página, `APIFY_INPUT_CURSOR` debe quedar ausente. Para una continuación, debe ser exactamente el `output_cursor` anterior.

```powershell
$env:MARKET_RADAR_WINDOW_START = '2026-10-22T00:00:00.000Z'
$env:MARKET_RADAR_WINDOW_END = '2026-11-05T23:59:59.999Z'
$env:APIFY_OLDEST_POSTED_AT = '<oldest-date-posted>'
$env:APIFY_QUERY_FINGERPRINT = 'aeo-geo:2026-10-22:text-v1'
$env:APIFY_ACTOR_INPUT_JSON = '<canonical-json>'
$env:APIFY_RUN_ID = '<run-id>'
$env:APIFY_DATASET_ID = '<dataset-id>'
node -r ts-node/register/transpile-only scripts/record-market-radar-coverage-page.ts
```

If the script reports a cursor or canonical-input mismatch, do not bypass it. Re-read the last coverage page and reconcile the actual actor input before retrying.
