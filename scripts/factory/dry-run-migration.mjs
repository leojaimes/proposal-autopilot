#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Executes a PostgreSQL dry-run test for a migration SQL file inside a BEGIN ... ROLLBACK transaction.
 * Catches missing columns, table mismatches, syntax errors and constraint conflicts before any code reaches production.
 * 
 * @param {string} sqlFilePath 
 * @returns {{ valid: boolean, error?: string }}
 */
export function dryRunMigrationFile(sqlFilePath) {
  if (!existsSync(sqlFilePath)) {
    return { valid: false, error: `Archivo no encontrado: ${sqlFilePath}` };
  }

  const rawSql = readFileSync(sqlFilePath, 'utf8');

  // Wrap inside a strict transaction that is always rolled back
  const wrappedSql = `BEGIN;\nSET lock_timeout = '3s';\n${rawSql}\nROLLBACK;`;

  try {
    const res = execSync('docker exec -i proposal_autopilot_db psql -U postgres -d proposal_autopilot_db', {
      input: wrappedSql,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });

    if (res.includes('ERROR:')) {
      const errorLine = res.split('\n').find(l => l.includes('ERROR:')) || res;
      return { valid: false, error: errorLine.trim() };
    }

    return { valid: true };
  } catch (err) {
    const errMsg = err.stderr?.trim() || err.stdout?.trim() || err.message;
    return { valid: false, error: errMsg };
  }
}

if (process.argv[1]?.endsWith('dry-run-migration.mjs')) {
  const file = process.argv[2];
  if (!file) {
    console.error('Uso: node dry-run-migration.mjs <ruta-al-migration.sql>');
    process.exit(1);
  }
  const result = dryRunMigrationFile(resolve(file));
  if (result.valid) {
    console.log(`✅ Dry-Run Exitoso: ${file} es válido y seguro.`);
  } else {
    console.error(`❌ Dry-Run Falló en ${file}:\n${result.error}`);
    process.exit(1);
  }
}
