import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

console.log('🚀 Building Studio Workbench Web Component...');
execSync('npx ng run frontend:element', { stdio: 'inherit' });

const distBrowser = path.resolve('dist/element/browser');
const outDir = path.resolve('dist/studio-workbench');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const polyfills = fs.readFileSync(path.join(distBrowser, 'polyfills.js'), 'utf8');
const styles = fs.readFileSync(path.join(distBrowser, 'styles.css'), 'utf8');
const main = fs.readFileSync(path.join(distBrowser, 'main.js'), 'utf8');

const injectedStyles = `
(function() {
  if (typeof document !== 'undefined' && !document.getElementById('studio-workbench-styles')) {
    var style = document.createElement('style');
    style.id = 'studio-workbench-styles';
    style.textContent = ${JSON.stringify(styles)};
    document.head.appendChild(style);
  }
})();
`;

const standaloneBundle = [
  '/* Universal Studio Workbench - Autonomous Web Component */',
  polyfills,
  injectedStyles,
  main,
].join('\n\n');

const targetWorkbenchPath = path.join(outDir, 'workbench.js');
fs.writeFileSync(targetWorkbenchPath, standaloneBundle, 'utf8');
console.log(`✅ Generated standalone bundle: ${targetWorkbenchPath} (${(standaloneBundle.length / 1024).toFixed(1)} KB)`);

// Distribute to publications backend and frontend public directories
const backendTarget = path.resolve('../../publications/packages/backend/public/studio');
const frontendTarget = path.resolve('../../publications/packages/frontend/public/studio');

for (const dir of [backendTarget, frontendTarget]) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.copyFileSync(targetWorkbenchPath, path.join(dir, 'workbench.js'));
    console.log(`📦 Copied workbench.js to ${dir}`);
  } catch (err) {
    console.warn(`Could not copy to ${dir}:`, err);
  }
}

