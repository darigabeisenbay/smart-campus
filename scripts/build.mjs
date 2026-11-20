// Zero-dependency build: copies src/ and public/ into dist/ and verifies every module loads.
import { rmSync, cpSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

rmSync('dist', { recursive: true, force: true });
cpSync('src', 'dist/src', { recursive: true });
cpSync('public', 'dist/public', { recursive: true });
cpSync('package.json', 'dist/package.json');

const modules = readdirSync('dist/src', { recursive: true }).filter((f) => String(f).endsWith('.js'));
for (const m of modules) execFileSync(process.execPath, ['--check', join('dist/src', String(m))], { stdio: 'pipe' });
execFileSync(process.execPath, ['-e', "import('./dist/src/server.js').then(m => { if (typeof m.createServer !== 'function') process.exit(1); })"]);

writeFileSync('dist/build-info.json', JSON.stringify({ builtAt: new Date().toISOString(), modules: modules.length }, null, 2));
console.log(`build: OK (dist/ created, ${modules.length} server modules verified)`);
