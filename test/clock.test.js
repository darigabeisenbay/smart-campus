// R01: the campus clock must not depend on the server's time zone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { nowLocal } from '../src/time.js';
import { checkAvailability } from '../src/availability.js';
import { createServer } from '../src/server.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INSTANT = '2026-11-22T13:37:00Z'; // = 18:37 on campus (UTC+5)

// Evaluate nowLocal() in a child process with a given server TZ and a fixed instant.
function campusNowUnder(tz, env = {}) {
  const code = `import('./src/time.js').then(m => process.stdout.write(m.nowLocal(${JSON.stringify(env)}, new Date('${INSTANT}'))))`;
  return execFileSync(process.execPath, ['-e', code], { cwd: ROOT, env: { ...process.env, TZ: tz } }).toString();
}

test('R01: same instant gives the same campus time on servers in different time zones', () => {
  for (const tz of ['UTC', 'Asia/Qyzylorda', 'Pacific/Kiritimati', 'America/Los_Angeles']) {
    assert.equal(campusNowUnder(tz), '2026-11-22T18:37', `server TZ=${tz}`);
  }
});

test('R01: a slot earlier today on campus is PAST_TIME even on a UTC server', () => {
  const now = campusNowUnder('UTC');
  const r = checkAvailability({ start: '2026-11-22T15:00', end: '2026-11-22T15:30' }, { now });
  assert.equal(r.reasonCode, 'PAST_TIME');
});

test('R01: CAMPUS_TZ overrides the default; an invalid zone fails loudly', () => {
  assert.equal(nowLocal({ CAMPUS_TZ: 'UTC' }, new Date(INSTANT)), '2026-11-22T13:37');
  assert.throws(() => nowLocal({ CAMPUS_TZ: 'Mars/Base' }, new Date(INSTANT)), RangeError);
});

test('SMART_CAMPUS_NOW still pins the clock', () => {
  assert.equal(nowLocal({ SMART_CAMPUS_NOW: '2026-11-20T09:00' }), '2026-11-20T09:00');
});

test('R01 review fix: server refuses an invalid CAMPUS_TZ even when the clock is pinned; midnight prints 00', () => {
  assert.throws(() => createServer({ env: { SMART_CAMPUS_NOW: '2026-11-20T09:00', CAMPUS_TZ: 'Mars/Base' } }), RangeError);
  assert.equal(nowLocal({}, new Date('2026-11-22T19:00:00Z')), '2026-11-23T00:00');
});
