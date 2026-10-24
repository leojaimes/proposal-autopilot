#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { runAudit } from './audit.mjs';

const ROOT_DIR = resolve('.');

export function evaluateApproval(targetDir = ROOT_DIR, taskId = 'current') {
  const attemptFile = join(targetDir, '.attempt_count.json');
  let attempts = 0;
  if (existsSync(attemptFile)) {
    try {
      attempts = JSON.parse(readFileSync(attemptFile, 'utf8')).count || 0;
    } catch {
      attempts = 0;
    }
  }

  const { allPass, scorecard } = runAudit(targetDir);

  if (!allPass) {
    attempts += 1;
    writeFileSync(attemptFile, JSON.stringify({ count: attempts, updatedAt: new Date().toISOString() }), 'utf8');

    if (attempts >= 2) {
      console.log('\n🛑 [CIRCUIT BREAKER ACTIVADO]: El Builder ha fallado 2 intentos de auditoría consecutivos.');
      console.log('Fábrica en pausa. Intervención humana requerida para evitar quema excesiva de tokens.\n');
      return { approved: false, circuitBreaker: true };
    }

    // Build FEEDBACK.md for the Builder
    let feedbackContent = `# ⚠️ FEEDBACK REQUERIDO (Intento ${attempts}/2)\n\nEl Consejo de Validación ha rechazado la entrega. Corrige ÚNICAMENTE los siguientes puntos:\n\n`;

    for (const [dim, result] of Object.entries(scorecard)) {
      if (!result.pass) {
        feedbackContent += `### ❌ ${dim.toUpperCase()}\n`;
        for (const finding of result.findings) {
          feedbackContent += `- [ ] ${finding}\n`;
        }
        feedbackContent += '\n';
      }
    }

    feedbackContent += `> 💡 Builder: Aplica TDD estricto para resolver estos puntos y ejecuta 'af audit' nuevamente.\n`;
    writeFileSync(join(targetDir, 'FEEDBACK.md'), feedbackContent, 'utf8');
    console.log(`\n❌ Entrega rechazada. Archivo FEEDBACK.md generado para el Builder (Intento ${attempts}/2).`);
    return { approved: false, circuitBreaker: false };
  }

  // If all passed: Reset attempts and format 15-second executive dossier
  if (existsSync(attemptFile)) {
    writeFileSync(attemptFile, JSON.stringify({ count: 0 }), 'utf8');
  }

  console.log('\n' + '━'.repeat(60));
  console.log('🎯 APPROVER: 4/4 AUDITORÍAS EN VERDE (APROBADO)');
  console.log('━'.repeat(60));
  console.log('✅ 🛡️ Seguridad: Sin credenciales ni fugas detectadas.');
  console.log('✅ 🧭 UX: Manejo de errores y estados adecuado.');
  console.log('✅ 🎨 UI: Tokens de diseño respetados, cero estilos inline.');
  console.log('✅ ⚡ Código: Tests verdes, sin trampas (.skip), whitelist respetada.');
  console.log('━'.repeat(60));
  console.log('👉 Siguiente paso: Ejecuta \'af finish <id>\' para inspeccionar pantallas y desplegar.\n');

  return { approved: true, circuitBreaker: false };
}

if (process.argv[1]?.endsWith('approver.mjs')) {
  const dir = process.argv[2] || ROOT_DIR;
  evaluateApproval(dir);
}
