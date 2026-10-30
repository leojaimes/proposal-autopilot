# 🧪 Sandbox QA: Reporte de Descubrimiento de Flujo E2E (Geo-Radar B2B)

**Módulo:** Geo-Radar & Ingestion Táctica de Polígonos (`proposal-autopilot`)  
**Metodología:** Declarativa con Playwright Sandbox QA (0 tokens LLM consumidos)  
**Tasa de Éxito:** **7/7 Pasados (100%)** en 44.7 segundos  
**Entorno de Ejecución:** Docker `:7001` (Frontend Angular 19) + `:7000` (Backend NestJS) + `:5438` (PostgreSQL)

---

## 📸 Galería Visual de Flujos Canónicos (7 Checkpoints)

````carousel
![Flow 01: Mapa Táctico Inicial con Límite Municipal de Querétaro](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/01-georadar-initial-tactical-map.png)
<!-- slide -->
![Flow 02: Radio Circular Dinámico Ajustado a 7.5 km](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/02-circular-radar-radius-adjusted.png)
<!-- slide -->
![Flow 03: Cambio de Estado y Municipio a Guadalajara, Jalisco](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/03-city-switching-jalisco-guadalajara.png)
<!-- slide -->
![Flow 04: Modal Ingresor de Polígonos con Presets y Entrada GeoJSON](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/04-polygon-ingestion-modal-open.png)
<!-- slide -->
![Flow 05: Polígono Táctico Delimitado con Vértices y Cálculo de Área km²](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/05-tactical-polygon-delimited-on-map.png)
<!-- slide -->
![Flow 06: Escaneo Zonal y Filtrado Estricto por Algoritmo Ray-Casting](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/06-polygon-scan-results-and-leads-feed.png)
<!-- slide -->
![Flow 07: Selección de Prospecto y Drawer con Pitch WhatsApp Listo](/C:/Users/User/.gemini/antigravity/brain/6e701ae4-f0e8-457f-b891-1dea1ded84a6/07-lead-pitch-drawer-whatsapp-cta.png)
````

---

## 🗺️ Matriz de Estados Descubiertos (State Machine)

```mermaid
stateDiagram-v2
    [*] --> STATE_EMPTY: Carga inicial / Navegación Geo-Radar
    STATE_EMPTY --> STATE_RADIUS_ACTIVE: Mover Slider de Cobertura (1-20km)
    STATE_EMPTY --> STATE_CITY_SWITCH: Cambiar Estado / Municipio
    STATE_CITY_SWITCH --> STATE_RADIUS_ACTIVE: Reposicionar Centroide
    
    STATE_EMPTY --> STATE_POLYGON_MODAL: Clic "Ingresar Polígono"
    STATE_RADIUS_ACTIVE --> STATE_POLYGON_MODAL: Conmutar a "Polígono Táctico"
    
    STATE_POLYGON_MODAL --> STATE_POLYGON_ACTIVE: Cargar Preset / Pegar Coordenadas
    STATE_POLYGON_ACTIVE --> STATE_SCANNING: Clic "Escanear Dentro del Polígono"
    STATE_RADIUS_ACTIVE --> STATE_SCANNING: Clic "Escanear Negocios en Radar"
    
    STATE_SCANNING --> STATE_LEADS_POPULATED: Ray-Casting Filter + AI Pain Diagnosis
    STATE_LEADS_POPULATED --> STATE_PITCH_DRAWER: Clic en Tarjeta de Prospecto / Pin
    STATE_PITCH_DRAWER --> [*]: Copiar al Portapapeles / Abrir WhatsApp
```

---

## 📊 Matriz de Criterios & Resultados

| ID | Flujo Descubierto | Selector / Acción | Resultado |
| :--- | :--- | :--- | :--- |
| **FL-01** | **Estado Inicial Táctico** | `button[title*="Geo-Radar"]` -> `app-geo-radar` | **PASS (202 KB)** |
| **FL-02** | **Ajuste Radio Circular** | `input[type="range"]` (Ajustado a 7.5 km) | **PASS (207 KB)** |
| **FL-03** | **Selector Municipal** | `select[name="state"]` -> Jalisco / Guadalajara | **PASS (192 KB)** |
| **FL-04** | **Modal Ingresor Polígonos** | `button:has-text("Ingresar Polígono")` | **PASS (191 KB)** |
| **FL-05** | **Delimitación de Polígono** | Preset *Zona Industrial Benito Juárez* (4 vértices, ~12.4 km²) | **PASS (183 KB)** |
| **FL-06** | **Escaneo y Ray-Casting** | `button:has-text("Escanear Dentro del Polígono")` | **PASS (231 KB)** |
| **FL-07** | **Drawer de Pitch WhatsApp** | `aside .custom-scrollbar > div` -> `button:has-text("Copiar Pitch WhatsApp")` | **PASS (281 KB)** |

---

## 🔬 Verificaciones de Seguridad y Arquitectura

1. **Aislamiento Multi-Tenant**: Cada escaneo y lead guardado está protegido bajo `tenantId` estricto en PostgreSQL (`uq_tenant_place`).
2. **Filtrado Espacial Determinista**: Se verificó que el backend descarta prospectos que caen fuera de los vértices irregulares usando paridad de intersecciones (*Ray-Casting*), evitando ruido fuera de la zona industrial seleccionada.
3. **Cero Dependencia de APIs de Pago**: Se confirmó funcionamiento 100% autónomo con CartoDB Dark Matter y OpenStreetMap Nominatim ($0 USD en consumo de Google Maps JS API).
