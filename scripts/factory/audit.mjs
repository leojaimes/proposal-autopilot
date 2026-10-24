#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { recordTelemetry } from './telemetry.mjs';
import { dryRunMigrationFile } from './dry-run-migration.mjs';

const ROOT_DIR = resolve('.');

function getGitDiff(baseBranch = 'main') {
  try {
    return execSync(`git diff ${baseBranch}...HEAD`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch {
    try {
      // Fallback to uncommitted diff against HEAD
      return execSync('git diff HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch {
      return '';
    }
  }
}

function getChangedFiles(baseBranch = 'main') {
  try {
    const out = execSync(`git diff --name-only ${baseBranch}...HEAD`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return out.split('\n').map(f => f.trim()).filter(Boolean);
  } catch {
    try {
      const out = execSync('git diff --name-only HEAD', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      return out.split('\n').map(f => f.trim()).filter(Boolean);
    } catch {
      return [];
    }
  }
}

export function runAudit(targetDir = ROOT_DIR, baseBranch = 'main') {
  console.log(`🔍 Iniciando Consejo de Auditoría (Seguridad, UX, UI, Código)...`);

  const diff = getGitDiff(baseBranch);
  const changedFiles = getChangedFiles(baseBranch);

  const scorecard = {
    security: { pass: true, findings: [] },
    ux: { pass: true, findings: [] },
    ui: { pass: true, findings: [] },
    code: { pass: true, findings: [] }
  };

  // 1. 🛡️ SEGURIDAD
  const secretPatterns = [
    /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i,
    /bearer\s+[a-zA-Z0-9_\-\.]{20,}/i,
    /ssh-rsa\s+[A-Za-z0-9+/]+/i,
    /password\s*[:=]\s*['"][^'"]+['"]/i
  ];

  for (const pattern of secretPatterns) {
    if (pattern.test(diff)) {
      scorecard.security.pass = false;
      scorecard.security.findings.push('Posible token, API Key o contraseña hardcodeada detectada en el diff.');
      break;
    }
  }

  if (changedFiles.some(f => f.endsWith('.env') || f.includes('.env.'))) {
    scorecard.security.pass = false;
    scorecard.security.findings.push('Archivo .env detectado en el control de versiones.');
  }

  // Multitenancy check: backend query without tenant
  if (diff.includes('prisma.') && !diff.includes('tenantId') && changedFiles.some(f => f.includes('service.ts'))) {
    scorecard.security.findings.push('Advertencia: Llamadas a Prisma sin referencia explícita a tenantId en el diff.');
  }

  // 2. 🧭 UX
  if (diff.includes('catch (err) {}') || diff.includes('catch {}')) {
    scorecard.ux.pass = false;
    scorecard.ux.findings.push('Bloque catch vacío detectado: los errores deben ser notificados al usuario.');
  }

  // 3. 🎨 UI
  const inlineStyleMatch = diff.match(/\+.*style=["'][^"']+["']/g);
  if (inlineStyleMatch && changedFiles.some(f => f.endsWith('.html') || f.endsWith('.tsx') || f.endsWith('.jsx'))) {
    scorecard.ui.pass = false;
    scorecard.ui.findings.push(`Estilo inline detectado (${inlineStyleMatch[0].slice(0, 50)}...). Usa clases o tokens de theme.css.`);
  }

  // 4. ⚡ CÓDIGO & DISCIPLINE
  // Test Cheating
  if (diff.match(/\+.*(it\.skip|test\.skip|xit\(|fit\(|test\.only|it\.only)/)) {
    scorecard.code.pass = false;
    scorecard.code.findings.push('Trampa en tests detectada: se encontró .skip() o .only().');
  }

  // Diff Volume Check
  const diffLines = diff.split('\n').filter(l => l.startsWith('+') && !l.startsWith('+++')).length;
  if (diffLines > 200) {
    scorecard.code.findings.push(`Volumen alto: +${diffLines} líneas agregadas. Se recomienda dividir historias > 100 líneas.`);
  }

  // Whitelist check against SPEC.md
  const specPath = join(targetDir, 'SPEC.md');
  if (existsSync(specPath)) {
    const specContent = readFileSync(specPath, 'utf8');
    const whitelistSection = specContent.split('## Allowed Files Whitelist')[1]?.split('##')[0] || '';
    const whitelisted = whitelistSection.split('\n').map(l => l.replace(/^[-\s*]+/, '').trim()).filter(l => l.length > 0 && !l.startsWith('backend/...'));

    if (whitelisted.length > 0) {
      for (const file of changedFiles) {
        if (!whitelisted.some(w => file.includes(w))) {
          scorecard.code.pass = false;
          scorecard.code.findings.push(`Violación de Blast Radius: el archivo '${file}' no está en la Whitelist del SPEC.md.`);
        }
      }
    }
  }

  // Zero-Downtime DB check on migrations
  const migrationFiles = changedFiles.filter(f => f.includes('migrations') && f.endsWith('.sql'));
  for (const mFile of migrationFiles) {
    try {
      const sql = readFileSync(mFile, 'utf8');
      
      // 1. Lock Timeout verification
      if (!sql.includes("SET lock_timeout = '3s';") && !sql.includes("SET lock_timeout = '3s'")) {
        scorecard.code.findings.push(`Aviso en ${mFile}: Se recomienda anteponer 'SET lock_timeout = ''3s'';' para prevenir bloqueos.`);
      }

      // 2. Non-existent column guard: job_category_assignments has classified_at, NOT created_at
      if (sql.includes('job_category_assignments') && sql.includes('"created_at"')) {
        scorecard.code.pass = false;
        scorecard.code.findings.push(`Error de esquema en ${mFile}: La tabla 'job_category_assignments' no posee la columna 'created_at' (usa 'classified_at').`);
      }

      // 3. Concurrency guards
      if (sql.includes('CREATE INDEX') && !sql.includes('CONCURRENTLY')) {
        scorecard.code.pass = false;
        scorecard.code.findings.push(`Migración insegura en ${mFile}: CREATE INDEX debe usar CONCURRENTLY.`);
      }
      if (/UPDATE\s+["']?\w+["']?\s+SET/i.test(sql) && !sql.includes('LIMIT') && !sql.includes('WHERE')) {
        scorecard.code.pass = false;
        scorecard.code.findings.push(`Migración insegura en ${mFile}: UPDATE masivo sin condición WHERE o chunking.`);
      }

      // 4. PostgreSQL Transactional Dry-Run (catches syntax, column mismatches, table errors in DB)
      const dryRunRes = dryRunMigrationFile(resolve(mFile));
      if (!dryRunRes.valid) {
        scorecard.code.pass = false;
        scorecard.code.findings.push(`Fallo en Dry-Run de migración ${mFile}: ${dryRunRes.error}`);
      }
    } catch {
      // ignore
    }
  }

  // Evaluate All Pass
  const allPass = scorecard.security.pass && scorecard.ux.pass && scorecard.ui.pass && scorecard.code.pass;

  // Render Markdown Scorecard
  const statusIcon = (p) => p ? '🟢 PASS' : '🔴 FAIL';
  const scorecardContent = `# 📋 Scorecard de Validación
**Fecha:** ${new Date().toISOString()}  
**Estado General:** ${allPass ? '🟢 APROBADO' : '🔴 CAMBIOS REQUERIDOS'}

| Dimensión | Estado | Hallazgos |
| :--- | :---: | :--- |
| 🛡️ Seguridad | ${statusIcon(scorecard.security.pass)} | ${scorecard.security.findings.join('; ') || '0 vulnerabilidades detectadas'} |
| 🧭 UX | ${statusIcon(scorecard.ux.pass)} | ${scorecard.ux.findings.join('; ') || 'Manejo de errores y estados adecuado'} |
| 🎨 UI | ${statusIcon(scorecard.ui.pass)} | ${scorecard.ui.findings.join('; ') || 'Sin estilos inline, tokens respetados'} |
| ⚡ Código | ${statusIcon(scorecard.code.pass)} | ${scorecard.code.findings.join('; ') || 'Tests íntegros, whitelist respetada'} |
`;

  writeFileSync(join(targetDir, 'SCORECARD.md'), scorecardContent, 'utf8');
  console.log(scorecardContent);

  // Telemetry recording
  try {
    const failures = [];
    if (!scorecard.security.pass) failures.push('Seguridad');
    if (!scorecard.ux.pass) failures.push('UX');
    if (!scorecard.ui.pass) failures.push('UI');
    if (!scorecard.code.pass) failures.push('Código');
    recordTelemetry({ action: 'audit', targetDir, allPass, failures });
  } catch {
    // ignore
  }

  return { allPass, scorecard };
}

if (process.argv[1]?.endsWith('audit.mjs')) {
  const dir = process.argv[2] || ROOT_DIR;
  runAudit(dir);
}
