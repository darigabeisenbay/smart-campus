import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest } from '../src/validation.js';

const ok = { roomId: 'A-101', start: '2026-11-23T11:00', end: '2026-11-23T12:00' };

test('valid request passes', () => {
  assert.deepEqual(validateRequest(ok), { ok: true, value: ok });
});

test('empty input is rejected', () => {
  assert.equal(validateRequest({ ...ok, start: '' }).error, 'EMPTY_INPUT');
  assert.equal(validateRequest({ ...ok, end: '   ' }).error, 'EMPTY_INPUT');
  assert.equal(validateRequest({ roomId: 'A-101' }).error, 'EMPTY_INPUT');
});

test('malformed input is rejected', () => {
  assert.equal(validateRequest(null).error, 'MALFORMED_INPUT');
  assert.equal(validateRequest([]).error, 'MALFORMED_INPUT');
  assert.equal(validateRequest('text').error, 'MALFORMED_INPUT');
  assert.equal(validateRequest({ ...ok, start: 123 }).error, 'MALFORMED_INPUT');
  assert.equal(validateRequest({ ...ok, start: '23/11/2026 11:00' }).error, 'MALFORMED_INPUT');
  assert.equal(validateRequest({ ...ok, extra: 'x' }).error, 'MALFORMED_INPUT');
});

test('overly long input is rejected', () => {
  assert.equal(validateRequest({ ...ok, start: '2026-11-23T11:00'.padEnd(500, 'x') }).error, 'INPUT_TOO_LONG');
});

test('unknown room is rejected', () => {
  assert.equal(validateRequest({ ...ok, roomId: 'B-202' }).error, 'UNKNOWN_ROOM');
});
