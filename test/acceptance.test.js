// Assignment #05 acceptance criteria – must stay true after every change.
// A05-AC1..AC4 are checked here; A05-AC5 is the command `npm test && npm run lint && npm run build`.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { checkAvailability } from '../src/availability.js';
import { createServer } from '../src/server.js';
import { createExplainAdapter } from '../src/explain/adapter.js';

const NOW = '2026-11-20T09:00';
const GOLDEN = [
  ['2026-11-23T11:00', '2026-11-23T12:00', true, 'AVAILABLE'],
  ['2026-11-23T10:00', '2026-11-23T11:00', false, 'OVERLAP'],
  ['2026-11-23T10:30', '2026-11-23T11:30', true, 'AVAILABLE'],
  ['2026-11-24T10:00', '2026-11-24T11:00', false, 'ROOM_BLOCKED'],
  ['2026-11-23T12:00', '2026-11-23T11:00', false, 'INVALID_TIME'],
  ['2026-11-19T10:00', '2026-11-19T11:00', false, 'PAST_TIME'],
  ['2026-11-23T07:00', '2026-11-23T08:30', false, 'OUTSIDE_OPENING_HOURS']
];

test('A05-AC1: booking decisions for the golden scenarios are unchanged', () => {
  for (const [start, end, isAvailable, reasonCode] of GOLDEN) {
    assert.deepEqual({ ...checkAvailability({ start, end }, { now: NOW }) }, { isAvailable, reasonCode }, `${start}–${end}`);
  }
});

const servers = [];
after(() => servers.forEach((s) => s.close()));
async function start(adapterOptions) {
  const server = createServer({ env: { SMART_CAMPUS_NOW: NOW }, adapter: createExplainAdapter(adapterOptions) });
  await new Promise((r) => server.listen(0, r));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
const post = async (url, body) => {
  const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });
  return { status: res.status, data: await res.json() };
};
const req = (s, e) => JSON.stringify({ roomId: 'A-101', start: s, end: e });

test('A05-AC2: /api/explain returns exactly the /api/availability status', async () => {
  const url = await start({ mode: 'mock' });
  for (const [s, e] of GOLDEN) {
    const a = await post(`${url}/api/availability`, req(s, e));
    const x = await post(`${url}/api/explain`, req(s, e));
    assert.deepEqual(x.data.status, a.data);
  }
});

test('A05-AC3: empty, malformed and overly long input is rejected with HTTP 400', async () => {
  const url = await start({ mode: 'mock' });
  for (const body of ['', '{', req('', ''), req('x'.repeat(200), '2026-11-23T11:00'), req('tomorrow', '2026-11-23T11:00')]) {
    assert.equal((await post(`${url}/api/explain`, body)).status, 400, body.slice(0, 40));
  }
});

test('A05-AC4: model timeout, error and missing key give the deterministic fallback with the same status', async () => {
  const failures = [
    { mode: 'mock', mockBehavior: 'timeout', timeoutMs: 500 },
    { mode: 'mock', mockBehavior: 'error' },
    { mode: 'live', apiKey: '' }
  ];
  for (const opts of failures) {
    const url = await start(opts);
    const x = await post(`${url}/api/explain`, req('2026-11-23T10:00', '2026-11-23T11:00'));
    assert.equal(x.status, 200);
    assert.equal(x.data.status.reasonCode, 'OVERLAP');
    assert.equal(x.data.explanation.source, 'fallback');
  }
});
