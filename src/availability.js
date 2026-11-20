// Deterministic availability checker: the ONLY source of truth for availability.
import { ROOM, BOOKINGS, BLOCKED_PERIODS } from './data.js';
import { toMinutes } from './time.js';

export const REASON_CODES = Object.freeze({
  AVAILABLE: 'AVAILABLE',
  OVERLAP: 'OVERLAP',
  ROOM_BLOCKED: 'ROOM_BLOCKED',
  INVALID_TIME: 'INVALID_TIME',
  PAST_TIME: 'PAST_TIME',
  OUTSIDE_OPENING_HOURS: 'OUTSIDE_OPENING_HOURS'
});

// Half-open intervals [start, end): touching intervals do not overlap.
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * @param {{start: string, end: string}} request  campus-local "YYYY-MM-DDTHH:MM"
 * @param {{now: string, room?: object, bookings?: object[], blocked?: object[]}} ctx
 * @returns {{isAvailable: boolean, reasonCode: string}}
 */
export function checkAvailability(request, ctx) {
  const room = ctx.room ?? ROOM;
  const bookings = ctx.bookings ?? BOOKINGS;
  const blocked = ctx.blocked ?? BLOCKED_PERIODS;
  const result = (isAvailable, reasonCode) => Object.freeze({ isAvailable, reasonCode });

  const start = toMinutes(request?.start);
  const end = toMinutes(request?.end);
  const now = toMinutes(ctx.now);
  if (start === null || end === null || now === null) return result(false, REASON_CODES.INVALID_TIME);
  if (end <= start || end - start > room.maxDurationMinutes) return result(false, REASON_CODES.INVALID_TIME);
  if (request.start.slice(0, 10) !== request.end.slice(0, 10)) return result(false, REASON_CODES.INVALID_TIME);
  if (start < now) return result(false, REASON_CODES.PAST_TIME);

  const dayStart = toMinutes(`${request.start.slice(0, 10)}T00:00`);
  if (start - dayStart < room.openingHour * 60 || end - dayStart > room.closingHour * 60) {
    return result(false, REASON_CODES.OUTSIDE_OPENING_HOURS);
  }
  if (blocked.some((b) => overlaps(start, end, toMinutes(b.start), toMinutes(b.end)))) {
    return result(false, REASON_CODES.ROOM_BLOCKED);
  }
  if (bookings.some((b) => overlaps(start, end, toMinutes(b.start), toMinutes(b.end)))) {
    return result(false, REASON_CODES.OVERLAP);
  }
  return result(true, REASON_CODES.AVAILABLE);
}
