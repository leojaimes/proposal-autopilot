---
name: profile-calibrator
description: >-
  Trigger: calibrar perfil, nuevo perfil, agregar perfil, cambiar especialidad, setup icp, calibrate profile.
  Guía y asiste en la creación, calibración y registro de un nuevo Perfil de Posicionamiento (ICP)
  en Proposal Autopilot, extrayendo habilidades clave, tarifas base, palabras de descarte y Proof Stories de autoridad.
---

# Skill: Calibrador de Perfiles Profesionales (Profile Calibrator)

Esta skill te permite calibrar cualquier especialidad profesional (Fullstack Developer, AI Engineer, UX/UI Designer, Growth Hacker, etc.) para que el algoritmo de scoring clasifique vacantes con precisión milimétrica.

---

## Procedimiento Paso a Paso

### Paso 1: Definición del Rol y Posicionamiento
Pregunta o recopila la siguiente información del usuario:
1. **Nombre del Perfil:** (ej. *"Senior Fullstack TypeScript / Python"* o *"AI Interaction Designer"*).
2. **Propuesta de Valor (Headline):** 1 frase contundente que resuma el impacto.
3. **Público Objetivo (Target Audience):** Tipos de clientes ideales (ej. *"Startups B2B SaaS de etapa temprana con financiamiento semilla o serie A"*).
4. **Tarifa Horaria Piso (`min_hourly_rate`):** Tarifa mínima aceptable en USD (ej. `$55.00/hr`).
5. **Presupuesto Fijo Piso (`min_fixed_budget`):** Presupuesto mínimo aceptable para proyectos a precio cerrado (ej. `$1,500.00`).

---

### Paso 2: Habilidades Clave y Palabras de Descarte (Dealbreakers)
Define los dos conjuntos de palabras clave:

* **Core Skills (Habilidades Positivas):**
  Lista de 5 a 10 tecnologías o metodologías centrales.
  * *Ejemplo Fullstack:* `['NestJS', 'Angular', 'PostgreSQL', 'Docker', 'TypeScript', 'Prisma', 'REST APIs']`
* **Dealbreaker Keywords (Filtros de Exclusión / Ruido):**
  Palabras o frases que deben descalificar un empleo de inmediato.
  * *Ejemplo:* `['WordPress', 'unpaid', 'internship', 'commission only', 'crypto token launch', 'shopify template']`

---

### Paso 3: Registro de Proof Stories de Autoridad
Cada perfil debe contar con al menos 2 a 4 casos de éxito con métricas comprobables:
1. **Código Clave (`keyCode`):** (ej. `ENTERPRISE_ERP`, `FINTECH_SCALING`).
2. **Empresa o Producto:** (ej. *"Stripe Connect Integration"*).
3. **Métrica de Impacto:** (ej. *"Processed $12M volume with 99.99% uptime"*).
4. **Etiquetas de Dominio:** (ej. `['Fintech', 'Microservices', 'High Scale']`).

---

### Paso 4: Persistencia en la Base de Datos
Genera y ejecuta la mutación en PostgreSQL vía Prisma para asociar el nuevo perfil al `tenantId` correspondiente:

```typescript
const newProfile = await prisma.positioningProfile.create({
  data: {
    tenantId: '00000000-0000-0000-0000-000000000001',
    offerHeadline: 'Senior Fullstack Engineer · Scalable NestJS & Angular Systems',
    targetAudience: 'High-growth SaaS startups needing robust backend and sleek interfaces',
    voiceRules: ['Technical precision', 'Zero fluff', 'Architecture first'],
    isActive: true,
    proofStories: {
      create: [
        {
          keyCode: 'PAYMENT_ENGINE',
          companyOrProduct: 'Global Pay Gateway',
          impactMetric: 'Over $25M in transaction volume processed',
          domainTags: ['NestJS', 'PostgreSQL', 'Fintech'],
        },
      ],
    },
  },
});
```
