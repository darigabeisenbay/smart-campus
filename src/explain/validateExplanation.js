// Validates untrusted model output against the deterministic facts (AC2).
// Strategy: normalise, strip the phrases the facts allow, then reject anything left that
// states a different status, claims an action, or adds a detail that is not in the facts.
// Returns {ok: true, text} or {ok: false, reason}.
import { BOOKINGS, BLOCKED_PERIODS } from '../data.js';
import { reasonFor } from '../reasons.js';

export const OUTPUT_LIMITS = Object.freeze({ maxChars: 300, maxSentences: 2 });

// Printable ASCII, Latin-1 (no soft hyphen), typographic quotes, dashes, ellipsis. Anything else
// (zero-width, bidi controls, private use) can hide words from the checks below (agent R4).
const DISALLOWED_CHARS = /[^\x20-\x7E¡-¬®-ÿ–—‘’“”…]/u;
const FORBIDDEN_FORMAT = /[<>`]|https?:\/\/|www\.|\*\*|^\s*[-*\d]+[.)]\s/i;

// Phrases that correctly say "not available"; removed before looking for a positive claim.
const ALLOWED_NEGATIVE = new RegExp([
  String.raw`\b(is|are|it's|was)\s+not\s+(currently\s+)?(available|free|possible|allowed)\b`,
  String.raw`\b(isn't|aren't|not)\s+(available|free|possible|allowed)\b`,
  String.raw`\bunavailable\b`,
  String.raw`\b(cannot|can't|can not)\s+be\s+booked\b`
].join('|'), 'gi');
// Phrases that correctly say "available" while naming a rule; removed before looking for a negative claim.
const ALLOWED_POSITIVE = new RegExp([
  String.raw`\bno (booking )?rules? (blocks?|prevents?|stops?)\b`,
  String.raw`\b(no|not any) (existing |other |conflicting )?bookings? (overlaps?|conflicts?)( with)?\b`,
  String.raw`\bno (conflicting|overlapping|existing) bookings?\b`,
  String.raw`\b(does not|doesn't|did not|didn't) (overlap|conflict)( with)?\b`,
  String.raw`\b(is not|isn't|not) blocked\b`
].join('|'), 'gi');

const POSITIVE_STATUS = /\b(available|free|open|yours|go ahead|you can|you may|feel free|allowed|possible|use the room|book it|anyway)\b/i;
const NEGATIVE_STATUS = new RegExp(String.raw`\b(not|unavailable|cannot|can't|isn't|overlap\w*|blocked|conflict\w*|booked|taken|`
  + String.raw`occupied|invalid|past|closed|outside)\b`, 'i');

// The assistant must never claim that it (or anyone) changed a booking (agent R2).
const ACTION_WORDS = /\b(confirm\w*|cancel+\w*|reserv\w*|rebook\w*)\b|\bbooked (it |this |the room )?for you\b/i;
const FIRST_PERSON_ACTION = /\b(i|we)('ve|'ll|'d| have| will| had| just)?\s+(\w+\s+)?(book|reserv|cancel|mov|chang|assign|unblock)\w*/i;

// Facts never name an actor or a cause beyond the reason code (agent R3).
const ACTOR_OR_CAUSE = new RegExp([
  String.raw`\b(held|booked|made|reserved|requested|organi[sz]ed|used|taken|owned) by\b`,
  String.raw`\bbecause of\b|\bdue to\b`,
  String.raw`\b(dr|prof|mr|mrs|ms|professor)\.?\s+[a-z]`
].join('|'), 'i');
const UNSUPPORTED_DETAIL_WORDS = new Set([
  ...BOOKINGS.flatMap((b) => b.holder.replace(/\(fictional\)/i, '').split(/\s+/)),
  ...BLOCKED_PERIODS.flatMap((b) => b.reason.replace(/\(fictional\)/i, '').split(/\s+/)),
  'maintenance', 'repair', 'renovation', 'cleaning', 'exam', 'lecture', 'professor', 'club', 'seminar', 'event',
  'workshop', 'team', 'class', 'course', 'meeting', 'owner', 'teacher', 'staff', 'student', 'students'
].map((w) => w.toLowerCase().replace(/[^a-z]/g, '')).filter((w) => w.length > 2));

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_WORD = new RegExp(String.raw`\b(january|february|march|april|may|june|july|august|september|october|november|december|`
  + String.raw`jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\b`, 'gi');
const WEEKDAY = /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|yesterday|tonight)\b/i;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const norm = (h, m) => `${String(h).padStart(2, '0')}:${m}`;

export function countSentences(text) {
  const plain = text.replace(/\b(e\.g|i\.e|etc|vs|dr|prof|mr|mrs|ms)\./gi, '$1');
  return plain.split(/[.!?]+(?=\s|$)/).map((s) => s.trim()).filter(Boolean).length;
}

export function validateExplanation(raw, facts) {
  if (typeof raw !== 'string') return { ok: false, reason: 'NOT_A_STRING' };
  const normalized = raw.normalize('NFKC');
  if (DISALLOWED_CHARS.test(normalized)) return { ok: false, reason: 'FORBIDDEN_FORMAT' };
  const text = normalized.trim().replace(/ {2,}/g, ' ');
  if (text.length === 0) return { ok: false, reason: 'EMPTY' };
  if (text.length > OUTPUT_LIMITS.maxChars) return { ok: false, reason: 'TOO_LONG' };
  if (countSentences(text) > OUTPUT_LIMITS.maxSentences) return { ok: false, reason: 'TOO_MANY_SENTENCES' };
  if (FORBIDDEN_FORMAT.test(text)) return { ok: false, reason: 'FORBIDDEN_FORMAT' };
  if (ACTION_WORDS.test(text) || FIRST_PERSON_ACTION.test(text)) return { ok: false, reason: 'CLAIMS_BOOKING_ACTION' };

  // Remove the supplied room label (whole phrases only) so its words and digits are not judged as details.
  const label = String(facts.room);
  const inner = (/\(([^)]+)\)/.exec(label) || [])[1];
  const roomCode = (/[A-Z]-\d{3}/.exec(label) || [])[0];
  let rest = text;
  for (const phrase of [label, inner, roomCode].filter(Boolean)) {
    rest = rest.replace(new RegExp(escapeRe(phrase), 'gi'), ' ');
  }

  // No invented times or dates. Digit look-arounds instead of \b so "2026-11-23T12:30" is checked too (manual M1).
  const allowedTimes = new Set([facts.start.slice(11, 16), facts.end.slice(11, 16)]);
  for (const m of rest.matchAll(/(?<!\d)(\d{1,2})[:.](\d{2})(?!\d)/g)) {
    if (!allowedTimes.has(norm(m[1], m[2]))) return { ok: false, reason: 'INVENTED_TIME' };
  }
  if (/(?<![\w-])\d{1,2}\s?(am|pm|a\.m\.|p\.m\.|o'clock)/i.test(rest)) return { ok: false, reason: 'INVENTED_TIME' };
  const allowedDates = new Set([facts.start.slice(0, 10), facts.end.slice(0, 10)]);
  for (const m of rest.matchAll(/(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g)) {
    if (!allowedDates.has(m[0])) return { ok: false, reason: 'INVENTED_DATE' };
  }
  const allowedMonths = new Set([...allowedDates].map((d) => MONTHS.at(Number(d.slice(5, 7)) - 1)));
  for (const m of rest.matchAll(MONTH_WORD)) {
    if (!allowedMonths.has(m[1].toLowerCase().slice(0, 3))) return { ok: false, reason: 'INVENTED_DATE' };
  }
  if (WEEKDAY.test(rest)) return { ok: false, reason: 'INVENTED_DATE' };

  // Other rooms, in any letter case (manual M2).
  if (/\b[a-z]-?\d{3}\b|\broom\s+[a-z]?-?\d+/i.test(rest)) return { ok: false, reason: 'INVENTED_ROOM' };

  // Any other number must be a day or a year from the facts ("Study Group 7", "2 hours" are rejected).
  const stripped = rest
    .replace(/(?<!\d)\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2})?(?!\d)/g, ' ')
    .replace(/(?<!\d)\d{1,2}[:.]\d{2}(?!\d)/g, ' ');
  const allowedNumbers = new Set([...allowedDates].flatMap((d) => [d.slice(0, 4), String(Number(d.slice(8, 10)))]));
  for (const m of stripped.matchAll(/\d+/g)) {
    if (!allowedNumbers.has(String(Number(m[0])))) return { ok: false, reason: 'INVENTED_DETAIL' };
  }

  // No actors, causes or names that are not in the facts (agent R3).
  if (ACTOR_OR_CAUSE.test(rest)) return { ok: false, reason: 'INVENTED_DETAIL' };
  const words = rest.toLowerCase().match(/[a-z]+/g) ?? [];
  if (words.some((w) => UNSUPPORTED_DETAIL_WORDS.has(w))) return { ok: false, reason: 'INVENTED_DETAIL' };

  // The status must agree with the deterministic result (agent R1, R5).
  if (facts.isAvailable) {
    if (NEGATIVE_STATUS.test(rest.replace(ALLOWED_POSITIVE, ' '))) return { ok: false, reason: 'CONTRADICTS_STATUS' };
  } else if (POSITIVE_STATUS.test(rest.replace(ALLOWED_NEGATIVE, ' ').replace(/\bopening hours\b/gi, ' '))) {
    return { ok: false, reason: 'CONTRADICTS_STATUS' };
  }

  // The explanation must address the actual reason code.
  const topic = reasonFor(facts.reasonCode)?.topic;
  if (!topic || !topic.test(text)) return { ok: false, reason: 'MISSING_REASON' };

  return { ok: true, text };
}
