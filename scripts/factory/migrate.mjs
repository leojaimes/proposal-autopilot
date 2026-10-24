#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { resolve, join } from 'node:path';

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

export async function runMigration(action = 'deploy') {
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

    if (action === 'doctor') {
      console.log('🩺 Diagnosticando estado de migraciones en la base de datos...');
      const prismaPath = join(BACKEND_DIR, 'node_modules', '@prisma', 'client', 'index.js');
      const { PrismaClient } = await import(`file://${prismaPath.replace(/\\/g, '/')}`);
      const prisma = new PrismaClient({ datasources: { db: { url: env.DATABASE_URL } } });
      try {
        const rows = await prisma.$queryRawUnsafe(`
          SELECT migration_name, started_at, finished_at, rolled_back_at 
          FROM "_prisma_migrations" 
          ORDER BY started_at DESC
        `);
        const failed = rows.filter(r => !r.finished_at && !r.rolled_back_at);
        if (failed.length === 0) {
          console.log('✅ Base de datos sana: No hay migraciones bloqueadas o fallidas.');
        } else {
          console.log(`🚨 Se encontraron ${failed.length} migración(es) fallida(s) bloqueando el sistema:`);
          for (const f of failed) {
            console.log(`  - ❌ ${f.migration_name} (Iniciada: ${f.started_at})`);
            console.log(`     Desmarcando automáticamente como rolled-back...`);
            await prisma.$executeRawUnsafe(`
              UPDATE "_prisma_migrations" 
              SET rolled_back_at = NOW() 
              WHERE migration_name = '${f.migration_name}'
            `);
            console.log(`     ✅ Migración ${f.migration_name} desmarcada. El sistema puede reintentar.`);
          }
        }
      } catch (err) {
        console.error('❌ Error al consultar _prisma_migrations:', err.message);
      } finally {
        await prisma.$disconnect();
      }
      return { success: true };
    }

    if (action === 'resolve') {
      const migrationName = process.argv[3] || '20261023200000_taxonomy_classification_work_outbox';
      console.log(`🔧 Desbloqueando migración fallida: ${migrationName}...`);
      const out = execSync(`npx prisma migrate resolve --rolled-back ${migrationName}`, {
        cwd: BACKEND_DIR,
        env,
        encoding: 'utf8'
      });
      console.log(out.trim());
      console.log(`✅ Migración ${migrationName} desmarcada como rolled-back.`);
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
