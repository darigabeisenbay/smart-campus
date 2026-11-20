import { validateExplanation } from '../../../src/explain/validateExplanation.js';
import { createExplainAdapter, parseModelJson } from '../../../src/explain/adapter.js';
const ov = { room: 'Room A-101 (Group Study Room)', start: '2026-11-23T13:30', end: '2026-11-23T14:00', isAvailable: false, reasonCode: 'OVERLAP' };
console.log(validateExplanation('This time overlaps an existing booking held by Study Group 7.', ov));
console.log(validateExplanation('This time overlaps an existing booking, so try again tomorrow afternoon.', ov));
try { parseModelJson('```json\n{"explanation":"x"}\n```'); } catch (e) { console.log('fenced ->', e.code); }
// fake live fetch returning fenced JSON (common LLM habit)
const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: '```json\n{"explanation":"Sorry, Room A-101 is not available because that time overlaps an existing booking."}\n```' }] }) });
const a = createExplainAdapter({ mode: 'live', apiKey: 'k', fetchImpl });
console.log('live fenced ->', await a.explain(ov));
const b = createExplainAdapter({ mode: 'mock', timeoutMs: '600000' });
console.log('timeoutMs accepted unbounded (no getter, inspect via behaviour): see http test');
