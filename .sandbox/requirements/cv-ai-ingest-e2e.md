# Requirement: Ingesta Universal de CV con IA, Calibración de Perfil y Scoring Explicable

## Descripción
Validación visual End-to-End del flujo completo de ingestión de CV y proyectos reales de Leonardo Jaimes Estevez:
1. Estado inicial con perfil limpio en base de datos.
2. Apertura del Selector de Perfiles y Modal de Calibración con pestaña IA activa.
3. Carga automática de la experiencia técnica de Leonardo (Spotlight Studio, PepperTix, Pepper Bot).
4. Síntesis en tiempo real con IA (Gemini 2.5 Flash):
   - Extracción de Nombre y Título Posicionador.
   - 4 Proof Stories reales con métricas de impacto verificables.
   - Taxonomía Semántica de 4 niveles (Core, Híbrido, Tangencial, Excluido).
   - Configuración de Scraping (queries booleanas y tasas).
   - Rationale algorítmico: Explicación de *por qué se da este scoring* (Drivers vs Drags).
5. Activación en 1 clic:
   - Persistencia en PostgreSQL.
   - Re-evaluación determinística de las 290 vacantes ($0 USD, 0 tokens).
6. Verificación en la Cabina de Despacho (Terminal) y en el Motor de Búsqueda (Explorer).

## Criterios de Aceptación y Checkpoints
- `01-profile-modal-ai-tab.png`: Modal abierto mostrando la pestaña de Ingesta IA, textarea y zona drag-and-drop.
- `02-cv-loaded-in-modal.png`: CV de Leonardo Jaimes cargado en el área de texto listo para síntesis.
- `03-ai-synthesis-preview.png`: Preview de la síntesis de IA con Proof Stories, taxonomía 4-tiers y explicación de scoring.
- `04-activated-cabina-despacho.png`: Perfil activado y vacantes re-evaluadas reflejando los nuevos Gold Leads en la Cabina de Despacho.
- `05-motor-busqueda-scored-leads.png`: Vista de tabla de vacantes filtradas por afinidad técnica para Leonardo.
