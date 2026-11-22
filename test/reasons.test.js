// The reason catalog must describe every rule-engine code completely and consistently.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REASONS, reasonFor } from '../src/reasons.js';
import { REASON_CODES } from '../src/availability.js';
import { validateExplanation } from '../src/explain/validateExplanation.js';
import { ROOM } from '../src/data.js';

const facts = (code) => ({
  room: ROOM.label, start: '2026-11-23T10:00', end: '2026-11-23T11:00', isAvailable: code === 'AVAILABLE', reasonCode: code
});

test('catalog has exactly the rule-engine codes, each with every field', () => {
  assert.deepEqual(Object.keys(REASONS).sort(), Object.values(REASON_CODES).sort());
  for (const [code, r] of Object.entries(REASONS)) {
    for (const field of ['statusText', 'glossary', 'fallback']) {
      assert.ok(typeof r[field] === 'string' && r[field].length > 0, `${code}.${field}`);
    }
    assert.ok(r.topic instanceof RegExp, `${code}.topic`);
    assert.equal(typeof r.mock, 'function', `${code}.mock`);
  }
});

test('catalog texts agree with the decision: fallback and mock pass the validator, status text matches availability', () => {
  for (const code of Object.keys(REASONS)) {
    const r = reasonFor(code);
    assert.equal(validateExplanation(r.fallback, facts(code)).ok, true, `${code} fallback`);
    assert.equal(validateExplanation(r.mock(facts(code)), facts(code)).ok, true, `${code} mock`);
    assert.equal(r.statusText.startsWith('Not available'), code !== 'AVAILABLE', `${code} statusText`);
  }
});

test('unknown codes are handled safely', () => {
  assert.equal(reasonFor('NOPE'), null);
  assert.equal(reasonFor('__proto__'), null);
});
