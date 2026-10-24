#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { evaluateApproval } from './approver.mjs';
import { cleanWorktree } from './worktree.mjs';

const ROOT_DIR = resolve('.');
const WORKTREES_DIR = join(ROOT_DIR, '.worktrees');

function runGit(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    throw new Error(`Git error: ${err.stderr?.trim() || err.message}`);
  }
}

function promptUser(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((res) => {
    rl.question(question, (answer) => {
      rl.close();
      res(answer.trim().toLowerCase());
    });
  });
}

export async function finishTask(taskSlug, autoConfirm = false) {
  const sanitizedId = taskSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = join(WORKTREES_DIR, sanitizedId);
  const branchName = `task/${sanitizedId}`;

  console.log(`\n🏁 Iniciando protocolo de cierre para tarea: ${sanitizedId}...`);

  // 1. Run final approver evaluation
  const { approved } = evaluateApproval(existsSync(targetDir) ? targetDir : ROOT_DIR, sanitizedId);
  if (!approved && !process.argv.includes('--force')) {
    console.error('❌ Cierre bloqueado: La entrega aún tiene auditorías en fallo. Corrige los puntos o usa --force.');
    process.exit(1);
  }

  // 2. Pre-Deploy Visual Gate: Check evidence
  console.log('\n' + '═'.repeat(60));
  console.log('🛑 PRE-DEPLOY VISUAL GATE (Aduana de Despliegue hacia GHCR)');
  console.log('═'.repeat(60));

  const evidenceDir = join(targetDir, 'evidence');
  let evidenceFiles = [];
  if (existsSync(evidenceDir)) {
    evidenceFiles = readdirSync(evidenceDir).filter(f => f.endsWith('.png') || f.endsWith('.webp') || f.endsWith('.jpg'));
  }

  if (evidenceFiles.length > 0) {
    console.log('📸 Pantallas generadas en las pruebas:');
    for (const f of evidenceFiles) {
      const fullPath = join(evidenceDir, f).replace(/\\/g, '/');
      console.log(`  🔗 file:///${fullPath}`);
    }
  } else {
    console.log('ℹ️ No se encontraron capturas PNG en .worktrees/' + sanitizedId + '/evidence/.');
    console.log('   Si es una tarea de backend puro, la verificación se basará en el Scorecard de tests.');
  }

  console.log('\n⚠️ ADVERTENCIA: Esta acción integrará a \'main\' y ejecutará \'git push\',');
  console.log('   lo cual activará GitHub Actions (docker-publish.yml) para compilar en GHCR.');

  if (!autoConfirm) {
    const answer = await promptUser('\n¿Autorizas el despliegue a la rama \'main\'? (s/N): ');
    if (answer !== 's' && answer !== 'si' && answer !== 'y' && answer !== 'yes') {
      console.log('🛑 Despliegue CANCELADO por el humano. El código permanece seguro en su worktree.');
      return;
    }
  }

  // 3. Merge to main and push
  console.log(`\n⏳ Integrando rama ${branchName} a 'main'...`);
  try {
    runGit('checkout main');
    runGit(`merge "${branchName}" --no-ff -m "feat(factory): completar tarea ${sanitizedId}"`);
    console.log('🚀 Ejecutando git push origin main hacia GHCR...');
    runGit('push origin main');
    console.log('✅ Push completado. GitHub Actions compilará las imágenes en GHCR.');
  } catch (err) {
    console.error(`❌ Error durante el merge/push a main: ${err.message}`);
    process.exit(1);
  }

  // 4. Cleanup worktree
  console.log(`🧹 Retirando worktree temporal...`);
  cleanWorktree(sanitizedId, true);

  console.log('\n' + '━'.repeat(60));
  console.log(`🎉 TAREA ${sanitizedId} FINALIZADA Y DESPLEGADA EXITOSAMENTE`);
  console.log('━'.repeat(60) + '\n');
}

if (process.argv[1]?.endsWith('finish.mjs')) {
  const slug = process.argv[2];
  const autoConfirm = process.argv.includes('--yes') || process.argv.includes('-y');
  if (!slug) {
    console.error('Uso: node finish.mjs <task-slug> [--yes]');
    process.exit(1);
  }
  finishTask(slug, autoConfirm);
}
