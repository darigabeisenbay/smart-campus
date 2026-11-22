# A05 Task 06 – Agent-readiness audit

Levels: **1 Baseline** (code runs, little guidance) · **2 Documented** (accurate docs, reproducible checks, agent
instructions with boundaries) · **3 Agent-ready** (level 2 + gates enforced automatically, pinned/verified
environment, safe-listed commands are actually safe, no open agent-operations risks above score 3).

| Criterion | Baseline (`a05-baseline`) | Final (`a05-final`) | Evidence |
|---|---|---|---|
| Readable structure | Yes – small modules, clear names | Yes; reason knowledge in one catalog | repo map (`01-baseline.md`), `03-pattern-decision.md` |
| README accuracy | Partly – claimed Node 20, no E2E prerequisites, "pins clock for tests" | Accurate: Node 22 tested / 20 unverified, E2E steps, all env vars incl. `CAMPUS_TZ`, `LOG_LEVEL` | README diff |
| Reproducible setup | Node only, zero deps; E2E hard-coded Chrome path | Zero deps; `requirements-dev.txt` pins `playwright==1.63.0`; `CHROME_PATH` | `requirements-dev.txt` |
| Pinned dependencies | n/a npm; Python unpinned; Node version not pinned | npm n/a; Python pinned (no hashes); Node not pinned (`engines >=20`) | R14 |
| Tests | 61, offline | 78, offline, TZ-independent, explicit AC tests | `final-check.txt`, `final-test-timezones.txt` |
| Lint / type checks | Custom lint OK; no type check (9 non-strict errors) | Lint OK; type check still not in pipeline (9 errors) | R11 |
| Build command | Yes | Yes; `npm run check` aggregates | `final-check.txt` |
| Logging | None | Structured allowlist logger for fallbacks/500s | M2 |
| Security safeguards | Input validation, CSP, nosniff, key server-side, rate limit, output validator | Same + campus clock fixed; limiter wipe (R06) and validator paraphrase gap (R07) open | register |
| AGENTS.md – permissions & safe commands | Commands listed; no permission model | Safe-command table, "anything else: ask" | `AGENTS.md` §4 |
| AGENTS.md – prohibited actions | Only "no secrets", "don't change rules" | Secrets, deployment, destructive git/rm, dependencies, rules, paid API, real data | §5 |
| AGENTS.md – review gates | "run test/lint/build" | 4 gates incl. human approval for sensitive files, no agent merge/deploy | §8 |
| Instruction delivery | AGENTS.md only (Claude Code would not load it) | `CLAUDE.md` imports `@AGENTS.md` (documented Claude Code mechanism); sub-agents still need explicit paste | R03 |
| CI / automated gates | None | None | R08 |

## Level
- **Baseline: Level 2 – Documented (weak).** README and AGENTS.md existed and checks were reproducible, but
  AGENTS.md had no forbidden-action list, permissions or review gates, and README had inaccuracies.
- **Final: Level 2 – Documented (strong). Not Level 3.**

Why not 3 (missing evidence):
1. No CI: gates in AGENTS.md §8 are enforced by people only (R08).
2. A safe-listed command is not safe: `npm run build` via `node scripts/build.mjs` from another folder deletes that
   folder's `dist/` (R04, reproduced); `compare-prompts.mjs` writes tracked files (R05).
3. Instruction delivery to sub-agents/other tools still depends on manual pasting (R03; it failed once in this work).
4. No type check gate (9 errors) and Node version not pinned/verified.
5. Live-mode behaviour never verified against the real API (R09).
