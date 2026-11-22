# A05 Task 01 – Baseline and context

Repository: Smart Campus Room Availability Checker (Node.js, zero npm dependencies, ~1,600 lines incl. tests).
Baseline: tag `a05-baseline` = commit `70e8613` (main after the "Explain availability" feature).
Work branch: `assignment-05`. Environment: Node v22.23.5, Linux, no network, no API key.

## Repository map

| Kind | Path | Notes |
|---|---|---|
| Entry point | `src/server.js` (`npm start`) | `node:http` server, static UI + `GET /api/room`, `POST /api/availability`, `POST /api/explain` |
| Domain logic | `src/availability.js` | `checkAvailability()` – deterministic rules, source of truth |
| Domain data | `src/data.js` | one room, 3 fictional bookings, 1 blocked period (frozen) |
| Helpers | `src/time.js`, `src/validation.js` | clock + date parsing; request validation |
| LLM feature | `src/explain/{adapter,prompts,validateExplanation,fallback}.js` | mock/live/off adapter, output validator, deterministic fallback |
| UI | `public/{index.html,app.js,styles.css}` | vanilla JS, `textContent` only |
| Tests | `test/*.test.js` (7 files) | `node:test`, unit + HTTP integration |
| Build / lint | `scripts/build.mjs`, `scripts/lint.mjs` | copy to `dist/` + module smoke check; custom zero-dep lint |
| Other scripts | `scripts/compare-prompts.mjs`, `scripts/ui_scenarios.py` | prompt scoring; Playwright UI scenarios |
| Dependencies | none in `package.json`; `ui_scenarios.py` needs Python `playwright` + Chrome | |
| Docs | `README.md`, `AGENTS.md`, `docs/` | |

## Commands and actual results (baseline)

| Command | Result | Evidence |
|---|---|---|
| `npm test` | 61 tests, 61 pass, 0 fail, exit 0 | `a05/evidence/baseline-test.txt` |
| `node --test test/acceptance.test.js` | 4/4 pass (new A05 AC tests, run before any source change) | `baseline-acceptance.txt` |
| `npm run lint` | OK, 19 files, 0 problems, exit 0 | `baseline-lint.txt` |
| `npm run build` | OK, 9 modules verified, exit 0 | `baseline-build.txt` |
| `tsc --noEmit --allowJs --checkJs … src/server.js` (strict, TS 6 default) | **85 errors**, exit 1 | `baseline-typecheck.txt` |
| same with `--strict false` | **9 errors** (wrong/stale JSDoc contracts) | `baseline-typecheck-nonstrict.txt` |
| secret scan `git grep -nE "(sk-ant-…|password\s*[:=])" $(git rev-list --all)` | 1 hit: test fixture `'sk-ant-SECRET-123'` in `test/server.test.js:99` (fake key used to prove non-leakage) | `baseline-secret-scan.txt` |

## Weaknesses (observed, with evidence)

| ID | Weakness | Evidence |
|---|---|---|
| W1 | Clock depends on the **server's time zone**: `nowLocal()` uses `getHours()`; campus is UTC+5 | `TZ=UTC` → `2026-11-22T13:37`, `TZ=Asia/Qyzylorda` → `2026-11-22T18:37`; on a UTC server a 15:00 slot today is `AVAILABLE` although it is 18:37 on campus (`w-timezone.txt`) |
| W2 | **No type check** in the pipeline; JSDoc contracts are stale | non-strict `tsc` finds 9 errors, e.g. `adapter.js(186)`: string passed where `number` documented; `server.js(100)`: `signal` missing from options type |
| W3 | **Errors are swallowed without logging** | `src/server.js:147` `catch { return sendJson(res, 500, …) }` – no log line; lint rule forbids `console.log` in `src/` and there is no logger |
| W4 | **No CI**: checks run only by hand | `ls .github` → No such file or directory |
| W5 | **E2E script is not reproducible from the README** | `scripts/ui_scenarios.py:65` hardcodes `/usr/bin/google-chrome`, ports 3101–3105; Python `playwright` not pinned (no `requirements*.txt`); README never mentions it (`grep` empty) |

## Facts vs assumptions vs unverified AI suggestions

- **Observed facts:** everything in the two tables above (commands were run; outputs saved).
- **Assumptions (not verified):** Node 20 support claimed by `package.json` `engines >=20` and README – only Node 22 was available and tested. Live LLM mode works against the real API – never executed (no network/key); model id `claude-haiku-5-5` unverified.
- **Unverified AI suggestions:** none accepted at this stage; AI-proposed risks are handled in Task 04 and classified there.

## Acceptance criteria (must remain true after changes)

| ID | Criterion | Check |
|---|---|---|
| A05-AC1 | Booking decisions for 7 golden scenarios (available, overlap, back-to-back, blocked, invalid, past, outside hours) are unchanged | `test/acceptance.test.js` |
| A05-AC2 | `/api/explain` returns exactly the `/api/availability` status (the LLM never changes availability) | `test/acceptance.test.js` |
| A05-AC3 | Empty, malformed and overly long input → HTTP 400 | `test/acceptance.test.js` |
| A05-AC4 | Model timeout, error, missing key → deterministic fallback, HTTP 200, same status | `test/acceptance.test.js` |
| A05-AC5 | `npm test && npm run lint && npm run build` pass offline with no API key | commands |
