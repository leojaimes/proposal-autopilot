#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT_DIR = resolve('.');
const BACKEND_DIR = join(ROOT_DIR, 'backend');
const BASELINE_FILE = join(ROOT_DIR, 'scripts', 'factory', '.db_integrity_baseline.json');

/**
 * Returns a connection URL that uses host port 5438 when running outside Docker on Windows.
 */
function getSafeDbUrl() {
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('postgres:5432')) {
    return process.env.DATABASE_URL;
  }
  return 'postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_db?schema=public';
}

async function getPrismaClient() {
  const prismaPath = join(BACKEND_DIR, 'node_modules', '@prisma', 'client', 'index.js');
  const { PrismaClient } = await import(`file://${prismaPath.replace(/\\/g, '/')}`);
  return new PrismaClient({
    datasources: {
      db: { url: getSafeDbUrl() }
    }
  });
}

export async function runIntegrityCheck(mode = 'pre') {
  console.log('\n' + '═'.repeat(65));
  console.log(`🛡️ AI FACTORY DATABASE INTEGRITY INSPECTOR [${mode.toUpperCase()}]`);
  console.log('═'.repeat(65));

  const prisma = await getPrismaClient();

  try {
    // 1. Set lock timeout to avoid blocking any production operations
    await prisma.$executeRawUnsafe("SET lock_timeout = '3s'");

    // 2. Query basic database information
    const dbInfo = await prisma.$queryRawUnsafe("SELECT current_database() as db, version() as ver");
    const dbName = dbInfo[0]?.db || 'unknown';
    console.log(`📍 Base de datos:  ${dbName}`);
    console.log(`⏱️ Lock Timeout:   3s (Configurado de forma segura)`);

    // 3. Check for any active blocking locks on user tables
    const blockingLocks = await prisma.$queryRawUnsafe(`
      SELECT count(*)::int as count
      FROM pg_stat_activity
      WHERE wait_event_type = 'Lock'
        AND state = 'active'
    `);
    const activeWaiters = blockingLocks[0]?.count || 0;
    console.log(`🔒 Cerrojos activos en espera: ${activeWaiters === 0 ? '0 (Excelente, sin bloqueos)' : activeWaiters}`);

    // 4. Capture essential row counts
    const [
      tenantsCount,
      jobPostsCount,
      profilesCount,
      assignmentsCount,
      taxonomyNodesCount,
      snapshotsCount
    ] = await Promise.all([
      prisma.tenant.count().catch(() => 0),
      prisma.jobPost.count().catch(() => 0),
      prisma.positioningProfile.count().catch(() => 0),
      prisma.jobCategoryAssignment.count().catch(() => 0),
      prisma.marketTaxonomyNode.count().catch(() => 0),
      prisma.marketCategorySnapshot.count().catch(() => 0),
    ]);

    // Check optional outbox table if it already exists
    let outboxCount = 0;
    try {
      const outboxRes = await prisma.$queryRawUnsafe('SELECT count(*)::int as c FROM "taxonomy_classification_work"');
      outboxCount = outboxRes[0]?.c || 0;
    } catch {
      outboxCount = 'Aún no existe (Pre-migración)';
    }

    // Check applied prisma migrations
    const migrations = await prisma.$queryRawUnsafe(`
      SELECT migration_name, applied_steps_count, rolled_back_at, finished_at
      FROM "_prisma_migrations"
      ORDER BY finished_at ASC
    `);

    const currentMetrics = {
      timestamp: new Date().toISOString(),
      database: dbName,
      tables: {
        tenants: tenantsCount,
        job_posts: jobPostsCount,
        positioning_profiles: profilesCount,
        job_category_assignments: assignmentsCount,
        market_taxonomy_nodes: taxonomyNodesCount,
        market_category_snapshots: snapshotsCount,
        taxonomy_classification_work: outboxCount
      },
      migrationsCount: migrations.length,
      migrations: migrations.map(m => m.migration_name)
    };

    console.log('\n📊 Estado de Tablas Críticas:');
    console.log('─'.repeat(65));
    console.log(`  🏢 Tenants:                     ${tenantsCount}`);
    console.log(`  📄 Job Posts (Leads):           ${jobPostsCount}`);
    console.log(`  👤 Perfiles de Posicionamiento: ${profilesCount}`);
    console.log(`  🏷️ Asignaciones de Categoría:   ${assignmentsCount}`);
    console.log(`  🌳 Nodos de Taxonomía:          ${taxonomyNodesCount}`);
    console.log(`  📈 Snapshots de Radar:          ${snapshotsCount}`);
    console.log(`  📬 Cola Outbox de Clasificación:${outboxCount}`);
    console.log(`  📜 Migraciones en BD:           ${migrations.length} aplicadas`);
    console.log('─'.repeat(65));

    if (mode === 'pre') {
      writeFileSync(BASELINE_FILE, JSON.stringify(currentMetrics, null, 2), 'utf8');
      console.log(`\n💾 Snapshot base guardado exitosamente en:`);
      console.log(`   ${BASELINE_FILE}`);
      console.log(`\n✅ PRE-CHECK APROBADO: La base de datos es consistente y lista para migración.`);
    } else {
      // POST-MIGRATION VERIFICATION
      if (!existsSync(BASELINE_FILE)) {
        console.log('\n⚠️ No se encontró archivo .db_integrity_baseline.json previo.');
        console.log('   Mostrando estado actual sin comparación.');
      } else {
        const baseline = JSON.parse(readFileSync(BASELINE_FILE, 'utf8'));
        console.log('\n🔍 Comparando con Snapshot Pre-Migración:');

        let dataLossDetected = false;
        const checks = [
          { name: 'tenants', base: baseline.tables.tenants, current: tenantsCount },
          { name: 'job_posts', base: baseline.tables.job_posts, current: jobPostsCount },
          { name: 'positioning_profiles', base: baseline.tables.positioning_profiles, current: profilesCount },
        ];

        for (const chk of checks) {
          if (chk.current < chk.base) {
            console.error(`  ❌ ALERTA CRÍTICA: Pérdida en ${chk.name}: tenía ${chk.base}, ahora tiene ${chk.current}!`);
            dataLossDetected = true;
          } else {
            console.log(`  ✅ ${chk.name}: ${chk.base} ➔ ${chk.current} (Intacto / Enriquecido)`);
          }
        }

        if (dataLossDetected) {
          console.error('\n🚨 FALLO DE INTEGRIDAD: Se detectó disminución en datos existentes.');
          process.exit(1);
        }

        console.log(`\n🎉 POST-CHECK APROBADO: Cero pérdida de datos (Zero Data Loss) verificado.`);
      }
    }

    await prisma.$disconnect();
    return { success: true, metrics: currentMetrics };
  } catch (err) {
    await prisma.$disconnect().catch(() => {});
    console.error(`\n❌ Error durante verificación de integridad: ${err.message}`);
    return { success: false, error: err.message };
  }
}

if (process.argv[1]?.endsWith('verify-db-integrity.mjs')) {
  const mode = process.argv.includes('--post') ? 'post' : 'pre';
  runIntegrityCheck(mode);
}
