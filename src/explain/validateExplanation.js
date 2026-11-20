// Validates untrusted model output against the deterministic facts (AC2).
// Returns {ok: true, text} or {ok: false, reason}.
import { BOOKINGS, BLOCKED_PERIODS, ROOM } from '../data.js';

export const OUTPUT_LIMITS = Object.freeze({ maxChars: 300, maxSentences: 2 });

const REQUIRED_TOPIC = Object.freeze({
  AVAILABLE: /\b(available|free)\b/i,
  OVERLAP: /\b(overlap\w*|already (booked|reserved)|existing booking|another booking|conflict\w*)\b/i,
  ROOM_BLOCKED: /\b(blocked|not open for booking)\b/i,
  INVALID_TIME: /\b(not valid|invalid|end (time )?(must|is|has)|after the start|same day|too long|maximum length|duration)\b/i,
  PAST_TIME: /\b(past|already passed|has passed)\b/i,
  OUTSIDE_OPENING_HOURS: /\b(opening hours|outside (the )?(room's )?(opening |open )?hours)\b/i
});

// Saying a room "is available" when it is not (negations such as "is not available" are allowed).
const CLAIMS_AVAILABLE = /\b(is|are|it's|remains|still)\s+(?!not\b|un)(currently\s+)?(available|free)\b|\byou can (book|use|reserve)\b/i;
const CLAIMS_UNAVAILABLE = /\b(not available|unavailable|cannot be booked|can't be booked|not free|is booked|overlap\w*|blocked)\b/i;
// The assistant must never claim it changed bookings.
const CLAIMS_ACTION = new RegExp([
  String.raw`\b(i|we)\s+(have\s+)?(booked|reserved|cancel+ed|moved|changed)\b`,
  String.raw`\b(booking|reservation) (is |has been )?(confirmed|created|cancel+ed)\b`,
  String.raw`\b(booked|reserved) (it )?for you\b`
].join('|'), 'i');
const FORBIDDEN_FORMAT = /[<>`]|https?:\/\/|www\.|\n|\*\*|^\s*[-*\d]+[.)]\s/i;

// Details that exist in internal data or the world but are NOT part of the supplied facts.
const UNSUPPORTED_DETAIL_WORDS = [
  ...BOOKINGS.flatMap((b) => b.holder.replace(/\(fictional\)/i, '').split(/\s+/)),
  ...BLOCKED_PERIODS.flatMap((b) => b.reason.replace(/\(fictional\)/i, '').split(/\s+/)),
  'maintenance', 'repair', 'renovation', 'cleaning', 'exam', 'lecture', 'professor', 'club', 'seminar', 'event'
].map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter((w) => w.length > 3);

const norm = (h, m) => `${String(h).padStart(2, '0')}:${m}`;

export function countSentences(text) {
  return text.split(/[.!?]+(?=\s|$)/).map((s) => s.trim()).filter(Boolean).length;
}

export function validateExplanation(raw, facts) {
  if (typeof raw !== 'string') return { ok: false, reason: 'NOT_A_STRING' };
  const text = raw.trim().replace(/\s+/g, ' ');
  if (text.length === 0) return { ok: false, reason: 'EMPTY' };
  if (text.length > OUTPUT_LIMITS.maxChars) return { ok: false, reason: 'TOO_LONG' };
  if (countSentences(text) > OUTPUT_LIMITS.maxSentences) return { ok: false, reason: 'TOO_MANY_SENTENCES' };
  if (FORBIDDEN_FORMAT.test(raw)) return { ok: false, reason: 'FORBIDDEN_FORMAT' };
  if (CLAIMS_ACTION.test(text)) return { ok: false, reason: 'CLAIMS_BOOKING_ACTION' };

  // Status must agree with the deterministic result.
  if (facts.isAvailable && CLAIMS_UNAVAILABLE.test(text)) return { ok: false, reason: 'CONTRADICTS_STATUS' };
  if (!facts.isAvailable && CLAIMS_AVAILABLE.test(text)) return { ok: false, reason: 'CONTRADICTS_STATUS' };
  // No invented times, dates, rooms or booking details.
  const allowedTimes = new Set([facts.start.slice(11, 16), facts.end.slice(11, 16)]);
  for (const m of text.matchAll(/\b(\d{1,2})[:.](\d{2})\b/g)) {
    if (!allowedTimes.has(norm(m[1], m[2]))) return { ok: false, reason: 'INVENTED_TIME' };
  }
  if (/\b\d{1,2}\s?(am|pm)\b/i.test(text)) return { ok: false, reason: 'INVENTED_TIME' };
  const allowedDates = new Set([facts.start.slice(0, 10), facts.end.slice(0, 10)]);
  for (const m of text.matchAll(/\b\d{4}-\d{2}-\d{2}\b/g)) {
    if (!allowedDates.has(m[0])) return { ok: false, reason: 'INVENTED_DATE' };
  }
  for (const m of text.matchAll(/\b[A-Z]-?\d{3}\b/g)) {
    if (m[0].replace('-', '') !== ROOM.id.replace('-', '')) return { ok: false, reason: 'INVENTED_ROOM' };
  }
  const words = new Set(text.toLowerCase().match(/[a-z]+/g) ?? []);
  const factWords = new Set(String(facts.room).toLowerCase().match(/[a-z]+/g) ?? []);
  if (UNSUPPORTED_DETAIL_WORDS.some((w) => words.has(w) && !factWords.has(w))) {
    return { ok: false, reason: 'INVENTED_DETAIL' };
  }

  // The explanation must address the actual reason code.
  const topic = REQUIRED_TOPIC[facts.reasonCode];
  if (!topic || !topic.test(text)) return { ok: false, reason: 'MISSING_REASON' };

  return { ok: true, text };
}
