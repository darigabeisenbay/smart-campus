# AGENTS.md – instructions for coding agents

## Scope
- Keep the project small: **one room, fictional bookings, no login, no database**.
- No new npm dependencies without a written reason in the PR.

## Source of truth
- `src/availability.js` (`checkAvailability`) is the only place that decides availability.
- Do **not** change booking or overlap rules unless the task explicitly asks for it.
  Any change there needs updated tests in `test/availability.test.js`.
- Booking data in `src/data.js` is read-only at runtime.

## Security
- Treat all request bodies as untrusted; validate with `src/validation.js`.
- UI code must render text with `textContent`, never `innerHTML`.
- Never commit secrets. API keys only via environment variables on the server.

## Before you finish
Run and report the result of:
```bash
npm test && npm run lint && npm run build
```
