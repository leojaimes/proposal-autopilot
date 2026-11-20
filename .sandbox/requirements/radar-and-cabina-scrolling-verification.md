# Requerimiento: Verificación de Scrolling en Market Radar y Cabina de Despacho + Tabla Comparativa Mes a Mes

## 1. Contexto y Objetivo
Asegurar que:
1. El Market Radar (`/radar/market`) permite scroll vertical sin restricciones para visualizar tanto la Matriz Estratégica de 29 columnas como la tarjeta dedicada de **Comparativa Macro Upwork Mes a Mes** (idéntica al diseño provisto por el usuario).
2. La Cabina de Despacho (`/dispatch`) cuenta con scrolling fluido e independiente en el feed de vacantes de la izquierda y la consola de postulación de la derecha.

## 2. Criterios de Aceptación
1. **Scrolling Vertical en Radar**: El usuario puede desplazarse verticalmente desde la cabecera hasta la tabla comparativa mes a mes.
2. **Tabla Comparativa Mes a Mes**: Se renderiza con exactamente 4 columnas:
   - `Category`, `Postings/mo`, `Share vs a year ago`, `Last 3 mo vs prior 3`.
3. **Scrolling en Cabina de Despacho**: Contenedores flex con `min-h-0` para scroll independiente en lista y panel de detalle.
