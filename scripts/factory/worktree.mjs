#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateSpecContext } from './brain.mjs';

const ROOT_DIR = resolve('.');
const WORKTREES_DIR = join(ROOT_DIR, '.worktrees');

function runGit(cmd, cwd = ROOT_DIR) {
  try {
    return execSync(`git ${cmd}`, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch (err) {
    throw new Error(`Git error: ${err.stderr?.trim() || err.message}`);
  }
}

function ensureGitIgnore() {
  const gitignorePath = join(ROOT_DIR, '.gitignore');
  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf8');
    if (!content.includes('.worktrees')) {
      writeFileSync(gitignorePath, content + '\n.worktrees/\n', 'utf8');
    }
  }
}

function createJunctionSafe(target, path) {
  try {
    if (existsSync(target) && !existsSync(path)) {
      symlinkSync(target, path, 'junction');
    }
  } catch {
    // Windows permissions or already exists; continue safely
  }
}

export function startWorktree(taskSlug, taskTitle = '') {
  const sanitizedId = taskSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  const targetDir = join(WORKTREES_DIR, sanitizedId);
  const branchName = `task/${sanitizedId}`;

  ensureGitIgnore();

  if (existsSync(targetDir)) {
    console.log(`ℹ️ El worktree .worktrees/${sanitizedId} ya existe.`);
    return { dir: targetDir, branch: branchName };
  }

  if (!existsSync(WORKTREES_DIR)) {
    mkdirSync(WORKTREES_DIR, { recursive: true });
  }

  console.log(`⏳ Creando worktree en .worktrees/${sanitizedId} (rama: ${branchName})...`);

  // Check if branch already exists
  const existingBranches = runGit('branch --list ' + branchName);
  if (existingBranches.includes(branchName)) {
    runGit(`worktree add "${targetDir}" "${branchName}"`);
  } else {
    runGit(`worktree add "${targetDir}" -b "${branchName}"`);
  }

  // Windows Junctions for node_modules to avoid re-installing
  const backendModules = join(ROOT_DIR, 'backend', 'node_modules');
  const targetBackendModules = join(targetDir, 'backend', 'node_modules');
  createJunctionSafe(backendModules, targetBackendModules);

  const frontendModules = join(ROOT_DIR, 'frontend', 'node_modules');
  const targetFrontendModules = join(targetDir, 'frontend', 'node_modules');
  createJunctionSafe(frontendModules, targetFrontendModules);

  // Link test env file with dedicated tenant
  const envTestSrc = join(ROOT_DIR, 'backend', '.env');
  const envTestDst = join(targetDir, 'backend', '.env');
  if (existsSync(envTestSrc) && !existsSync(envTestDst)) {
    try {
      const baseEnv = readFileSync(envTestSrc, 'utf8');
      const testTenant = `tenant-test-${sanitizedId}-${Date.now()}`;
      const customizedEnv = `${baseEnv}\nTEST_TENANT_ID=${testTenant}\nDATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5438/proposal_autopilot_test\n`;
      writeFileSync(envTestDst, customizedEnv, 'utf8');
    } catch {
      // ignore env copy failure
    }
  }

  // Hydrate SPEC.md with Brain Context
  const specPath = join(targetDir, 'SPEC.md');
  const brainContext = generateSpecContext(taskTitle || sanitizedId);

  const specTemplate = `# SPEC: ${taskTitle || sanitizedId}
${brainContext}
## Story
As a <actor>, I want <action>, so that <benefit>.

## Acceptance criteria
- [ ] Given <context>, when <action>, then <result>.
- [ ] Given <context>, when <action>, then <result>.
- [ ] [Visual Verification] Given <context>, when viewed in UI, then <expected visual appearance>.

## Allowed Files Whitelist (Max 3 files)
- backend/...
- frontend/...

## Test Plan (TDD)
- test: <name_of_test_1>
- test: <name_of_test_2>

## Out of scope
- Anything not explicitly required by the acceptance criteria.
`;

  writeFileSync(specPath, specTemplate, 'utf8');

  console.log(`✅ Worktree listo en .worktrees/${sanitizedId}`);
  console.log(`📄 Contrato generado en .worktrees/${sanitizedId}/SPEC.md`);
  return { dir: targetDir, branch: branchName };
}

export function cleanWorktree(taskSlug, force = false) {
  const sanitizedId = taskSlug.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = join(WORKTREES_DIR, sanitizedId);
  const branchName = `task/${sanitizedId}`;

  if (!existsSync(targetDir)) {
    console.log(`ℹ️ El worktree .worktrees/${sanitizedId} no existe.`);
    return;
  }

  console.log(`⏳ Eliminando worktree .worktrees/${sanitizedId}...`);

  try {
    runGit(`worktree remove --force "${targetDir}"`);
  } catch (err) {
    console.warn(`⚠️ Git worktree remove falló: ${err.message}. Intentando limpieza manual...`);
    try {
      rmSync(targetDir, { recursive: true, force: true });
      runGit(`worktree prune`);
    } catch (e) {
      console.error(`❌ No se pudo eliminar .worktrees/${sanitizedId}: ${e.message}`);
      return;
    }
  }

  if (force) {
    try {
      runGit(`branch -D "${branchName}"`);
      console.log(`🗑️ Rama local ${branchName} eliminada.`);
    } catch {
      // branch might already be deleted
    }
  }

  console.log(`✅ Worktree .worktrees/${sanitizedId} limpiado exitosamente.`);
}

export function listWorktrees() {
  const output = runGit('worktree list');
  console.log('📋 Worktrees activos:\n' + output);
}

if (process.argv[1]?.endsWith('worktree.mjs')) {
  const cmd = process.argv[2];
  const slug = process.argv[3];
  const title = process.argv.slice(4).join(' ');

  if (cmd === 'start' && slug) {
    startWorktree(slug, title);
  } else if ((cmd === 'clean' || cmd === 'abort') && slug) {
    cleanWorktree(slug, true);
  } else if (cmd === 'list') {
    listWorktrees();
  } else {
    console.log('Uso: node worktree.mjs <start|clean|list> [slug] [titulo]');
  }
}
