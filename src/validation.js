// Input validation for student requests. Everything from the client is untrusted.
import { ROOM } from './data.js';
import { isLocalDateTime } from './time.js';

export const LIMITS = Object.freeze({
  maxBodyBytes: 1024,
  maxFieldLength: 32
});

const ALLOWED_FIELDS = new Set(['roomId', 'start', 'end']);

/**
 * @returns {{ok: true, value: {roomId: string, start: string, end: string}} | {ok: false, error: string}}
 */
export function validateRequest(body) {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'MALFORMED_INPUT' };
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(key)) return { ok: false, error: 'MALFORMED_INPUT' };
  }
  for (const key of ALLOWED_FIELDS) {
    const v = body[key];
    if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
      return { ok: false, error: 'EMPTY_INPUT' };
    }
    if (typeof v !== 'string') return { ok: false, error: 'MALFORMED_INPUT' };
    if (v.length > LIMITS.maxFieldLength) return { ok: false, error: 'INPUT_TOO_LONG' };
  }
  if (body.roomId !== ROOM.id) return { ok: false, error: 'UNKNOWN_ROOM' };
  if (!isLocalDateTime(body.start) || !isLocalDateTime(body.end)) {
    return { ok: false, error: 'MALFORMED_INPUT' };
  }
  return { ok: true, value: { roomId: body.roomId, start: body.start, end: body.end } };
}
