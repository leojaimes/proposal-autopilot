# Geo-Radar B2B: UI Flow Discovery & E2E Visual Verification

## Context & Objectives
Validar exhaustivamente el flujo de usuario del **Geo-Radar Prospector de Empresas B2B con Ingreso de Polígonos Tácticos**:
1. Acceso a la cabina y navegación hacia el view `GEO_RADAR`.
2. Modo Radio Circular interactivo con slider de cobertura (1 a 20 km).
3. Conmutador a Modo Polígono Táctico.
4. Apertura e interacción con el Modal Ingresor de Polígonos (Presets industriales y pegado libre de GeoJSON / Coordenadas).
5. Renderizado táctico del polígono en Leaflet con Geoman y cálculo dinámico de área km².
6. Ejecución del escaneo zonal y filtrado estricto por Ray-Casting.
7. Inspección del feed de prospectos, semáforo de dolencias y drawer de propuesta/pitch para WhatsApp.

## Acceptance Criteria
- [x] **AC-1**: La interfaz renderiza el mapa CartoDB Dark Matter con controles tácticos.
- [x] **AC-2**: El selector de modo permite alternar entre Radio Circular y Polígono Táctico.
- [x] **AC-3**: El modal ingresor permite seleccionar zonas predefinidas (ej. Zona Industrial Benito Juárez) o pegar coordenadas.
- [x] **AC-4**: El mapa auto-enfoca (`fitBounds`) el polígono delimitado y calcula los vértices y área estimada.
- [x] **AC-5**: El escaneo de negocios diagnostica dolencias de software (`NO_WEBSITE`, `NO_ONLINE_BOOKING`, `UNRESPONSIVE_CUSTOMER_SERVICE`) y despliega los pines interactivos.
- [x] **AC-6**: Al seleccionar un negocio, se abre el drawer con el pitch personalizado y el botón de WhatsApp.

