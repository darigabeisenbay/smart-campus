// Server-side LLM adapter. The model only writes text; it never decides availability.
// Modes: "mock" (default, free, offline), "live" (Anthropic Messages API), "off".
import { SYSTEM_PROMPTS, DEFAULT_PROMPT, buildUserMessage } from './prompts.js';
import { validateExplanation } from './validateExplanation.js';
import { fallbackExplanation } from './fallback.js';

export const DEFAULT_TIMEOUT_MS = 4000;
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const MAX_RESPONSE_CHARS = 4000;

class AdapterError extends Error {
  constructor(code) { super(code); this.code = code; }
}

/** Runs fn(signal) with a hard timeout even if fn ignores the abort signal. */
export async function withTimeout(fn, ms) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new AdapterError('TIMEOUT')); }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/** Parses the model's raw text according to the response contract {"explanation": string}. */
export function parseModelJson(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_RESPONSE_CHARS) throw new AdapterError('INVALID_OUTPUT');
  let obj;
  try { obj = JSON.parse(raw.trim()); } catch { throw new AdapterError('INVALID_OUTPUT'); }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new AdapterError('INVALID_OUTPUT');
  const keys = Object.keys(obj);
  if (keys.length !== 1 || keys[0] !== 'explanation' || typeof obj.explanation !== 'string') {
    throw new AdapterError('INVALID_OUTPUT');
  }
  return obj.explanation;
}

// ---- Mock model: builds a friendly explanation from structured data only ----
const hhmm = (v) => v.slice(11, 16);
function mockText(f) {
  const when = `from ${hhmm(f.start)} to ${hhmm(f.end)} on ${f.start.slice(0, 10)}`;
  switch (f.reasonCode) {
    case 'AVAILABLE': return `Good news: ${f.room} is free ${when}, because no booking rule blocks that time.`;
    case 'OVERLAP': return `Sorry, ${f.room} is not available ${when} because that time overlaps an existing booking.`;
    case 'ROOM_BLOCKED': return `Sorry, ${f.room} is not available ${when} because the room is blocked for bookings then.`;
    case 'PAST_TIME': return `This time cannot be booked because the start time is already in the past. Please choose a future time.`;
    case 'OUTSIDE_OPENING_HOURS': return `Sorry, ${f.room} is not available ${when} because it is outside the room's opening hours.`;
    case 'INVALID_TIME':
      return 'This time range is not valid: the end must be after the start, on the same day, and within the maximum length.';
    default: return 'The booking rules decided the status shown above.';
  }
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
    } catch (e) {
      throw new AdapterError(signal.aborted ? 'TIMEOUT' : 'API_ERROR');
    }
    if (!res.ok) throw new AdapterError(res.status === 401 || res.status === 403 ? 'AUTH_ERROR' : 'API_ERROR');
    const data = await res.json().catch(() => null);
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
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
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

  return {
    mode,
    async explain(facts) {
      if (mode === 'off') return fallback(facts, 'DISABLED');
      if (!callModel) return fallback(facts, 'NO_API_KEY');
      try {
        const raw = await withTimeout((signal) => callModel(facts, signal), timeoutMs);
        const checked = validateExplanation(parseModelJson(raw), facts);
        if (!checked.ok) return fallback(facts, `REJECTED_${checked.reason}`);
        return { text: checked.text, source: mode === 'mock' ? 'mock' : 'llm', fallbackReason: null };
      } catch (e) {
        return fallback(facts, e instanceof AdapterError ? e.code : 'API_ERROR');
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
