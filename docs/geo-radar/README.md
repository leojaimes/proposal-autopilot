# 🛰️ Geo-Radar B2B: Ingresor & Gestor Táctico de Polígonos

**Módulo:** Geo-Radar & Scraping de Dolencias B2B (`proposal-autopilot`)  
**Capacidad Entregada:** Ingreso, dibujo, delimitación y filtrado estricto por Polígonos Tácticos (Geoman + GeoJSON + Ray-Casting Bounding Box)  
**Costo Operativo:** **$0.00 USD / mes** ($0 Google Maps JS API hits)

---

## 📸 Evidencia Visual: Ingreso & Escaneo por Polígono

````carousel
![05 - Modal Ingresor de Polígonos](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/05_polygon_ingestion_modal.png)
<!-- slide -->
![06 - Polígono Táctico Delimitado en el Mapa](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/06_tactical_polygon_rendered_on_map.png)
<!-- slide -->
![07 - Escaneo y Detección Estricta Dentro del Polígono](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/07_polygon_scan_results_map.png)
<!-- slide -->
![01 - Vista Radar Circular](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/01_georadar_initial_state.png)
<!-- slide -->
![04 - Pitch WhatsApp Preparado](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/04_georadar_pitch_drawer_copied.png)
````

---

## 📐 Capacidades del Ingresor de Polígonos

### 1. Dibujo Táctico Interactivo en Vivo (Leaflet-Geoman)
- El usuario puede presionar el botón de **Polígono** o **Rectángulo** en la barra superior derecha del mapa.
- Al cerrar el trazo sobre el mapa, el sistema captura automáticamente los vértices con `pm:create`, aplica el estilo visual táctico en cyan neón (`#06b6d4`, opacidad `0.18`) y conmuta automáticamente al modo `POLYGON`.
- El mapa calcula en tiempo real el área estimada en km² con la fórmula geodésica Shoelace:
  $$A = \frac{R^2}{2} \left| \sum_{i=1}^{n} (\lambda_{i+1} - \lambda_i) (2 + \sin \phi_i + \sin \phi_{i+1}) \right|$$

### 2. Modal Ingresor de Polígonos (GeoJSON / Coordenadas / Presets)
- **Presets de Corredores Tácticos (1-clic)**:
  - *Zona Industrial Benito Juárez* (Querétaro)
  - *Corredor Comercial Bernardo Quintana* (Querétaro)
  - *Centro Histórico & Comercial* (Querétaro)
  - *Distrito Providencia / Américas* (Guadalajara)
  - *Corredor Corporativo Santa Fe* (Ciudad de México)
  - *Parque Industrial Apodaca* (Monterrey)
- **Pegado Manual Libre**:
  - Acepta objetos GeoJSON `Feature` o `Polygon`.
  - Acepta arrays de coordenadas: `[[lat, lng], [lat, lng], ...]`.
  - Acepta listas línea por línea: `20.6150, -100.4400`.
- **Botón `[Aplicar al Mapa]`**: Renderiza el polígono, centra automáticamente la cámara con `map.fitBounds` y activa el modo de escaneo zonal.

---

## ⚙️ Backend: Algoritmo de Contención y Filtrado Espacial

```mermaid
flowchart TD
    Req["POST /api/prospecting/scan-area\n{ sector, polygon: [[lat, lng], ...] }"] --> BBox["Calcular Bounding Box & Centroide\n(prospecting-geometry.utils)"]
    BBox --> Area["Calcular Área km² (Fórmula Geodésica)"]
    BBox --> Gen["Generación / Extracción de Candidatos en Bounding Box"]
    Gen --> RayCast{"Ray-Casting Algorithm:\n¿isPointInsidePolygon?"}
    RayCast -- SÍ --> Keep["Conservar Lead & Diagnosticar Dolencias"]
    RayCast -- NO --> Discard["Descartar Candidato"]
    Keep --> Pain["CompanyPainAnalyzerService\n(Categorización + Pitch)"]
    Pain --> DB[("Prisma PostgreSQL\nprospected_businesses")]
```

### 1. Ray-Casting Point-in-Polygon (`prospecting-geometry.utils.ts`)
Garantiza matemáticamente que solo las empresas dentro del polígono irregular sean procesadas y guardadas. Los 5 tests unitarios corren al 100%:
- Detección de punto interior: `PASS`
- Detección de punto exterior: `PASS`
- Bounding Box y Centroide: `PASS`
- Área esférica no nula: `PASS`
- Normalización de formatos mixtos: `PASS`

---

## 🚦 Quality Gate & Verificación E2E

- [x] **Backend**: Compilado y contenedor Docker sincronizado (`proposal_autopilot_backend:7000`).
- [x] **Frontend**: Angular 19 compilado con 0 errores y desplegado en contenedor Nginx (`proposal_autopilot_frontend:7001`).
- [x] **Playwright E2E**: Ejecutado exitosamente validando:
  - Apertura del modal ingresor de polígonos.
  - Selección de preset táctico.
  - Renderizado del polígono neón en Leaflet.
  - Ejecución del escaneo estricto por polígono.
  - Visualización de prospectos filtrados dentro del polígono.
