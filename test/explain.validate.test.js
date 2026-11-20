import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateExplanation, countSentences } from '../src/explain/validateExplanation.js';
import { fallbackExplanation } from '../src/explain/fallback.js';
import { REASON_CODES } from '../src/availability.js';
import { ROOM } from '../src/data.js';

const facts = (isAvailable, reasonCode) => ({
  room: ROOM.label, start: '2026-11-23T10:00', end: '2026-11-23T11:00', isAvailable, reasonCode
});
const NOT_AVAILABLE = Object.values(REASON_CODES).filter((c) => c !== 'AVAILABLE');

test('every deterministic fallback text passes the validator (fallback is always safe)', () => {
  assert.equal(validateExplanation(fallbackExplanation('AVAILABLE'), facts(true, 'AVAILABLE')).ok, true);
  for (const code of NOT_AVAILABLE) {
    const r = validateExplanation(fallbackExplanation(code), facts(false, code));
    assert.equal(r.ok, true, `${code}: ${r.reason}`);
  }
});

test('accepts a correct two-sentence explanation', () => {
  const t = 'Room A-101 is not available from 10:00 to 11:00 because it overlaps an existing booking. Please try another time.';
  assert.equal(validateExplanation(t, facts(false, 'OVERLAP')).ok, true);
});

test('AC2: rejects text that contradicts the deterministic status', () => {
  assert.equal(validateExplanation('Good news, the room is available then.', facts(false, 'OVERLAP')).reason, 'CONTRADICTS_STATUS');
  assert.equal(validateExplanation('You can book it, it overlaps nothing.', facts(false, 'OVERLAP')).reason, 'CONTRADICTS_STATUS');
  assert.equal(validateExplanation('Sorry, the room is not available.', facts(true, 'AVAILABLE')).reason, 'CONTRADICTS_STATUS');
});

test('AC2: rejects text that does not mention the actual reason', () => {
  assert.equal(validateExplanation('The room is not available at that time.', facts(false, 'PAST_TIME')).reason, 'MISSING_REASON');
});

test('AC2: rejects invented times, dates, rooms and booking details', () => {
  const f = facts(false, 'OVERLAP');
  assert.equal(validateExplanation('It overlaps an existing booking that ends at 12:30.', f).reason, 'INVENTED_TIME');
  assert.equal(validateExplanation('It overlaps an existing booking until 3 pm.', f).reason, 'INVENTED_TIME');
  assert.equal(validateExplanation('It overlaps an existing booking on 2026-11-30.', f).reason, 'INVENTED_DATE');
  assert.equal(validateExplanation('It overlaps an existing booking; try room B-202.', f).reason, 'INVENTED_ROOM');
  assert.equal(validateExplanation('It overlaps an existing booking by the Robotics Club.', f).reason, 'INVENTED_DETAIL');
  assert.equal(validateExplanation('It is blocked because of maintenance.', facts(false, 'ROOM_BLOCKED')).reason, 'INVENTED_DETAIL');
});

test('allows words that are part of the supplied room label', () => {
  assert.equal(validateExplanation('The Group Study Room is free from 10:00 to 11:00.', facts(true, 'AVAILABLE')).ok, true);
});

test('rejects claims that the assistant booked or cancelled something', () => {
  const f = facts(true, 'AVAILABLE');
  assert.equal(validateExplanation('The room is free, and I have booked it for you.', f).reason, 'CLAIMS_BOOKING_ACTION');
  assert.equal(validateExplanation('Your booking is confirmed, the room is free.', f).reason, 'CLAIMS_BOOKING_ACTION');
});

test('format and length validation', () => {
  const f = facts(true, 'AVAILABLE');
  assert.equal(validateExplanation('', f).reason, 'EMPTY');
  assert.equal(validateExplanation(42, f).reason, 'NOT_A_STRING');
  assert.equal(validateExplanation(`The room is free. ${'x'.repeat(300)}`, f).reason, 'TOO_LONG');
  assert.equal(validateExplanation('It is free. It is free. It is free.', f).reason, 'TOO_MANY_SENTENCES');
  assert.equal(validateExplanation('The room is free <script>alert(1)</script>', f).reason, 'FORBIDDEN_FORMAT');
  assert.equal(validateExplanation('The room is free, see https://evil.example', f).reason, 'FORBIDDEN_FORMAT');
  assert.equal(countSentences('Free from 10:00 to 11:00. Enjoy!'), 2);
});
