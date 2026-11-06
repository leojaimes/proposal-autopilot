---
name: market-category-discovery
description: Descubre y recupera categorías de vacantes Upwork con Apify, catálogo compartido y evidencia de cobertura. Úsala para planificar o ejecutar búsquedas históricas; no para el scraping normal de tenants.
---

# Descubrimiento de categorías de mercado

Usa esta skill cuando haya que convertir una categoría de mercado en una búsqueda reproducible, recuperar páginas históricas o verificar que una categoría puede alimentar estadísticas. Se basa en los componentes actuales de Proposal Autopilot y en evidencia observada del actor `hyperbach/upwork-scraper-ai`.

## Antes de gastar créditos

1. Escribe la definición de categoría: frases incluidas, exclusiones y rango UTC. No uses siglas ambiguas como única regla (`GEO` puede referirse a geografía).
2. Separa el **input del actor** del **postfiltro local**. El primero obtiene candidatos; el segundo decide qué se etiqueta.
3. Busca una ventana y página de cobertura existentes para el mismo segmento. Reutiliza su dataset o cursor antes de lanzar otra corrida.
4. Confirma el token sin mostrarlo, revisa que no exista un lote activo y pide autorización explícita antes de una llamada paga.

## Flujo operativo

1. Lanza el actor con `notifications_only: false`, límite, límite de cargo y un límite inferior `date_posted`.
2. Exige estado `SUCCEEDED`, `defaultDatasetId` y store `OUTPUT`.
3. Lee `OUTPUT`. Para este actor, `metadata.next_page` y `metadata.has_more_results` son los campos observados. Usa `next_page` como `page_after` de la siguiente página exactamente una vez.
4. Lee el dataset completo por offsets. Conserva el `runId`, `datasetId`, cursor de entrada/salida y la fecha `date_posted` más antigua.
5. Antes de importar, revisa URLs reales de Upwork y mide cuántas filas pasan el postfiltro local. Si la muestra contradice la categoría, detente: no etiquetes el dataset completo.
6. Importa al catálogo compartido con `APIFY_SEGMENT`. Si se requiere, configura `APIFY_TEXT_MATCH`: `|` significa una alternativa y `&&` exige todos los grupos. Sólo compara `title` y `description`, sin semántica ni regex.
7. Registra la página de cobertura con el input canónico, incluyendo `post_filter_text` cuando se aplicó. Una continuación debe usar el cursor precedente exacto.

## Reglas de persistencia y caché

- La identidad de una vacante live es su `externalUpworkId`; el catálogo usa inserción idempotente y conserva las etiquetas de segmento en una relación muchos-a-muchos.
- No borres ni reemplaces el seed protegido al importar datos live.
- Para una cadena, el input canónico debe ser semánticamente igual en todas las páginas. Un cambio de orden de claves JSON no es un cambio de filtro; una diferencia de contenido sí debe bloquear la continuación.
- No vuelvas a cobrar por una página ya corrida: reimporta el `datasetId` existente o continúa desde `output_cursor`.
- Un cursor nulo sólo prueba que el actor declaró la página terminal. No afirmes completitud de días con cero vacantes si el criterio de cobertura de la aplicación todavía no lo modela explícitamente.

## Filtrado y clasificación

El filtrado del actor es una fuente de candidatos, no una prueba de relevancia. Se observó que una búsqueda aparentemente estricta de UX research devolvió resultados ajenos. Para categorías sensibles:

- usa frases completas y conservadoras;
- registra las frases locales usadas como evidencia;
- no amplíes a sinónimos, siglas o clasificación semántica sin una definición aprobada;
- conserva el payload crudo para auditoría y reclasificación futura.

## Recuperación

- Si la corrida falla: no registres una página; conserva la definición e investiga el error.
- Si termina pero la importación falla: valida el dataset existente y reejecuta sólo la importación; no lances el actor otra vez.
- Si se interrumpe tras importar: registra la página usando el `runId`, `datasetId`, input canónico, cursor y fecha observada.
- Si una página tiene cursor: continúa con él. Si el input canónico no coincide, detente en vez de mezclar dos búsquedas.
- Si no hay fecha `date_posted` válida, no persistas la página como cobertura.

## Validación antes de reportar

Comprueba, y reporta sólo lo comprobado:

- estado terminal, IDs de run/dataset y cursor;
- conteo del dataset y mínimo/máximo `date_posted`;
- URLs `upwork.com/jobs/...` de muestra;
- proporción o conteo de coincidencias del postfiltro;
- inserciones nuevas frente a filas deduplicadas;
- cadena de cursor y fila de cobertura persistida.

Lee [patterns-and-boundaries.md](references/patterns-and-boundaries.md) para ejemplos operativos, campos y límites verificados.
