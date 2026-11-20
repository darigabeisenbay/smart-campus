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

## Project map

- `src/availability.js` – deterministic availability function `checkAvailability()`
- `src/validation.js` – request validation (empty / malformed / too long / unknown room)
- `src/data.js` – the single room, fictional bookings and blocked periods
- `src/server.js` – HTTP server and JSON API
- `public/` – UI component (`index.html`, `app.js`, `styles.css`)
- `AGENTS.md` – instructions for coding agents
