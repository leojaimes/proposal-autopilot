#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT_DIR = resolve('.');
const DOCS_DIR = join(ROOT_DIR, '02-DOCS');
const LEGACY_DOCS_DIR = join(ROOT_DIR, 'docs');

/**
 * Searches documentation directories for sections relevant to a query.
 * Extracts compact snippets instead of dumping whole files to conserve LLM tokens.
 */
export function queryBrain(query) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const results = [];
  const searchDirs = [DOCS_DIR, LEGACY_DOCS_DIR].filter(d => existsSync(d));

  function scanDir(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        scanDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.md') || entry.name.endsWith('.prisma'))) {
        try {
          const content = readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');
          const matchedLines = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lower = line.toLowerCase();
            if (terms.some(term => lower.includes(term))) {
              const start = Math.max(0, i - 1);
              const end = Math.min(lines.length - 1, i + 2);
              matchedLines.push(lines.slice(start, end + 1).join('\n'));
              i = end; // jump ahead to avoid overlapping duplicates
            }
          }

          if (matchedLines.length > 0) {
            results.push({
              file: fullPath.replace(ROOT_DIR, '').replace(/^[\\/]/, ''),
              snippets: matchedLines.slice(0, 3) // max 3 snippets per file
            });
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  for (const dir of searchDirs) {
    scanDir(dir);
  }

  return results;
}

/**
 * Generates an ultra-compact context summary for SPEC.md
 */
export function generateSpecContext(query) {
  const matches = queryBrain(query);
  if (matches.length === 0) {
    return `<!-- No direct historical matches found in 02-DOCS for "${query}". Follow AGENTS.md standards. -->\n`;
  }

  let output = `<!-- BRAIN HYDRATION CONTEXT (Extracted from 02-DOCS) -->\n`;
  for (const match of matches.slice(0, 4)) {
    output += `### Ref: ${match.file}\n`;
    for (const snip of match.snippets) {
      output += '```markdown\n' + snip.trim() + '\n```\n';
    }
  }
  return output;
}

if (process.argv[1]?.endsWith('brain.mjs') && process.argv[2] === 'query') {
  const q = process.argv.slice(3).join(' ');
  if (!q) {
    console.error('Uso: node brain.mjs query <terminos>');
    process.exit(1);
  }
  console.log(generateSpecContext(q));
}
