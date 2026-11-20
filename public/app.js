// Browser UI. Renders only what the server returns; all text goes through textContent.
const $ = (id) => document.getElementById(id);

const STATUS_TEXT = {
  AVAILABLE: 'Available',
  OVERLAP: 'Not available – overlaps an existing booking',
  ROOM_BLOCKED: 'Not available – room is blocked',
  INVALID_TIME: 'Not available – invalid time range',
  PAST_TIME: 'Not available – time is in the past',
  OUTSIDE_OPENING_HOURS: 'Not available – outside opening hours'
};

const ERROR_TEXT = {
  EMPTY_INPUT: 'Please fill in both start and end time.',
  MALFORMED_INPUT: 'The request was not in the expected format.',
  INPUT_TOO_LONG: 'The input is too long.',
  UNKNOWN_ROOM: 'Unknown room.',
  STATUS_CHANGED: 'The availability changed since your check. Please check again.'
};

const BADGE = { mock: 'Mock model (offline demo)', llm: 'AI model', fallback: 'Standard explanation – AI unavailable' };
const EXPLAIN_TIMEOUT_MS = 8000;

let roomId = 'A-101';
let lastChecked = null; // {request, result} of the last deterministic check

function showError(code) {
  $('error').textContent = ERROR_TEXT[code] || 'Something went wrong. Please try again.';
  $('error').classList.remove('hidden');
}

function clearOutput() {
  $('error').classList.add('hidden');
  $('status').classList.add('hidden');
  $('explain').classList.add('hidden');
  lastChecked = null;
}

async function postJson(url, body, signal) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const data = await res.json().catch(() => ({ error: 'MALFORMED_INPUT' }));
  return { ok: res.ok, data };
}

function renderStatus(result) {
  const box = $('status');
  box.classList.remove('hidden', 'ok', 'no');
  box.classList.add(result.isAvailable ? 'ok' : 'no');
  $('status-text').textContent = STATUS_TEXT[result.reasonCode] || (result.isAvailable ? 'Available' : 'Not available');
  $('status-code').textContent = `Reason code: ${result.reasonCode} · ${result.start} → ${result.end}`;
}

async function onCheck(event) {
  event.preventDefault();
  clearOutput();
  const body = { roomId, start: $('start').value, end: $('end').value };
  const { ok, data } = await postJson('/api/availability', body);
  if (!ok) return showError(data.error);
  renderStatus(data);
  lastChecked = { request: body, result: data };
}

function renderExplanation(explanation) {
  const generated = explanation.generated === true;
  $('explain-title').textContent = generated ? 'AI-generated explanation' : 'Explanation';
  $('explain-badge').textContent = BADGE[explanation.source] || BADGE.fallback;
  $('explain-badge').className = generated ? 'badge' : 'badge fallback';
  $('explain-text').textContent = explanation.text;
  $('explain').classList.remove('hidden');
}

// The explanation never changes the status box: the status shown is always the deterministic one.
async function onExplain() {
  if (!lastChecked) return;
  const checked = lastChecked;
  const btn = $('explain-btn');
  btn.disabled = true;
  btn.textContent = 'Explaining…';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXPLAIN_TIMEOUT_MS);
  try {
    const { ok, data } = await postJson('/api/explain', checked.request, controller.signal);
    if (!ok) return showError(data.error);
    const same = data.status?.isAvailable === checked.result.isAvailable && data.status?.reasonCode === checked.result.reasonCode;
    if (!same) {
      $('explain').classList.add('hidden');
      return showError('STATUS_CHANGED');
    }
    renderExplanation(data.explanation);
  } catch {
    renderExplanation({ text: 'The explanation is unavailable right now. The status above is still correct.', source: 'fallback' });
  } finally {
    clearTimeout(timer);
    btn.disabled = false;
    btn.textContent = 'Explain availability';
  }
}

async function init() {
  try {
    const res = await fetch('/api/room');
    const room = await res.json();
    roomId = room.id;
    $('room-label').textContent = room.label;
  } catch { /* keep defaults */ }
  $('check-form').addEventListener('submit', onCheck);
  $('explain-btn').addEventListener('click', onExplain);
}

init();
