import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const TELEMETRY_FILE = join(resolve('.'), 'scripts', 'factory', '.factory_telemetry.jsonl');

/**
 * Appends an execution event to the Factory's telemetry log.
 */
export function recordTelemetry(event) {
  try {
    const entry = {
      timestamp: new Date().toISOString(),
      ...event
    };
    appendFileSync(TELEMETRY_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Fail silently so telemetry never breaks the main flow
  }
}

/**
 * Summarizes the factory's historical metrics for the user/agent.
 */
export function showMetrics() {
  if (!existsSync(TELEMETRY_FILE)) {
    console.log('ℹ️ No hay métricas registradas todavía. Se generarán con la primera tarea.');
    return;
  }

  const lines = readFileSync(TELEMETRY_FILE, 'utf8').split('\n').filter(Boolean);
  const events = lines.map(l => {
    try { return JSON.parse(l); } catch { return null; }
  }).filter(Boolean);

  let totalTasks = 0;
  let auditsRun = 0;
  let auditPasses = 0;
  let completedTasks = 0;
  const failureReasons = {};

  for (const e of events) {
    if (e.action === 'start') totalTasks++;
    if (e.action === 'finish') completedTasks++;
    if (e.action === 'audit') {
      auditsRun++;
      if (e.allPass) auditPasses++;
      if (e.failures) {
        for (const f of e.failures) {
          failureReasons[f] = (failureReasons[f] || 0) + 1;
        }
      }
    }
  }

  const passRate = auditsRun > 0 ? Math.round((auditPasses / auditsRun) * 100) : 100;

  console.log(`
📊 OBSERVABILIDAD DE LA AI FACTORY
==================================
Total de tareas iniciadas:    ${totalTasks}
Tareas completadas (GHCR):    ${completedTasks}
Auditorías ejecutadas:        ${auditsRun}
Tasa de aprobación (Consejo): ${passRate}%

Desglose de rechazos por dimensión:
${Object.keys(failureReasons).length > 0
  ? Object.entries(failureReasons).map(([k, v]) => `  - ${k}: ${v} rechazos`).join('\n')
  : '  - Ningún rechazo registrado'}
==================================
`);
}
