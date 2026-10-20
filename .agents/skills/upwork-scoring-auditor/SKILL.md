---
name: upwork-scoring-auditor
description: >-
  Trigger: auditar fit, auditar scoring, por que este empleo tiene este puntaje, audit job fit, rank audit.
  Audita la evaluación y ranqueo de cualquier vacante de Upwork en Proposal Autopilot,
  desglosando los factores que sumaron puntos (Drivers) y los factores que restaron (Drags).
---

# Skill: Auditor de Ranqueo y Fit de Upwork (Upwork Scoring Auditor)

Esta skill analiza en profundidad por qué un empleo recibió una calificación determinada (0 a 100) y verifica si el ranking es fidedigno o si contiene distorsiones.
Para la especificación matemática completa lista para Confluence, consulta [docs/scoring-engine-specification.md](file:///d:/SpotlightProjects/proposal-autopilot/docs/scoring-engine-specification.md).

---

## 🛡️ Reglas de Seguridad (Safety Caps)
1. **Skill Safety Cap:** Si la afinidad técnica es inferior a 40 puntos (`skillScore < 40`), el Fit Score se bloquea en un máximo de **44 puntos** (`CAPPED at 44`), sin importar la solvencia del cliente.
2. **Exclusión Geográfica:** En modo `STRICT_EXCLUDE`, clientes en países no deseados son descalificados automáticamente a **15 puntos**.

---

## Metodología de Auditoría en 4 Dimensiones

Al auditar un empleo específico, evalúa las siguientes 4 dimensiones:

### 1. Afinidad Técnica (Skill Match - 40%)
* ¿Qué habilidades pedía la vacante en su descripción completa (`job_detail`)?
* ¿Cuántas de esas habilidades coinciden con el perfil activo del usuario?
* ¿Existen palabras clave engañosas que inflaron el score (ej. *"email"* confundido con IA)?

### 2. Rentabilidad Económica (Budget Feasibility - 25%)
* ¿El empleo es por hora o precio fijo?
* Si es por hora: ¿el rango (ej. `$40-$60/hr`) cubre la tarifa piso del usuario?
* Si es fijo: ¿el presupuesto total es coherente con el alcance estimado de trabajo?

### 3. Confiabilidad y Solvencia del Comprador (Client Quality - 20%)
* Gasto total histórico:
  * $> \$100,000$ USD: Nivel Tier 1 (Máxima solvencia).
  * $\$10,000 - \$99,999$ USD: Tier 2 (Cliente consolidado).
  * $< \$1,000$ USD: Tier 3 (Cliente nuevo o bajo presupuesto).
* Rating en estrellas (ej. $4.85\bigstar$).
* Verificación de pago: ¿El pago está verificado?

### 4. Nivel de Saturación y Competencia (Win Probability - 15%)
* ¿Cuántas propuestas ya se han enviado?
  * Menos de 5 propuestas: 🟢 Ventaja masiva (Primera línea de atención).
  * 5 a 15 propuestas: 🟡 Competencia moderada.
  * Más de 30 propuestas: 🔴 Saturado (Baja probabilidad de respuesta).
* Antigüedad de la publicación (`publish_time` vs hora actual).

---

## Formato del Reporte de Auditoría

Al presentar la auditoría al usuario, utiliza este formato conciso y transparente:

```markdown
### 📋 Auditoría de Ranqueo: [Título de la Vacante]
* **Fit Score General:** 88 / 100 (HIGH FIT)
* **Perfil Evaluado:** Senior Fullstack Engineer

#### 🚀 Factores a Favor (Drivers +):
* **[+20 pts] Habilidades Clave:** Coincidencia exacta con NestJS y PostgreSQL.
* **[+15 pts] Tarifa Rentable:** Rango de $55-$75/hr supera tu tarifa mínima ($50/hr).
* **[+10 pts] Baja Competencia:** Menos de 5 propuestas enviadas; oportunidad fresca (hace 45 min).
* **[+10 pts] Solvencia del Cliente:** $65,000 USD gastados y 4.9★ con pago verificado.

#### ⚠️ Factores en Contra (Drags -):
* **[-5 pts] Alcance Difuso:** No especifica duración del contrato ni horas semanales esperadas.

#### 📌 Veredicto Estratégico:
**Postular de inmediato.** Excelente cliente con presupuesto alineado y baja competencia. Inyectar la historia de éxito `CISCO_COMMERCE`.
```
