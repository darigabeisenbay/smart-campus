// Reason-code catalog: the ONE place that knows how each deterministic reason code is described.
// Table-driven (one record per code) instead of five parallel switch/maps across the codebase.
// Adding a reason code = add one complete record here; test/reasons.test.js fails if any field is missing.
import { REASON_CODES } from './availability.js';

const hhmm = (v) => v.slice(11, 16);
const when = (f) => `from ${hhmm(f.start)} to ${hhmm(f.end)} on ${f.start.slice(0, 10)}`;

export const REASONS = Object.freeze({
  AVAILABLE: Object.freeze({
    statusText: 'Available',
    glossary: 'the requested time passed every booking rule',
    fallback: 'This room is free for the selected time, because no booking rule blocks it.',
    topic: /\b(available|free)\b/i,
    mock: (f) => `Good news: ${f.room} is free ${when(f)}, because no booking rule blocks that time.`
  }),
  OVERLAP: Object.freeze({
    statusText: 'Not available – overlaps an existing booking',
    glossary: 'the requested time overlaps an existing booking of this room',
    fallback: 'This room is not available because the selected time overlaps an existing booking.',
    topic: /\b(overlap\w*|already booked|existing booking|another booking|conflict\w*)\b/i,
    mock: (f) => `Sorry, ${f.room} is not available ${when(f)} because that time overlaps an existing booking.`
  }),
  ROOM_BLOCKED: Object.freeze({
    statusText: 'Not available – room is blocked',
    glossary: 'the room is blocked for bookings during the requested time',
    fallback: 'This room is not available because it is blocked for bookings during the selected time.',
    topic: /\b(blocked|not open for booking)\b/i,
    mock: (f) => `Sorry, ${f.room} is not available ${when(f)} because the room is blocked for bookings then.`
  }),
  INVALID_TIME: Object.freeze({
    statusText: 'Not available – invalid time range',
    glossary: 'the requested time range is not valid (for example the end is not after the start, it spans two days or is too long)',
    fallback: 'This request is not valid: the end must be after the start, on the same day, and within the maximum length.',
    topic: /\b(not valid|invalid|end (time )?(must|is|has)|after the start|same day|too long|maximum length|duration)\b/i,
    mock: () => 'This time range is not valid: the end must be after the start, on the same day, and within the maximum length.'
  }),
  PAST_TIME: Object.freeze({
    statusText: 'Not available – time is in the past',
    glossary: 'the requested start time is already in the past',
    fallback: 'This room cannot be booked for the selected time because the start time is already in the past.',
    topic: /\b(past|already passed|has passed)\b/i,
    mock: () => 'This time cannot be booked because the start time is already in the past. Please choose a future time.'
  }),
  OUTSIDE_OPENING_HOURS: Object.freeze({
    statusText: 'Not available – outside opening hours',
    glossary: 'the requested time is outside the room\'s opening hours',
    fallback: 'This room is not available because the selected time is outside the room\'s opening hours.',
    topic: /\b(opening hours|outside (the )?(room's )?(opening |open )?hours)\b/i,
    mock: (f) => `Sorry, ${f.room} is not available ${when(f)} because it is outside the room's opening hours.`
  })
});

export const UNKNOWN_REASON_TEXT = 'The booking rules decided the status shown above.';

/** Catalog record for a code, or null (callers fall back safely). */
export function reasonFor(code) {
  return Object.hasOwn(REASONS, code) ? REASONS[code] : null;
}

// Fail fast at import time if the rule engine gained a code the catalog does not describe.
for (const code of Object.values(REASON_CODES)) {
  if (!reasonFor(code)) throw new Error(`reasons.js: missing catalog entry for ${code}`);
}
