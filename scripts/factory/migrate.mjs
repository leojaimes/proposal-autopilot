#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const BACKEND_DIR = resolve(ROOT_DIR, 'backend');

/**
 * Ensures database URL connects through local host port (5438) if host is unreachable.
 */
function getSafeDbEnv() {
  const env = { ...process.env };
  if (!env.DATABASE_URL || env.DATABASE_URL.includes('postgres:5432')) {
    env.DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public';
  }
  return env;
}

export function runMigration(action = 'deploy') {
  console.log(`\n🗄️ AI FACTORY MIGRATION ENGINE: ${action.toUpperCase()}`);
  console.log('═'.repeat(60));

  const env = getSafeDbEnv();

  try {
    if (action === 'status') {
      console.log('🔍 Consultando estado de migraciones en la base de datos...');
      const out = execSync('npx prisma migrate status', {
        cwd: BACKEND_DIR,
        env,
        encoding: 'utf8'
      });
      console.log(out.trim());
      return { success: true };
    }

    if (action === 'generate') {
      console.log('⚙️ Generando cliente Prisma...');
      execSync('npx prisma generate', {
        cwd: BACKEND_DIR,
        env,
        encoding: 'utf8'
      });
      console.log('✅ Cliente Prisma generado.');
      return { success: true };
    }

    // Default: deploy
    console.log('🚀 Aplicando migraciones pendientes (npx prisma migrate deploy)...');
    const out = execSync('npx prisma migrate deploy', {
      cwd: BACKEND_DIR,
      env,
      encoding: 'utf8'
    });
    console.log(out.trim());

    console.log('\n⚙️ Sincronizando cliente Prisma...');
    execSync('npx prisma generate', {
      cwd: BACKEND_DIR,
      env,
      encoding: 'utf8'
    });
    console.log('✅ Base de datos sincronizada y cliente Prisma actualizado.');
    return { success: true };
  } catch (err) {
    console.error(`❌ Error al ejecutar migración: ${err.stderr?.trim() || err.message}`);
    return { success: false, error: err.message };
  }
}

if (process.argv[1]?.endsWith('migrate.mjs')) {
  const action = process.argv[2] || 'deploy';
  runMigration(action);
}
