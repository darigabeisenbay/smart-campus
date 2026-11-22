// Server-side LLM adapter. The model only writes text; it never decides availability.
// Modes: "mock" (default, free, offline), "live" (Anthropic Messages API), "off".
import { SYSTEM_PROMPTS, DEFAULT_PROMPT, buildUserMessage } from './prompts.js';
import { validateExplanation } from './validateExplanation.js';
import { fallbackExplanation } from './fallback.js';
import { reasonFor, UNKNOWN_REASON_TEXT } from '../reasons.js';

export const DEFAULT_TIMEOUT_MS = 4000;
// Clamped below the browser's 8 s limit so no server work outlives the page (agent R6).
export const TIMEOUT_BOUNDS = Object.freeze({ min: 500, max: 7000 });
export const MAX_IN_FLIGHT = 4;
const CACHE_SIZE = 100;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RESPONSE_CHARS = 4000;
const MAX_UPSTREAM_BYTES = 20000;

class AdapterError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/**
 * Runs fn(signal) with a hard timeout even if fn ignores the abort signal.
 * An optional outer signal (client disconnected) aborts the call as well.
 */
export async function withTimeout(fn, ms, outer) {
  const controller = new AbortController();
  let timer;
  let onOuterAbort;
  const stop = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new AdapterError('TIMEOUT')); }, ms);
    if (outer) {
      onOuterAbort = () => { controller.abort(); reject(new AdapterError('CLIENT_ABORTED')); };
      if (outer.aborted) onOuterAbort();
      else outer.addEventListener('abort', onOuterAbort, { once: true });
    }
  });
  try {
    return await Promise.race([fn(controller.signal), stop]);
  } finally {
    clearTimeout(timer);
    if (outer && onOuterAbort) outer.removeEventListener('abort', onOuterAbort);
  }
}

export function clampTimeout(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.min(Math.max(n, TIMEOUT_BOUNDS.min), TIMEOUT_BOUNDS.max);
}

/** Parses the model's raw text according to the response contract {"explanation": string}. */
export function parseModelJson(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_RESPONSE_CHARS) throw new AdapterError('INVALID_OUTPUT');
  // Accept one surrounding ```json fence (common model formatting, agent R7); the one-key check still applies.
  const fenced = /^\s*```(?:json)?\s*\n([\s\S]*?)\n?```\s*$/i.exec(raw);
  let obj;
  try { obj = JSON.parse((fenced ? fenced[1] : raw).trim()); } catch { throw new AdapterError('INVALID_OUTPUT'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new AdapterError('INVALID_OUTPUT');
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'explanation' || typeof obj.explanation !== 'string') {
    throw new AdapterError('INVALID_OUTPUT');
  }
  return obj.explanation;
}

// ---- Mock model: builds a friendly explanation from structured data only ----
function mockText(f) {
  return reasonFor(f.reasonCode)?.mock(f) ?? UNKNOWN_REASON_TEXT;
}

export function createMockModel(behavior = 'ok') {
  return async (facts, signal) => {
    switch (behavior) {
      case 'timeout':
        return new Promise((_, reject) => signal.addEventListener('abort', () => reject(new AdapterError('TIMEOUT'))));
      case 'error': throw new AdapterError('API_ERROR');
      case 'invalid': return '{"explanation": 42, "isAvailable": true}';
      case 'contradict': return JSON.stringify({ explanation: `Good news: ${facts.room} is available at that time.` });
      case 'invent': return JSON.stringify({ explanation: `${facts.room} is not available because of maintenance by the Robotics Club.` });
      default: return JSON.stringify({ explanation: mockText(facts) });
    }
  };
}

// ---- Live model: Anthropic Messages API (server-side only; key never leaves the server) ----
export function createLiveModel({ apiKey, model, promptVariant, fetchImpl = globalThis.fetch }) {
  return async (facts, signal) => {
    let res;
    try {
      res = await fetchImpl(ANTHROPIC_URL, {
        method: 'POST',
        signal,
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model,
          max_tokens: 200,
          temperature: 0,
          system: SYSTEM_PROMPTS[promptVariant],
          messages: [{ role: 'user', content: buildUserMessage(facts) }]
        })
      });
    } catch {
      throw new AdapterError(signal.aborted ? 'TIMEOUT' : 'API_ERROR');
    }
    if (!res.ok) throw new AdapterError(res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : 'API_ERROR');
    // Cap the upstream body before parsing it (manual M4).
    if (Number(res.headers?.get?.('content-length')) > MAX_UPSTREAM_BYTES) throw new AdapterError('INVALID_OUTPUT');
    const body = await res.text().catch(() => '');
    if (body.length > MAX_UPSTREAM_BYTES) throw new AdapterError('INVALID_OUTPUT');
    let data = null;
    try { data = JSON.parse(body); } catch { data = null; }
    const text = data?.content?.find?.((c) => c.type === 'text')?.text;
    if (typeof text !== 'string') throw new AdapterError('INVALID_OUTPUT');
    return text;
  };
}

/**
 * @param {{mode?: string, apiKey?: string, model?: string, timeoutMs?: number, promptVariant?: string,
 *          mockBehavior?: string, fetchImpl?: Function}} options
 */
export function createExplainAdapter(options = {}) {
  const mode = ['mock', 'live', 'off'].includes(options.mode) ? options.mode : 'mock';
  const timeoutMs = clampTimeout(options.timeoutMs);
  const promptVariant = SYSTEM_PROMPTS[options.promptVariant] ? options.promptVariant : DEFAULT_PROMPT;
  const hasKey = typeof options.apiKey === 'string' && options.apiKey.trim().length > 0;

  let callModel = null;
  if (mode === 'mock') callModel = createMockModel(options.mockBehavior);
  if (mode === 'live' && hasKey) {
    callModel = createLiveModel({
      apiKey: options.apiKey.trim(),
      model: options.model || 'claude-haiku-5-5',
      promptVariant,
      fetchImpl: options.fetchImpl
    });
  }

  const fallback = (facts, fallbackReason) => ({ text: fallbackExplanation(facts.reasonCode), source: 'fallback', fallbackReason });
  const source = mode === 'mock' ? 'mock' : 'llm';
  // Validated outputs only; identical facts never trigger a second paid call (agent R8 / manual M3).
  const cache = new Map();
  let inFlight = 0;

  return {
    mode,
    timeoutMs,
    async explain(facts, { signal } = {}) {
      if (mode === 'off') return fallback(facts, 'DISABLED');
      if (!callModel) return fallback(facts, 'NO_API_KEY');
      const key = JSON.stringify(facts);
      if (cache.has(key)) return { text: cache.get(key), source, fallbackReason: null, cached: true };
      if (inFlight >= MAX_IN_FLIGHT) return fallback(facts, 'BUSY');
      inFlight++;
      try {
        const raw = await withTimeout((s) => callModel(facts, s), timeoutMs, signal);
        const checked = validateExplanation(parseModelJson(raw), facts);
        if (!checked.ok) return fallback(facts, `REJECTED_${checked.reason}`);
        cache.set(key, checked.text);
        if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value);
        return { text: checked.text, source, fallbackReason: null };
      } catch (e) {
        return fallback(facts, e instanceof AdapterError ? e.code : 'API_ERROR');
      } finally {
        inFlight--;
      }
    }
  };
}

export function adapterFromEnv(env = process.env) {
  return createExplainAdapter({
    mode: env.LLM_MODE || 'mock',
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.LLM_MODEL,
    timeoutMs: env.LLM_TIMEOUT_MS,
    promptVariant: env.LLM_PROMPT_VARIANT,
    mockBehavior: env.LLM_MOCK_BEHAVIOR
  });
}
