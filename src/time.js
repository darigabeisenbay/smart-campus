// Campus-local time helpers. Values are naive "YYYY-MM-DDTHH:MM" strings.
// toMinutes() uses UTC arithmetic on those strings, so comparing two campus times never depends on the
// server's time zone; nowLocal() converts the real clock into the campus zone explicitly.

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

export const DEFAULT_CAMPUS_TZ = 'Asia/Qyzylorda';

/** Returns the configured campus IANA time zone; throws RangeError if it is unknown. */
export function campusTimeZone(env = process.env) {
  const tz = env.CAMPUS_TZ || DEFAULT_CAMPUS_TZ;
  new Intl.DateTimeFormat('en', { timeZone: tz }); // throws RangeError for an invalid zone
  return tz;
}

/**
 * Current campus-local time as "YYYY-MM-DDTHH:MM", computed in the campus time zone (CAMPUS_TZ,
 * default Asia/Qyzylorda) – independent of the server's own TZ (risk R01).
 * SMART_CAMPUS_NOW pins it for demos and tests. An unknown CAMPUS_TZ throws RangeError (fail loudly).
 * @param {Record<string, string | undefined>} [env]
 * @param {Date} [date]
 * @returns {string}
 */
export function nowLocal(env = process.env, date = new Date()) {
  if (env.SMART_CAMPUS_NOW && isLocalDateTime(env.SMART_CAMPUS_NOW)) return env.SMART_CAMPUS_NOW;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: campusTimeZone(env),
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(date).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
