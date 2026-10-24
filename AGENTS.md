# Agent Guidelines & Workflow (Proposal Autopilot)

## Hola-AI Workflow (/backlog -> /story -> /pair)
Este repositorio sigue el flujo de trabajo disciplinado de Extreme Programming (XP) y TDD asistido por IA para evitar quema excesiva de tokens y sobreingeniería:

```
/backlog  ->  /story  ->  /pair
  Qué       Qué exactamente    Cómo
```

1. **`/backlog`**:
   - Escucha la idea o feature y la desglosa en historias de usuario verticales de **1 sola línea** (`As a..., I want..., so that...`).
   - Corta de punta a punta (UI, backend, datos).
   - **Regla:** No inventar requerimientos técnicos ni inflar el backlog (máximo 10-15 historias concisas).

2. **`/story`**:
   - Toma **una** historia a la vez antes de implementarla.
   - Define estrictamente **2 a 3 criterios de aceptación** en formato `Given/When/Then`.
   - Si requiere más de 3 criterios, **se divide** en múltiples historias de usuario.
   - Mini-plan de máximo **5 viñetas**, sin código ni nombres de archivos. Espera la aprobación del usuario antes de proceder.

3. **`/pair` (Pair Programming & TDD estricto)**:
   - El agente es el **Driver** (escribe código) y el usuario es el **Navigator** (aprueba).
   - Propone primero los nombres de los tests sin escribir código.
   - Ciclo estricto: **1 test que falla (Red) -> código mínimo indispensable (Green) -> Detenerse inmediatamente.**
   - Límite de seguridad: Detenerse si el paso supera ~50 líneas o toca más de 3 archivos. Nunca hacer commits automáticos.
