// Zero-dependency lint: syntax check + a few project rules.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOTS = ['src', 'public', 'test', 'scripts'];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (['.js', '.mjs'].includes(extname(p))) files.push(p);
  }
};
ROOTS.forEach(walk);

const problems = [];
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (e) {
    problems.push(`${file}: syntax error\n${e.stderr}`);
  }
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    const at = `${file}:${i + 1}`;
    if (/\s+$/.test(line)) problems.push(`${at} trailing whitespace`);
    if (line.length > 140) problems.push(`${at} line longer than 140 chars`);
    if (/\bvar\s/.test(line)) problems.push(`${at} use let/const instead of var`);
    if (/\beval\s*\(|new Function\s*\(/.test(line)) problems.push(`${at} eval/new Function is not allowed`);
    if (file.startsWith('public') && /\.innerHTML\s*=|insertAdjacentHTML/.test(line)) {
      problems.push(`${at} innerHTML is not allowed in UI code (XSS); use textContent`);
    }
    if (file.startsWith('src') && /console\.log/.test(line)) problems.push(`${at} console.log in src`);
  });
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\nlint: ${problems.length} problem(s) in ${files.length} files`);
  process.exit(1);
}
console.log(`lint: OK (${files.length} files checked, 0 problems)`);
