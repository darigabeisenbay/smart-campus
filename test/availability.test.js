import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkAvailability, overlaps, REASON_CODES } from '../src/availability.js';

const NOW = '2026-11-20T09:00';
const check = (start, end, now = NOW) => checkAvailability({ start, end }, { now });

test('free slot is available', () => {
  assert.deepEqual({ ...check('2026-11-23T11:00', '2026-11-23T12:00') }, { isAvailable: true, reasonCode: REASON_CODES.AVAILABLE });
});

test('overlap with an existing booking is rejected', () => {
  assert.equal(check('2026-11-23T10:00', '2026-11-23T11:00').reasonCode, REASON_CODES.OVERLAP);
  assert.equal(check('2026-11-23T08:30', '2026-11-23T12:00').reasonCode, REASON_CODES.OVERLAP);
});

test('adjacent slots do not overlap (half-open intervals)', () => {
  assert.equal(check('2026-11-23T10:30', '2026-11-23T11:30').isAvailable, true);
  assert.equal(check('2026-11-23T12:00', '2026-11-23T13:00').isAvailable, true);
  assert.equal(overlaps(0, 10, 10, 20), false);
  assert.equal(overlaps(0, 11, 10, 20), true);
});

test('blocked room is rejected', () => {
  assert.equal(check('2026-11-24T10:00', '2026-11-24T11:00').reasonCode, REASON_CODES.ROOM_BLOCKED);
});

test('invalid times are rejected', () => {
  assert.equal(check('2026-11-23T12:00', '2026-11-23T11:00').reasonCode, REASON_CODES.INVALID_TIME);
  assert.equal(check('2026-11-23T12:00', '2026-11-23T12:00').reasonCode, REASON_CODES.INVALID_TIME);
  assert.equal(check('2026-11-23T08:00', '2026-11-23T12:30').reasonCode, REASON_CODES.INVALID_TIME); // > 4h
  assert.equal(check('2026-02-30T10:00', '2026-02-30T11:00').reasonCode, REASON_CODES.INVALID_TIME);
  assert.equal(check('not-a-date', '2026-11-23T11:00').reasonCode, REASON_CODES.INVALID_TIME);
  assert.equal(check('2026-11-23T19:00', '2026-11-24T09:00').reasonCode, REASON_CODES.INVALID_TIME);
});

test('past time is rejected', () => {
  assert.equal(check('2026-11-19T10:00', '2026-11-19T11:00').reasonCode, REASON_CODES.PAST_TIME);
});

test('outside opening hours is rejected', () => {
  assert.equal(check('2026-11-23T07:00', '2026-11-23T08:30').reasonCode, REASON_CODES.OUTSIDE_OPENING_HOURS);
  assert.equal(check('2026-11-23T19:30', '2026-11-23T20:30').reasonCode, REASON_CODES.OUTSIDE_OPENING_HOURS);
});

test('result object is immutable', () => {
  const r = check('2026-11-23T11:00', '2026-11-23T12:00');
  assert.throws(() => { 'use strict'; r.isAvailable = false; });
});
