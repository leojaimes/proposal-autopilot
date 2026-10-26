# 🗺️ Mapa de Navegación y Arquitectura UI de Proposal Autopilot

**Fecha de Descubrimiento:** 2026-10-26T16:35:39.819Z  
**Origen:** Descubierto automáticamente por `af discover-flows` en `http://localhost:7001`  

---

## 🏛️ Diagrama de Estados y Flujos (Mermaid)

```mermaid
graph TD
    classDef primary fill:#1e293b,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;
    classDef drawer fill:#312e81,stroke:#818cf8,stroke-width:2px,color:#f8fafc;
    classDef action fill:#064e3b,stroke:#34d399,stroke-width:2px,color:#f8fafc;

    HEADER["Header de Navegación (DispatchHeader)"]:::primary

    HEADER -->|"Tab 'Cabina de Despacho'"| TERMINAL["Cabina de Despacho (DispatchTerminal)"]:::primary
    HEADER -->|"Tab 'Motor de Búsqueda'"| EXPLORER["Motor de Búsqueda (JobExplorer)"]:::primary
    HEADER -->|"Tab 'Radar de Mercado'"| RADAR["Radar de Mercado (MarketRadar)"]:::primary
    HEADER -->|"Tab 'Perfil & Ajustes'"| PROFILE["Perfil Profesional & Preferencias i18n (UserProfile)"]:::primary

    HEADER -->|"Botón 'Calibrar'"| DRAWER["Cajón de Calibración (EngineSettingsDrawer)"]:::drawer
    HEADER -->|"Botón 'Buscar Más Proyectos'"| SSE["Ingestión SSE en Vivo (LiveScrapeProgress)"]:::action
    HEADER -->|"Botón 'Re-evaluar Leads ($0)'"| REPROCESS["Re-scoring Masivo con IA"]:::action

    RADAR -->|"SSE radarRevision"| RADAR_REFRESH["Refresco Reactivo de Snapshots"]:::action
    TERMINAL -->|"Atajo J/K / D"| LEAD_DISPATCH["Despacho / Descarte de Lead"]:::action
    PROFILE -->|"Conmutar Idioma"| I18N_SWITCH["Actualización Reactiva de Idioma"]:::action

```

---

## 📊 Matriz de Cobertura E2E Descubierta

| Identificador | Tipo | Elemento | Recorrido Declarativo Asociado | Cobertura |
| :--- | :---: | :--- | :--- | :---: |
| `TERMINAL` | Vista | Cabina de Despacho | `tests/journeys/journey-dispatch-terminal.json` | 🟢 100% |
| `EXPLORER` | Vista | Motor de Búsqueda | `tests/journeys/journey-job-explorer.json` | 🟢 100% |
| `RADAR` | Vista | Radar de Mercado | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
| `PROFILE` | Vista | Perfil & Preferencias i18n | `tests/journeys/journey-user-profile.json` | 🟢 100% |
| `DRAWER_CALIBRATION` | Cajón | Ajustes de Motor | `tests/journeys/journey-calibration-drawer.json` | 🟢 100% |
| `ACTION_SCRAPING` | Pipeline | Búsqueda en Upwork (SSE) | `tests/journeys/radar-discovery-flow.json` | 🟢 100% |
| `ACTION_REPROCESS` | Pipeline | Re-evaluación ($0) | `tests/journeys/journey-reprocess-leads.json` | 🟢 100% |

---
*Generado automáticamente por Proposal Autopilot AI Factory Flow Discovery Engine*
