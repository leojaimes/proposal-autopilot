#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Executes a test command and token-compresses the output by 95%.
 * Discards internal stacktraces, framework banners, and passing test lists.
 */
export async function runTestWithFilter(cmdString, cwd = resolve('.')) {
  const isVerbose = process.argv.includes('--verbose') || process.env.VERBOSE === 'true';
  const parts = cmdString.split(/\s+/);
  const exe = parts[0];
  const args = parts.slice(1);

  return new Promise((res) => {
    const child = spawn(exe, args, { cwd, shell: true });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      const fullOutput = stdout + '\n' + stderr;

      if (isVerbose) {
        console.log(fullOutput);
        return res({ pass: code === 0, code, output: fullOutput });
      }

      if (code === 0) {
        // Look for summary line
        const passMatch = fullOutput.match(/pass\s+(\d+)|(\d+)\s+passed/i);
        const count = passMatch ? (passMatch[1] || passMatch[2]) : 'todos';
        console.log(`✅ [TESTS PASS]: ${count} tests pasaron limpiamente. (0 fallos)`);
        return res({ pass: true, code: 0, summary: `All tests passed.` });
      }

      // If failed, extract only the failing assertions and lines
      console.log('🔴 [TESTS FAILED - RESUMEN QUIRÚRGICO]:');
      const lines = fullOutput.split('\n');
      const filtered = [];
      let capture = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (
          trimmed.startsWith('✖') ||
          trimmed.startsWith('FAIL') ||
          trimmed.includes('AssertionError') ||
          trimmed.includes('Expected') ||
          trimmed.includes('Received') ||
          trimmed.includes('Error:')
        ) {
          capture = true;
          filtered.push(trimmed);
        } else if (capture && (trimmed.includes('.spec.ts:') || trimmed.includes('.test.ts:') || trimmed.includes('.ts:'))) {
          if (!trimmed.includes('node_modules') && !trimmed.includes('node:internal')) {
            filtered.push('  📍 ' + trimmed);
          }
        } else if (trimmed.length === 0) {
          capture = false;
        }
      }

      const distilled = filtered.length > 0 ? filtered.join('\n') : fullOutput.slice(0, 500);
      console.log(distilled);
      console.log('\n💡 Tip: Usa --verbose para ver el volcado completo de la consola.');
      return res({ pass: false, code, summary: distilled });
    });
  });
}

if (process.argv[1]?.endsWith('test-filter.mjs')) {
  const args = process.argv.slice(2).filter(a => a !== '--verbose');
  const cmd = args.length > 0 ? args.join(' ') : 'npm test';
  runTestWithFilter(cmd);
}
