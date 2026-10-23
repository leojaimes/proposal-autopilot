# Requerimiento funcional: Radar de mercado personalizado

El Radar de mercado debe recomendar oportunidades comerciales que una persona concreta pueda ejecutar, no las categorías más atractivas en abstracto. Para hacerlo, combina evidencia de mercado con el perfil activo —profesión, habilidades, oferta y capacidades de IA aplicables— y deja trazable cada recomendación hasta su resultado comercial.

## Resultado esperado

Una persona puede abrir el Radar y responder, sin inferencias externas:

1. Qué categorías puede ejecutar según su perfil activo.
2. Por qué una categoría está recomendada, en observaciones de mercado y ajuste personal.
3. Qué tareas de código o automatización puede acelerar con IA y por qué eso es relevante.
4. Qué evidencia respalda la recomendación y qué datos todavía no se observaron.
5. Qué decisión humana se tomó y cuál fue su resultado comercial.

## Regla principal

Una categoría sólo puede ser `PRIORITIZED` cuando se cumplen todas estas condiciones:

- Existe un perfil activo con profesión, habilidades y oferta definidos.
- La categoría está permitida por la política de categorías del perfil y no está marcada como `EXCLUDED`.
- Hay evidencia de trabajos clasificados y un ajuste al perfil observado; la falta de evidencia no se convierte en afinidad cero.
- El estado operativo del Radar es `READY`.
- Si se atribuye ventaja por IA, el perfil registra una capacidad aplicable a código o automatización y la explicación indica la tarea que habilita.

Un puntaje alto de mercado por sí solo no habilita una recomendación. Tampoco se permite el envío automático de propuestas.

## Fuentes y límites de los datos

| Área | Fuente permitida | Regla |
| --- | --- | --- |
| Perfil personal | Perfil activo, CV procesado, oferta y política de categorías | Define elegibilidad; cambiar el perfil cambia el universo recomendado. |
| Mercado | Snapshots persistidos y trabajos de evidencia | Los valores son observaciones fechadas, nunca valores de ejemplo. |
| IA aplicada | Capacidades declaradas o inferidas del perfil, con una explicación de tarea | Sólo aplica a código o automatización; no es un bonus genérico. |
| Catálogo | Taxonomía versionada y editable | Es configuración de producto, no evidencia de mercado ni un perfil embebido. |

Los datos ficticios pueden existir únicamente en pruebas aisladas. No pueden alimentar el endpoint, la UI ni el cálculo operativo.

## Contrato de columnas

La tabla del Radar representa una categoría y su contexto de decisión. Cada columna debe tener procedencia, fecha y semántica explícitas.

| Columna | Significado | Fuente o cálculo |
| --- | --- | --- |
| Rank, Category, Lane | Posición, categoría y elegibilidad del perfil | Snapshot + política del perfil |
| Overall opportunity | Orden relativo para ese perfil y snapshot | Componentes de mercado + ajuste personal observados |
| Market score | Desglose visible de demanda, competencia y pago | No se muestra como caja negra; cada componente declara cobertura |
| Personal fit / Skill affinity | Compatibilidad con profesión, roles y habilidades | Evaluaciones de ajuste asociadas al perfil activo |
| AI leverage | Capacidad de usar IA para código o automatización en esa categoría | Perfil + explicación de tarea; `Not applicable` si no corresponde |
| New jobs per hour | Ritmo de aparición dentro de una ventana observada | Demanda observada / duración de la ventana |
| Median proposals / % under 10 | Competencia observada | Sólo trabajos con conteo de propuestas conocido |
| Median hourly / Median fixed | Compensación observada | Unidades separadas; no se mezclan ni se imputan |
| % verified clients | Cobertura de verificación de pago | Sólo trabajos con ese campo conocido |
| Relevant jobs sampled / Runs averaged / Updated | Tamaño de muestra, fuentes y vigencia | Snapshot, batches fuente y fecha `asOf` |

Cuando una medición no fue observada, la interfaz debe mostrar `Not observed`; nunca `0` ni una estimación silenciosa.

## Acciones humanas y trazabilidad

Desde una categoría elegible, el operador puede elegir `PRIORITIZED`, `WATCHED` o `DISMISSED` y debe dejar una razón. Cada decisión conserva de forma inmutable:

- snapshot y categoría usados;
- perfil activo, política de categoría y versión de cálculo;
- trabajos de evidencia;
- persona, fecha y razón de la decisión;
- trabajo y propuesta relacionados;
- hitos: enviada, respuesta cualificada, entrevista, contrato y valor realizado.

Una respuesta cualificada es una respuesta del cliente que pide avanzar, solicita información sustantiva o abre una entrevista. Un acuse genérico no cuenta.

## Piloto comercial v1

El valor del Radar se medirá, no se asumirá.

| Decisión | Contrato inicial |
| --- | --- |
| Cohorte principal | Control concurrente: propuestas sin decisión Radar frente a propuestas Radar-led |
| Contexto | Línea histórica de las cuatro semanas previas |
| Duración | Cuatro semanas completas |
| Inclusión Radar-led | Decisión `PRIORITIZED` desde snapshot `READY`, previa al envío de la propuesta |
| Métrica principal | Tasa de respuestas cualificadas = respuestas cualificadas / propuestas enviadas |
| Muestra mínima | 30 propuestas válidas por cohorte; antes de eso sólo se reporta aprendizaje, no uplift |
| Umbral de retención | Mejora de al menos 10 puntos porcentuales contra control, sin empeorar connects por respuesta cualificada más de 10% |
| Métricas secundarias | Entrevistas, contratos, valor realizado, tiempo a shortlist y connects gastados |

Con el mínimo de muestra alcanzado: se retienen reglas que superen el umbral, se ajustan reglas con resultado neutro y se retiran reglas que reduzcan la tasa principal en 5 puntos porcentuales o más.

## Escenarios de aceptación

- [ ] Al cambiar el perfil activo, el Radar recalcula o filtra las categorías elegibles para esa persona.
- [ ] Una categoría excluida, sin ajuste observado o con Radar distinto de `READY` no puede crear una decisión `PRIORITIZED`.
- [ ] Una categoría de código o automatización sólo recibe `AI leverage` cuando el perfil aporta la capacidad correspondiente y la UI explica la tarea.
- [ ] Cada métrica permite distinguir entre cero observado y dato no observado.
- [ ] Cada categoría muestra evidencia de trabajos y la fecha del snapshot que la respalda.
- [ ] Una decisión puede vincularse a propuesta y a sus hitos de resultado sin alterar el contexto histórico.
- [ ] El reporte del piloto identifica muestras y cohortes antes de declarar mejora comercial.

## Fuera de alcance

- Despliegue productivo, cambios de base productiva, programación de Apify o EasyPanel.
- Postulación automática o decisiones comerciales autónomas.
- Afirmar uplift comercial sin duración y muestra mínimas.

## Siguiente implementación

Implementar primero la decisión inmutable y su vínculo con resultado comercial. Después exponer la elegibilidad por perfil y `AI leverage` en la tabla, con sus explicaciones y estados de datos.
