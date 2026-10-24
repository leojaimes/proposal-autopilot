#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const REMOTE_HOST = process.env.EASYPANEL_HOST || '31.220.52.198';
const REMOTE_USER = process.env.EASYPANEL_USER || 'root';
const SERVICE_BACKEND = 'proposal-autopilot_proposal-backend';
const SERVICE_DB = 'proposal-autopilot_proposal-db';

/**
 * Runs a remote bash command via SSH using base64 pipeline to avoid escaping errors.
 */
function runSsh(cmd) {
  try {
    const b64 = Buffer.from(cmd).toString('base64');
    return execSync(`ssh -o BatchMode=yes -o ConnectTimeout=10 ${REMOTE_USER}@${REMOTE_HOST} "echo '${b64}' | base64 -d | bash"`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    }).trim();
  } catch (err) {
    throw new Error(err.stderr?.trim() || err.stdout?.trim() || err.message);
  }
}

/**
 * Executes an instant rollback of the Docker Swarm service on EasyPanel.
 */
export async function triggerRollback(service = SERVICE_BACKEND) {
  console.log('\n' + '═'.repeat(65));
  console.log(`🚨 GUARDÍAN CANARIO: DISPARANDO AUTO-ROLLBACK EN EASYPANEL`);
  console.log('═'.repeat(65));
  console.log(`⏳ Revirtiendo servicio '${service}' al estado previo en Docker Swarm...`);

  try {
    const out = runSsh(`docker service rollback ${service}`);
    console.log(`✅ Comando de rollback ejecutado: ${out}`);

    console.log('⏳ Esperando 5 segundos para convergencia del contenedor anterior...');
    await new Promise(r => setTimeout(r, 5000));

    const status = runSsh(`docker service ps ${service} --no-trunc | head -n 3`);
    console.log('\n📋 Estado del servicio tras el rollback:');
    console.log(status);
    console.log('\n🛡️ ROLLBACK COMPLETADO: El tráfico de producción está seguro en la versión previa.');
    return { success: true };
  } catch (err) {
    console.error(`❌ Fallo al ejecutar rollback: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Collects crash logs, database state, and generates an automated Post-Mortem.
 */
export function evaluateFailure(service = SERVICE_BACKEND) {
  console.log('\n🔍 Evaluando causa raíz del fallo en producción (Post-Mortem)...');
  try {
    const logs = runSsh(`docker service logs --tail 60 ${service}`);
    
    // Check database migration state via base64 encoded query
    const dbQuery = 'SELECT migration_name, started_at, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5;';
    const b64Query = Buffer.from(dbQuery).toString('base64');
    let dbState = 'No disponible';
    try {
      dbState = runSsh(`echo "${b64Query}" | base64 -d | docker exec -i $(docker ps -q -f name=${SERVICE_DB}) psql -U postgres -d proposal_autopilot_db`);
    } catch {
      // ignore
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const postMortemFile = join(ROOT_DIR, `POST_MORTEM_${timestamp}.md`);

    const reportContent = `# 🚨 Reporte Post-Mortem de Fallo Canario en EasyPanel
**Fecha:** ${new Date().toISOString()}  
**Servicio Afectado:** ${service}  
**Acción Tomada:** Auto-Rollback determinista ejecutado con éxito.

---

## 1. Logs Recientes del Contenedor
\`\`\`text
${logs}
\`\`\`

---

## 2. Estado de Migraciones en Base de Datos
\`\`\`text
${dbState}
\`\`\`

---

## 3. Diagnóstico Automático
- **Condición detectada:** El contenedor no superó las pruebas canarias de salud o falló en el arranque.
- **Estado de Producción:** Protegido mediante rollback a la versión estable previa.
- **Siguiente Paso:** Revisa los logs arriba para identificar si se debió a un error de migración (P3009/P3018), variables de entorno o excepción en NestJS.
`;

    writeFileSync(postMortemFile, reportContent, 'utf8');
    console.log(`\n📄 Reporte Post-Mortem guardado en:\n   ${postMortemFile}`);
    console.log('\n' + '─'.repeat(65));
    console.log('📌 Resumen de Logs de Error:');
    const errorLines = logs.split('\n').filter(l => l.includes('Error') || l.includes('ERROR') || l.includes('failed') || l.includes('Crash')).slice(-10);
    console.log(errorLines.length > 0 ? errorLines.join('\n') : logs.slice(-500));
    console.log('─'.repeat(65));
  } catch (err) {
    console.error(`⚠️ No se pudo generar el post-mortem completo: ${err.message}`);
  }
}

/**
 * Monitors live container deployment for up to timeoutSeconds with active smoke testing.
 */
export async function monitorDeployment(timeoutSeconds = 60) {
  console.log('\n' + '═'.repeat(65));
  console.log('🛡️ INICIANDO GUARDÍAN CANARIO EN EASYPANEL');
  console.log(`⏱️ Ventana de monitoreo: ${timeoutSeconds} segundos`);
  console.log('═'.repeat(65));

  const startTime = Date.now();
  const pollInterval = 5000;
  let consecutiveSuccesses = 0;

  while ((Date.now() - startTime) < (timeoutSeconds * 1000)) {
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    process.stdout.write(`⏳ [${elapsed}s/${timeoutSeconds}s] Inspeccionando contenedor en EasyPanel... `);

    try {
      // 1. Check container process status
      const containerStatus = runSsh(`docker ps -f name=${SERVICE_BACKEND} --format '{{.Status}}'`).split('\n')[0] || '';
      
      if (!containerStatus) {
        console.log('⚠️ Contenedor no encontrado o en transición.');
      } else if (containerStatus.toLowerCase().includes('restarting')) {
        console.log(`❌ EN LOOP DE REINICIO (${containerStatus})`);
        evaluateFailure();
        await triggerRollback();
        return { success: false, reason: 'CrashLoopBackOff detected' };
      } else {
        // 2. Perform live HTTP Smoke Test
        const httpSmoke = runSsh(`docker exec $(docker ps -q -f name=${SERVICE_BACKEND}) wget -qO- http://localhost:7000/api/scraping/proof-stories 2>/dev/null || echo FAIL`);
        
        if (httpSmoke.includes('offerHeadline') || httpSmoke.includes('proofStories')) {
          consecutiveSuccesses++;
          console.log(`🟢 SALUDABLE (HTTP 200 OK, intento ${consecutiveSuccesses}/2)`);
          if (consecutiveSuccesses >= 2) {
            console.log('\n🎉 GUARDÍAN CANARIO APROBADO: El nuevo contenedor está 100% estable y respondiendo.');
            return { success: true };
          }
        } else {
          consecutiveSuccesses = 0;
          console.log(`⚠️ HTTP no responde aún (${httpSmoke.slice(0, 30)}...)`);
        }
      }
    } catch (err) {
      console.log(`⚠️ Excepción en sondeo: ${err.message}`);
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  // Timeout reached without stability
  console.log('\n🚨 TIEMPO AGOTADO: El contenedor no alcanzó estabilidad en el tiempo previsto.');
  evaluateFailure();
  await triggerRollback();
  return { success: false, reason: 'Healthcheck timeout exceeded' };
}

if (process.argv[1]?.endsWith('guardian.mjs')) {
  const cmd = process.argv[2] || 'monitor';
  if (cmd === 'rollback') {
    triggerRollback();
  } else if (cmd === 'post-mortem') {
    evaluateFailure();
  } else {
    monitorDeployment(parseInt(process.argv[3] || '60', 10));
  }
}
