// Regression tests for the Task #06 review findings (agent R1–R8, manual M1–M6).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { validateExplanation, countSentences } from '../src/explain/validateExplanation.js';
import { createExplainAdapter, parseModelJson, clampTimeout, withTimeout, TIMEOUT_BOUNDS, MAX_IN_FLIGHT } from '../src/explain/adapter.js';
import { createServer, createRateLimiter } from '../src/server.js';
import { fallbackExplanation } from '../src/explain/fallback.js';
import { ROOM } from '../src/data.js';

const base = { room: ROOM.label, start: '2026-11-23T10:00', end: '2026-11-23T11:00' };
const ov = { ...base, isAvailable: false, reasonCode: 'OVERLAP' };
const av = { ...base, start: '2026-11-23T11:00', end: '2026-11-23T12:00', isAvailable: true, reasonCode: 'AVAILABLE' };
const reasonOf = (t, f) => validateExplanation(t, f).reason;

test('R1: paraphrased contradictions of "not available" are rejected', () => {
  for (const t of [
    'This time overlaps an existing booking, but the room is actually available to you.',
    'This time overlaps an existing booking, so go ahead and use the room anyway.',
    'This time overlaps an existing booking, yet Room A-101 is open for you then.',
    'This time overlaps an existing booking, but feel free to come in.',
    'This time overlaps an existing booking; the slot is yours anyway.',
    'This time overlaps an existing booking, but you can still use it.',
    'There is an overlap with an existing booking, but it is possible to join.',
    'This time overlaps an existing booking, although the room remains free.'
  ]) assert.equal(reasonOf(t, ov), 'CONTRADICTS_STATUS', t);
});

test('R1: "available" result must not be described as unavailable', () => {
  for (const t of [
    'The room is free from 11:00 to 12:00 but it is already booked.',
    'Room A-101 is available, although it is occupied then.',
    'The room is free, but this time is in the past.'
  ]) assert.equal(reasonOf(t, av), 'CONTRADICTS_STATUS', t);
});

test('R2: claims of booking actions are rejected', () => {
  for (const [t, f] of [
    ['There is an overlap with an existing booking. Your booking is now confirmed anyway.', ov],
    ["There is an overlap with an existing booking, so I've cancelled the other one for you.", ov],
    ["The room is free from 11:00 to 12:00 and I'll reserve it.", av],
    ['The room is free from 11:00 to 12:00. The reservation is now in place.', av],
    ['The room is free, and we have booked it for you.', av]
  ]) assert.equal(reasonOf(t, f), 'CLAIMS_BOOKING_ACTION', t);
});

test('R3: holder names, other names and causes are rejected (room label still allowed)', () => {
  for (const t of [
    'This time overlaps an existing booking held by Study Group 7.',
    'This time overlaps an existing booking made by Dr. Smith.',
    'This time overlaps an existing booking by the chess team.',
    'This time overlaps an existing booking because of a workshop.'
  ]) assert.equal(reasonOf(t, ov), 'INVENTED_DETAIL', t);
  assert.equal(validateExplanation('Room A-101 (Group Study Room) is free from 11:00 to 12:00.', av).ok, true);
  assert.equal(validateExplanation('The Group Study Room is free from 11:00 to 12:00.', av).ok, true);
});

test('R4: invisible characters cannot hide forbidden words', () => {
  assert.equal(reasonOf('The room is av​ailable: the overlap was ignored.', ov), 'FORBIDDEN_FORMAT');
  assert.equal(reasonOf('The room is availa­ble despite the overlap.', ov), 'FORBIDDEN_FORMAT');
  assert.equal(reasonOf('Not available ‮elbaliava‬ because of an overlap.', ov), 'FORBIDDEN_FORMAT');
});

test('R5: correct natural phrasings are accepted; abbreviations are not sentence ends', () => {
  assert.equal(validateExplanation('Good news: Room A-101 is free from 11:00 to 12:00, and no booking overlaps it.', av).ok, true);
  assert.equal(validateExplanation('Good news: Room A-101 is free, since it is not blocked and has no conflicting booking.', av).ok, true);
  assert.equal(countSentences('e.g. this works.'), 1);
  assert.equal(countSentences('A is free, e.g. now. B.'), 2);
});

test('M1: invented times and dates inside ISO date-times are caught', () => {
  assert.equal(reasonOf('It overlaps an existing booking that runs until 2026-11-23T12:30.', ov), 'INVENTED_TIME');
  assert.equal(reasonOf('It overlaps an existing booking; try 2026-11-30T10:00.', ov), 'INVENTED_DATE');
  assert.equal(reasonOf('It overlaps an existing booking; try on December 1.', ov), 'INVENTED_DATE');
  assert.equal(reasonOf('It overlaps an existing booking; try again tomorrow.', ov), 'INVENTED_DATE');
});

test('M2: other rooms are caught in any form', () => {
  assert.equal(reasonOf('It overlaps an existing booking, try b-202.', ov), 'INVENTED_ROOM');
  assert.equal(reasonOf('It overlaps an existing booking, try room 202.', ov), 'INVENTED_ROOM');
  assert.equal(reasonOf('It overlaps an existing booking that lasts 2 hours.', ov), 'INVENTED_DETAIL');
});

test('R6: timeout is clamped and a client abort cancels the model call', async () => {
  assert.equal(clampTimeout(600000), TIMEOUT_BOUNDS.max);
  assert.equal(clampTimeout(1), TIMEOUT_BOUNDS.min);
  assert.equal(clampTimeout('abc'), 4000);
  assert.equal(createExplainAdapter({ timeoutMs: 600000 }).timeoutMs, 7000);
  const outer = new AbortController();
  let seen = null;
  const p = withTimeout((signal) => new Promise(() => { seen = signal; }), 5000, outer.signal);
  outer.abort();
  await assert.rejects(p, { code: 'CLIENT_ABORTED' });
  assert.equal(seen.aborted, true);
});

test('R7: one fenced JSON block is accepted, prose still rejected', () => {
  assert.equal(parseModelJson('```json\n{"explanation":"ok"}\n```'), 'ok');
  assert.throws(() => parseModelJson('Sure! ```json\n{"explanation":"ok"}\n```'));
  assert.throws(() => parseModelJson('The room is not available.'));
});

test('R8: identical facts hit the cache; in-flight calls are capped', async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    const text = '{"explanation":"Room A-101 is not available because the time overlaps an existing booking."}';
    return { ok: true, status: 200, text: async () => JSON.stringify({ content: [{ type: 'text', text }] }) };
  };
  const adapter = createExplainAdapter({ mode: 'live', apiKey: 'k', fetchImpl });
  for (let i = 0; i < 20; i++) assert.equal((await adapter.explain(ov)).source, 'llm');
  assert.equal(calls, 1);

  const slow = createExplainAdapter({ mode: 'live', apiKey: 'k', timeoutMs: 600, fetchImpl: () => new Promise(() => {}) });
  const results = await Promise.all(Array.from({ length: MAX_IN_FLIGHT + 2 }, (_, i) =>
    slow.explain({ ...ov, start: `2026-11-23T1${i}:00` })));
  assert.equal(results.filter((r) => r.fallbackReason === 'BUSY').length, 2);
});

test('R8: rate limiter allows N per minute per IP', () => {
  let t = 0;
  const allow = createRateLimiter({ perMinute: 3, now: () => t });
  assert.deepEqual([1, 2, 3, 4].map(() => allow('a')), [true, true, true, false]);
  assert.equal(allow('b'), true);
  t = 60000;
  assert.equal(allow('a'), true);
});

const servers = [];
after(() => servers.forEach((s) => s.close()));
async function start(opts) {
  const server = createServer(opts);
  await new Promise((r) => server.listen(0, r));
  servers.push(server);
  return `http://127.0.0.1:${server.address().port}`;
}
const env = { SMART_CAMPUS_NOW: '2026-11-20T09:00' };
const body = JSON.stringify({ roomId: 'A-101', start: '2026-11-23T10:00', end: '2026-11-23T11:00' });
const postJson = (url) => fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('R8: live mode over HTTP: the 11th explain request in a minute gets the fallback, status unchanged', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => '{}' });
  const url = await start({ env, adapter: createExplainAdapter({ mode: 'live', apiKey: 'k', fetchImpl }) });
  let last;
  for (let i = 0; i < 11; i++) last = await (await postJson(`${url}/api/explain`)).json();
  assert.equal(last.explanation.fallbackReason, 'RATE_LIMITED');
  assert.equal(last.explanation.text, fallbackExplanation('OVERLAP'));
  assert.equal(last.status.reasonCode, 'OVERLAP');
});

test('R6: server aborts the model call when the client disconnects', async () => {
  let seen = null;
  const explain = (facts, { signal }) => new Promise((resolve) => {
    seen = signal;
    signal.addEventListener('abort', () => resolve({ text: 'x', source: 'fallback', fallbackReason: 'CLIENT_ABORTED' }));
  });
  const adapter = { mode: 'mock', explain };
  const url = await start({ env, adapter });
  const ac = new AbortController();
  const init = { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: ac.signal };
  const req = fetch(`${url}/api/explain`, init).catch(() => null);
  while (!seen) await new Promise((r) => setTimeout(r, 10));
  ac.abort();
  await req;
  for (let i = 0; i < 50 && !seen.aborted; i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(seen.aborted, true);
});

test('M6: non-JSON POST gets 415 and 404s carry security headers', async () => {
  const url = await start({ env });
  const r = await fetch(`${url}/api/explain`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body });
  assert.equal(r.status, 415);
  const nf = await fetch(`${url}/nope.html`);
  assert.equal(nf.status, 404);
  assert.equal(nf.headers.get('x-content-type-options'), 'nosniff');
});

test('M4: oversized upstream body is rejected', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, text: async () => 'x'.repeat(50000) });
  const r = await createExplainAdapter({ mode: 'live', apiKey: 'k', fetchImpl }).explain(ov);
  assert.equal(r.fallbackReason, 'INVALID_OUTPUT');
});
