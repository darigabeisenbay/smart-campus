// R02: failures must leave a structured log line – without request content, explanations or keys.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';
import { createExplainAdapter } from '../src/explain/adapter.js';
import { createLogger } from '../src/log.js';

const env = { SMART_CAMPUS_NOW: '2026-11-20T09:00' };
const servers = [];
after(() => servers.forEach((s) => s.close()));

async function start(adapter, lines) {
  const logger = createLogger({ sink: (l) => lines.push(l), now: () => '2026-11-22T00:00:00.000Z' });
  const server = createServer({ env, adapter, logger });
  await new Promise((r) => server.listen(0, r));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
const body = JSON.stringify({ roomId: 'A-101', start: '2026-11-23T10:00', end: '2026-11-23T11:00' });
const post = (url) => fetch(`${url}/api/explain`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('R02: a model timeout produces exactly one explain.fallback line with reason and mode', async () => {
  const lines = [];
  const url = await start(createExplainAdapter({ mode: 'mock', mockBehavior: 'timeout', timeoutMs: 500 }), lines);
  const res = await post(url);
  assert.equal(res.status, 200);
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]),
    { ts: '2026-11-22T00:00:00.000Z', level: 'warn', event: 'explain.fallback', reason: 'TIMEOUT', mode: 'mock' });
});

test('R02: an unexpected error returns 500 and logs server.error without request content', async () => {
  const lines = [];
  const adapter = { mode: 'live', explain: async () => { throw new TypeError('boom sk-ant-SECRET-123 2026-11-23T10:00'); } };
  const url = await start(adapter, lines);
  const res = await post(url);
  assert.equal(res.status, 500);
  assert.equal(lines.length, 1);
  const entry = JSON.parse(lines[0]);
  assert.equal(entry.event, 'server.error');
  assert.equal(entry.route, '/api/explain');
  assert.equal(entry.error, 'TypeError');
  assert.doesNotMatch(lines[0], /SECRET|sk-ant|2026-11-23|A-101|boom/);
});

test('R02: a successful explanation logs nothing', async () => {
  const lines = [];
  const url = await start(createExplainAdapter({ mode: 'mock' }), lines);
  assert.equal((await post(url)).status, 200);
  assert.deepEqual(lines, []);
});

test('R02 review fix: LLM_MODE=off (configuration, not failure) logs nothing', async () => {
  const lines = [];
  const url = await start(createExplainAdapter({ mode: 'off' }), lines);
  assert.equal((await post(url)).status, 200);
  assert.deepEqual(lines, []);
});

test('R02: logger keeps only allowlisted fields and safe values', () => {
  const lines = [];
  const log = createLogger({ sink: (l) => lines.push(l), now: () => 't' });
  log.warn('explain.fallback', { reason: 'API_ERROR', mode: 'live', body: '{"start":"x"}', apiKey: 'sk-ant-1', text: 'hello' });
  log.error('server.error', { route: '/api/explain', error: 'Error: <script>' });
  assert.deepEqual(JSON.parse(lines[0]), { ts: 't', level: 'warn', event: 'explain.fallback', reason: 'API_ERROR', mode: 'live' });
  assert.equal(JSON.parse(lines[1]).error, 'Error_script_');
});
