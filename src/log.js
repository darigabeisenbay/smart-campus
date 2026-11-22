// Minimal structured logger (risk R02): one JSON line per event on stderr.
// Privacy by construction: only allowlisted field names are written, and values are reduced to short
// identifier-like strings, so request bodies, explanations, times and keys cannot end up in the log.

const ALLOWED_FIELDS = Object.freeze(['reason', 'mode', 'route', 'error', 'status']);
const LEVELS = Object.freeze({ silent: 0, error: 1, warn: 2, info: 3 });

const safeValue = (v) => String(v).replace(/[^A-Za-z0-9_./-]+/g, '_').slice(0, 64);

/**
 * @param {{ level?: string, sink?: (line: string) => void, now?: () => string }} [options]
 */
export function createLogger({
  level = 'info',
  sink = (line) => process.stderr.write(`${line}\n`),
  now = () => new Date().toISOString()
} = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;
  const write = (lvl) => (event, fields = {}) => {
    if (LEVELS[lvl] > threshold) return;
    const entry = { ts: now(), level: lvl, event: safeValue(event) };
    for (const key of ALLOWED_FIELDS) if (fields[key] !== undefined && fields[key] !== null) entry[key] = safeValue(fields[key]);
    sink(JSON.stringify(entry));
  };
  return Object.freeze({ error: write('error'), warn: write('warn'), info: write('info') });
}

/** Logger that drops everything – the default for createServer() in tests and embedding code. */
export const silentLogger = createLogger({ level: 'silent', sink: () => {} });
