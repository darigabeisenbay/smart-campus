import { createServer } from '../../../src/server.js';
const env = { SMART_CAMPUS_NOW: '2026-11-20T09:00', LLM_MODE: 'mock', LLM_MOCK_BEHAVIOR: 'timeout', LLM_TIMEOUT_MS: '600000' };
const srv = createServer({ env }).listen(0);
await new Promise(r => srv.on('listening', r));
const url = `http://127.0.0.1:${srv.address().port}`;
const body = JSON.stringify({ roomId: 'A-101', start: '2026-11-23T11:00', end: '2026-11-23T12:00' });
const c = new AbortController(); setTimeout(() => c.abort(), 300);
try { await fetch(url + '/api/explain', { method: 'POST', body, signal: c.signal }); } catch (e) { console.log('client aborted:', e.name); }
await new Promise(r => setTimeout(r, 200));
console.log('server open connections after client abort:', await new Promise(r => srv.getConnections((e, n) => r(n))));
// AC3 cases
for (const b of ['', '{', '[]', '{"roomId":"A-101","start":"","end":""}', JSON.stringify({ roomId: 'A-101', start: 'x'.repeat(40), end: 'y' }), 'a'.repeat(5000), JSON.stringify({ roomId: 'A-101', start: '2026-11-23T11:00', end: '2026-11-23T12:00', isAvailable: true })]) {
  const r = await fetch(url + '/api/explain', { method: 'POST', body: b });
  console.log(r.status, await r.text(), '<=', b.slice(0, 40));
}
srv.closeAllConnections(); srv.close();
