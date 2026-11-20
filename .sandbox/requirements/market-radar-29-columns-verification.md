# Requerimiento: Verificación Visual de la Matriz Unificada de 29 Columnas en Market Radar

## 1. Contexto y Objetivo
Verificar que la vista de Market Radar en `http://127.0.0.1:7001/radar` renderiza correctamente la Matriz Estratégica Completa de 29 columnas alimentada por la data real de PostgreSQL (`shared_upwork_jobs` y `market_historical_estimates`) para la sesión autenticada de Armando Russi (`armandorussi@gmail.com`).

## 2. Criterios de Aceptación
1. **Presencia de las 29 Columnas**: La tabla contiene los encabezados canónicos:
   - Rank, Category, Lane, Overall, Opp. (Market), Personal Fit, Recency, Trending, Supply Press., Submissions, Client Qual., New jobs/hr, Share YoY, Momentum, Postings/mo, vs Peak, Scrape Δ, Age (hrs), % 25+ bids, Med. bids, Med. spend, % Verified, Med. $/hr, Med. Fixed, Skill Affinity, AI Ease, Sample, Runs, Updated, Yield $/hr (IA).
2. **Cero Valores Corruptos**: Ninguna celda debe presentar `#ERROR!`, `NaN`, `null`, ni fechas 1900.
3. **Métricas de Arbitraje Verificadas**: Las filas reflejan las medianas cuantitativas reales (ej. Design Systems con $475-$550 fijo y alta facilidad de IA frente a Social Media de bajo ticket).
4. **Captura Visual**: Checkpoint gráfico de alta resolución registrado en `.sandbox/runs/`.
