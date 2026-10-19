---
name: apify-batch-sync
description: >-
  Trigger: sincronizar apify, correr scraping, apify batch run, sync jobs, apify sync.
  Guía y ejecuta la extracción controlada de empleos desde Apify hacia PostgreSQL,
  verificando la integridad de los campos y re-procesando lotes existentes sin costo adicional.
---

# Skill: Sincronización y Procesamiento de Lotes de Apify (Apify Batch Sync)

Esta skill administra el ciclo de vida de la ingesta de empleos desde Upwork mediante el actor `flash_mage/upwork` de Apify, garantizando que ninguna vacante quede con campos truncados o nulos.

---

## Modos de Operación

### Modo A: Re-procesamiento en Frío (Costo $0 USD / Sin gastar Apify)
Úsalo cuando quieras re-evaluar vacantes que ya están en la base de datos tras actualizar un perfil, una fórmula de scoring o corregir el mapeo de datos:

1. Lee los registros de `job_posts` donde `raw_apify_payload` NO es nulo.
2. Extrae las propiedades reales del payload JSONB:
   * `title` $\leftarrow$ `raw.title`
   * `description` $\leftarrow$ `raw.job_detail`
   * `clientTotalSpend` $\leftarrow$ `raw.buyer?.stats?.totalCharges?.amount`
   * `clientRating` $\leftarrow$ `raw.buyer?.stats?.score`
   * `clientCountry` $\leftarrow$ `raw.buyer?.location?.country || raw.nation`
   * `proposalsCount` $\leftarrow$ `raw.client_activity?.totalApplicants`
3. Vuelve a ejecutar `fitCalculator.calculate()` con los datos enriquecidos.
4. Actualiza `fit_evaluations` y el estatus en la base de datos.

---

### Modo B: Extracción en Vivo desde Apify
Úsalo para traer vacantes frescas del mercado:

1. **Verificar APIFY_TOKEN:** Comprobar que la variable de entorno `APIFY_TOKEN` esté configurada en `backend/.env`.
2. **Definir Palabras Clave y Límite:**
   * Keywords: Extraídas de las `searchKeywords` de la configuración de scraping del Tenant.
   * Límite recomendado: 15 a 25 resultados para optimizar tiempo y créditos de Apify.
3. **Disparar el Actor:**
   * Ejecutar llamada HTTP a `POST /api/scraping/trigger` con `{ "maxResults": 15, "keywords": [...] }`.
4. **Validación de Calidad Inmediata:**
   * Verificar en el log de backend que los empleos recibidos tengan `description.length > 50`.
   * Verificar que al menos el 50% de los empleos tengan el país del cliente y las propuestas enviadas detectadas.
