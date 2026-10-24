#!/usr/bin/env node
import { startWorktree, cleanWorktree, listWorktrees } from './worktree.mjs';
import { runTestWithFilter } from './test-filter.mjs';
import { captureScreenshot } from './snap.mjs';
import { runAudit } from './audit.mjs';
import { evaluateApproval } from './approver.mjs';
import { finishTask } from './finish.mjs';
import { generateSpecContext } from './brain.mjs';

const [,, cmd, ...args] = process.argv;

function showHelp() {
  console.log(`
🏭 AI FACTORY CLI (af) — Herramientas de Desarrollo y Aprobación
==============================================================
Uso: node scripts/factory/af.mjs <comando> [argumentos]

Comandos disponibles:
  start <id> [titulo]    Crea un worktree aislado y prepara SPEC.md con contexto del Brain.
  test [comando/filtro]  Ejecuta tests filtrando el 95% del ruido para ahorrar tokens.
  snap <url> [salida]    Toma una captura headless con Playwright para evidencia visual.
  flow [url]             Ejecuta el flujo E2E real ("Buscar Más Proyectos" -> SSE -> Radar).
  journey [nombre]       Ejecuta un recorrido E2E declarativo y genera un Storyboard visual.
  discover-flows [url]   Rastrea el frontend y auto-genera recorridos y mapa de navegación Mermaid.
  migrate [cmd]          Aplica (deploy) o consulta (status) migraciones con puerto seguro.
  verify-db [--pre|--post] Inspecciona integridad de PostgreSQL para cero pérdida de datos.
  guardian [secs]        Sondea salud del contenedor en EasyPanel y ejecuta auto-rollback si falla.
  rollback               Revierte inmediatamente el servicio backend en EasyPanel a la versión previa.
  audit [dir]            Ejecuta las 4 auditorías (Seguridad, UX, UI, Código).
  approve [dir]          Arbitra el Scorecard: genera FEEDBACK.md o Dossier Ejecutivo.
  finish <id> [--yes]    Aduana Visual Pre-Deploy: pide visto bueno y despliega a 'main' (GHCR).
  abort <id>             Elimina el worktree y la rama sin dejar rastros.
  status                 Muestra la lista de worktrees y tareas activas.
  metrics                Muestra estadísticas de la fábrica (aprobaciones, rechazos).
  brain <query>          Consulta quirúrgica de 02-DOCS/ para extraer solo lo relevante.
  help                   Muestra esta ayuda.

Ejemplos:
  node scripts/factory/af.mjs start story-3 "Rebuild queue race condition"
  node scripts/factory/af.mjs test "npm run test:local"
  node scripts/factory/af.mjs audit
  node scripts/factory/af.mjs finish story-3
`);
}

async function main() {
  switch (cmd) {
    case 'start':
      if (!args[0]) {
        console.error('❌ Falta el identificador de la tarea. Ej: af start story-1 "Mi tarea"');
        process.exit(1);
      }
      startWorktree(args[0], args.slice(1).join(' '));
      break;

    case 'test':
      await runTestWithFilter(args.length > 0 ? args.join(' ') : 'npm test');
      break;

    case 'snap':
      await captureScreenshot(args[0] || 'http://localhost:4200', args[1] || './preview.png');
      break;

    case 'flow': {
      const { runRadarScrapeFlow } = await import('./flow.mjs');
      await runRadarScrapeFlow(args[0] || 'http://localhost:7001');
      break;
    }

    case 'journey': {
      const { runJourney, listJourneys } = await import('./journey.mjs');
      if (!args[0] || args[0] === '--list') {
        console.log('📋 Recorridos declarativos disponibles:');
        for (const j of listJourneys()) {
          console.log(`  - ${j.id}: ${j.title} (${j.stepsCount} pasos)`);
        }
        break;
      }
      const headed = args.includes('--headed');
      const urlIdx = args.indexOf('--url');
      const url = urlIdx !== -1 ? args[urlIdx + 1] : undefined;
      await runJourney(args[0], { headed, url });
      break;
    }

    case 'discover-flows': {
      const { discoverUiFlows } = await import('./discover-flows.mjs');
      await discoverUiFlows(args[0] || 'http://localhost:7001');
      break;
    }

    case 'migrate': {
      const { runMigration } = await import('./migrate.mjs');
      await runMigration(args[0] || 'deploy');
      break;
    }

    case 'verify-db': {
      const { runIntegrityCheck } = await import('./verify-db-integrity.mjs');
      const mode = args.includes('--post') ? 'post' : 'pre';
      await runIntegrityCheck(mode);
      break;
    }

    case 'guardian': {
      const { monitorDeployment } = await import('./guardian.mjs');
      await monitorDeployment(parseInt(args[0] || '60', 10));
      break;
    }

    case 'rollback': {
      const { triggerRollback } = await import('./guardian.mjs');
      await triggerRollback();
      break;
    }

    case 'audit':
      runAudit(args[0] || process.cwd());
      break;

    case 'approve':
      evaluateApproval(args[0] || process.cwd());
      break;

    case 'finish':
      if (!args[0]) {
        console.error('❌ Falta el identificador de la tarea. Ej: af finish story-1');
        process.exit(1);
      }
      await finishTask(args[0], args.includes('--yes') || args.includes('-y'));
      break;

    case 'clean':
    case 'abort':
      if (!args[0]) {
        console.error('❌ Falta el identificador de la tarea. Ej: af abort story-1');
        process.exit(1);
      }
      cleanWorktree(args[0], true);
      break;

    case 'status':
    case 'list':
      listWorktrees();
      break;

    case 'metrics': {
      const { showMetrics } = await import('./telemetry.mjs');
      showMetrics();
      break;
    }

    case 'brain':
      if (!args[0]) {
        console.error('❌ Falta el término de búsqueda. Ej: af brain "taxonomy"');
        process.exit(1);
      }
      console.log(generateSpecContext(args.join(' ')));
      break;

    case 'help':
    default:
      showHelp();
      break;
  }
}

main().catch(err => {
  console.error('❌ Error fatal en AI Factory:', err.message);
  process.exit(1);
});
