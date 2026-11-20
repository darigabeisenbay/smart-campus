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
  UNKNOWN_ROOM: 'Unknown room.'
};

let roomId = 'A-101';

function showError(code) {
  $('error').textContent = ERROR_TEXT[code] || 'Something went wrong. Please try again.';
  $('error').classList.remove('hidden');
}

function clearOutput() {
  $('error').classList.add('hidden');
  $('status').classList.add('hidden');
}

async function postJson(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
}

async function init() {
  try {
    const res = await fetch('/api/room');
    const room = await res.json();
    roomId = room.id;
    $('room-label').textContent = room.label;
  } catch { /* keep defaults */ }
  $('check-form').addEventListener('submit', onCheck);
}

init();
