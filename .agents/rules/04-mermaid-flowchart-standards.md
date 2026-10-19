# Regla 04: Estándar de Diagramas de Flujo Mermaid

## Principio Fundamental
Todo diagrama de ejecución técnica generado para un cliente debe ser sintácticamente válido, limpio y compatible con el componente interactivo de visualización vectorial (SVG con Pan, Zoom y Exportación PNG).

---

## 1. Estándar de Sintaxis Mermaid
* **Tipo de diagrama obligatorio:** `flowchart TD` (Top-to-Bottom).
* **Número de nodos recomendado:** Entre 4 y 6 nodos secuenciales representando las fases del proyecto.
* **Estructura típica de 5 etapas:**
  1. Fase 1: Auditoría / Diagnóstico de Requerimientos.
  2. Fase 2: Arquitectura del Sistema / Solución Técnica.
  3. Fase 3: Prototipado / Desarrollo Core.
  4. Fase 4: Validación, QA y Pruebas.
  5. Fase 5: Despliegue en Producción y Handoff.

---

## 2. Restricciones Técnicas en la Salida JSON
Al solicitar el código Mermaid al LLM (Gemini):
1. **Sin backticks:** El código devuelto en el campo `mermaidDiagramCode` debe ser texto plano (usando saltos de línea `\n`), **nunca envuelto en bloques de markdown** como ` ```mermaid ... ``` `.
2. **Sin caracteres especiales en IDs de nodos:**
   * ✅ Correcto: `A[Auditoría de Requerimientos] --> B[Diseño de Arquitectura]`
   * ❌ Incorrecto: `A-1(Auditoría) --> B.2{Diseño}`
3. **Labels limpios:** No usar comillas dobles ni etiquetas HTML dentro de los corchetes `[...]` para evitar que el parser de Mermaid falle.
