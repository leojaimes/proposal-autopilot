# Regla 01: Integridad de Datos e Ingesta de Apify

## Principio Fundamental
Queda estrictamente prohibido evaluar vacantes con datos simulados, incompletos o strings vacíos. Toda vacante procesada debe contener la descripción real completa y los metadatos económicos fidedignos entregados por Upwork a través de Apify.

---

## 1. Mapeo Defensivo de Campos de Apify (`flash_mage/upwork`)
Al consumir el payload crudo de Apify, **nunca asumas nombres de campos estándar de APIs REST**. Utiliza siempre este mapeo verificado:

* **Descripción del empleo:**  
  `raw.job_detail` (NO usar `raw.description`, viene vacío o inexistente).
* **Gasto total histórico del cliente:**  
  `raw.buyer?.stats?.totalCharges?.amount` (NO usar `raw.client.totalSpent`).
* **Calificación en estrellas del cliente:**  
  `raw.buyer?.stats?.score` (NO usar `raw.client.rating`).
* **País de procedencia del cliente:**  
  `raw.buyer?.location?.country || raw.nation` (NO usar `raw.client.country`).
* **Verificación del método de pago:**  
  `raw.isPaymentMethodVerified` o `raw.buyer?.isPaymentMethodVerified`.
* **Número de aplicantes / propuestas enviadas:**  
  `raw.client_activity?.totalApplicants` (NO usar `raw.proposals.count`).
* **Presupuesto y Tipo:**  
  Leer `raw.budget` y `raw.budget_type`.
* **Fecha de publicación real:**  
  `raw.publish_time ? new Date(raw.publish_time) : new Date()`.

---

## 2. Prohibición de Búsqueda por Subcadenas Sueltas
Queda **estrictamente prohibido** clasificar empleos usando `text.includes('ai')` o `text.includes('course')`.

* **Subcadena `ai`:** Palabras cotidianas como `email`, `paid`, `campaign`, `daily`, `detail` o `maintain` contienen las letras "ai" juntas.
  * *Obligatorio:* Usar expresiones regulares con límites de palabra:  
    `/\b(ai|llm|genai|agentic|gpt)\b/i`.
* **Subcadena `course`:** La frase *"of course"* activa falsos positivos de ruido/tutoría.
  * *Obligatorio:* Excluir *"of course"* explícitamente o buscar frases completas:  
    `/\b(course instructor|tutoring|teach courses)\b/i`.

---

## 3. Preservación del Payload Crudo
Toda inserción o actualización en la tabla `job_posts` debe guardar el objeto íntegro de Apify en la columna `raw_apify_payload` (JSONB). Esto permite re-evaluar o corregir campos históricos en la base de datos a costo cero sin gastar créditos de scraping.
