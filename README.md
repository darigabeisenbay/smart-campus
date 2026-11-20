# Smart Campus – Room Availability Checker

Small teaching project: one room, fictional bookings, no login, no database.

## Run

```bash
npm start            # http://localhost:3000
npm test             # node:test unit + integration tests
npm run lint         # zero-dependency lint (scripts/lint.mjs)
npm run build        # copies to dist/ and verifies modules load
```

Requires Node.js 20+. There are no npm dependencies.

Set `SMART_CAMPUS_NOW=2026-11-20T09:00` to pin the clock for demos and tests.

## Booking rules (source of truth: `src/availability.js`)

| Rule | Reason code |
|---|---|
| Start/end must be real `YYYY-MM-DDTHH:MM` values, end after start, same day, max 4 h | `INVALID_TIME` |
| Start must not be in the past | `PAST_TIME` |
| Within opening hours 08:00–20:00 | `OUTSIDE_OPENING_HOURS` |
| Not inside a blocked period (maintenance) | `ROOM_BLOCKED` |
| No overlap with an existing booking (half-open intervals, back-to-back allowed) | `OVERLAP` |
| Otherwise | `AVAILABLE` |

## "Explain availability" (optional LLM feature)

After a check, the student can press **Explain availability**. The server re-runs the checker, sends only
`room, start, end, isAvailable, reasonCode` to the LLM adapter and validates the answer. The status itself is never
produced or changed by the model. See `docs/FEATURE_SPEC.md`.

| Env var | Default | Meaning |
|---|---|---|
| `LLM_MODE` | `mock` | `mock` (free, offline), `live` (Anthropic API), `off` (always deterministic text) |
| `ANTHROPIC_API_KEY` | – | server-side only; missing key → fallback |
| `LLM_MODEL` | `claude-haiku-5-5` | model for live mode |
| `LLM_TIMEOUT_MS` | `4000` | adapter timeout, clamped to 500–7000 ms (below the browser's 8 s) |
| `EXPLAIN_RATE_LIMIT_PER_MIN` | `10` | per-IP limit on explain calls in live mode |
| `LLM_PROMPT_VARIANT` | `C` | prompt A/B/C (see `docs/prompt-eval/`) |
| `LLM_MOCK_BEHAVIOR` | `ok` | demo failures: `timeout`, `error`, `invalid`, `contradict`, `invent` |

```bash
node scripts/compare-prompts.mjs          # score prompts A/B/C on recorded outputs
node scripts/compare-prompts.mjs --live   # regenerate with the real API (needs key)
```

## Project map

- `src/availability.js` – deterministic availability function `checkAvailability()`
- `src/validation.js` – request validation (empty / malformed / too long / unknown room)
- `src/data.js` – the single room, fictional bookings and blocked periods
- `src/server.js` – HTTP server and JSON API
- `public/` – UI component (`index.html`, `app.js`, `styles.css`)
- `src/explain/` – LLM adapter, prompts, output validation, deterministic fallback
- `AGENTS.md` – instructions for coding agents
