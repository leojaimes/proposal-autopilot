# Regla 03: Aislamiento Multi-Tenant y Cero Código Quemado

## Principio Fundamental
Este sistema es un SaaS multi-inquilino (*multi-tenant*). Ningún servicio, algoritmo de scoring o generador de propuestas debe asumir una identidad fija en el código fuente.

---

## 1. Prohibición de Datos Quemados (Hardcoding)
* Queda **estrictamente prohibido** escribir en código duro nombres como "Pepper AI", "Bo", "Meta Messenger" o roles de diseño en los servicios de negocio (`fit-calculator`, `role-classifier`, `gemini-proposal.service`).
* Si el sistema entra en modo de contingencia (fallback), los datos de respaldo deben construirse dinámicamente leyendo el perfil de posicionamiento (`positioning_profiles`) asociado al `tenantId` activo.

---

## 2. Soporte Multi-Perfil
* El sistema debe permitir que un usuario/inquilino configure y alterne entre **múltiples perfiles de especialidad**:
  * Ejemplo A: Senior Fullstack Engineer (NestJS / Angular / PostgreSQL).
  * Ejemplo B: AI Interaction & Agentic UX Designer (Figma / Design Systems).
  * Ejemplo C: Cloud & DevOps Consultant (AWS / Docker / Kubernetes).
* Cada evaluación de empleo (`fit_evaluations`) debe almacenar la referencia al `positioning_profile_id` con el que fue calculada.

---

## 3. Seguridad y Filtrado por Tenant
Toda consulta a la base de datos (lectura, inserción, actualización o borrado en Prisma) debe incluir obligatoriamente la cláusula:
```typescript
where: { tenantId }
```
Nunca se deben exponer o mezclar vacantes, propuestas o configuraciones entre diferentes cuentas.
