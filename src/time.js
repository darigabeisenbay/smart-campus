// Campus-local time helpers. Values are naive "YYYY-MM-DDTHH:MM" strings;
// we convert them to minutes since epoch using UTC arithmetic so the result
// never depends on the server's time zone.

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** Returns minutes since epoch, or null when the string is not a real date-time. */
export function toMinutes(value) {
  if (typeof value !== 'string') return null;
  const m = LOCAL_DATETIME.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;
  const ms = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d) return null;
  return ms / 60000;
}

export function isLocalDateTime(value) {
  return toMinutes(value) !== null;
}

/** Current campus-local time; SMART_CAMPUS_NOW pins it for demos and tests. */
export function nowLocal(env = process.env) {
  if (env.SMART_CAMPUS_NOW && isLocalDateTime(env.SMART_CAMPUS_NOW)) return env.SMART_CAMPUS_NOW;
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
