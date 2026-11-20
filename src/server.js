// Minimal HTTP server: static UI + JSON API. No framework, no database.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM } from './data.js';
import { checkAvailability } from './availability.js';
import { validateRequest, LIMITS } from './validation.js';
import { nowLocal } from './time.js';
import { adapterFromEnv } from './explain/adapter.js';
import { buildFacts } from './explain/prompts.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'"
};

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS });
  res.end(JSON.stringify(payload));
}

export function readJsonBody(req, maxBytes = LIMITS.maxBodyBytes) {
  return new Promise((resolve) => {
    let size = 0;
    const chunks = [];
    let done = false;
    const finish = (value) => { if (!done) { done = true; resolve(value); } };
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) { finish({ ok: false, error: 'INPUT_TOO_LONG' }); req.resume(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (done) return;
      const text = Buffer.concat(chunks).toString('utf8');
      if (text.trim() === '') return finish({ ok: false, error: 'EMPTY_INPUT' });
      try { finish({ ok: true, value: JSON.parse(text) }); } catch { finish({ ok: false, error: 'MALFORMED_INPUT' }); }
    });
    req.on('error', () => finish({ ok: false, error: 'MALFORMED_INPUT' }));
  });
}

async function serveStatic(req, res) {
  const urlPath = new URL(req.url, 'http://localhost').pathname;
  const rel = urlPath === '/' ? 'index.html' : normalize(urlPath).replace(/^[/\\]+/, '');
  if (rel.includes('..') || !MIME[extname(rel)]) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(join(PUBLIC_DIR, rel));
    res.writeHead(200, { 'Content-Type': MIME[extname(rel)], ...SECURITY_HEADERS });
    res.end(body);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}

/** Validates the request and runs the deterministic checker. */
export async function handleAvailability(req, env) {
  const body = await readJsonBody(req);
  if (!body.ok) return { status: 400, payload: { error: body.error } };
  const input = validateRequest(body.value);
  if (!input.ok) return { status: 400, payload: { error: input.error } };
  const result = checkAvailability(input.value, { now: nowLocal(env) });
  return {
    status: 200,
    input: input.value,
    result,
    payload: { room: ROOM.label, start: input.value.start, end: input.value.end, ...result }
  };
}

/**
 * "Explain availability": re-runs the deterministic checker on the server (the client's
 * status is never trusted), then asks the adapter for text. The status in the response
 * always comes from the checker, never from the model.
 */
export async function handleExplain(req, env, adapter) {
  const out = await handleAvailability(req, env);
  if (out.status !== 200) return out;
  const facts = buildFacts({ roomLabel: ROOM.label, ...out.input, ...out.result });
  const explanation = await adapter.explain(facts);
  return {
    status: 200,
    payload: {
      status: out.payload,
      explanation: {
        text: explanation.text,
        source: explanation.source,
        generated: explanation.source !== 'fallback',
        fallbackReason: explanation.fallbackReason
      }
    }
  };
}

export function createServer({ env = process.env, adapter = adapterFromEnv(env) } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/api/room') {
        return sendJson(res, 200, { id: ROOM.id, label: ROOM.label, now: nowLocal(env), explainMode: adapter.mode });
      }
      if (req.method === 'POST' && req.url === '/api/availability') {
        const out = await handleAvailability(req, env);
        return sendJson(res, out.status, out.payload);
      }
      if (req.method === 'POST' && req.url === '/api/explain') {
        const out = await handleExplain(req, env, adapter);
        return sendJson(res, out.status, out.payload);
      }
      if (req.method === 'GET') return serveStatic(req, res);
      return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED' });
    } catch {
      return sendJson(res, 500, { error: 'INTERNAL_ERROR' });
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT) || 3000;
  createServer().listen(port, () => process.stdout.write(`Smart Campus running on http://localhost:${port}\n`));
}
