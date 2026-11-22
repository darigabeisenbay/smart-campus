# A05 Task 05 – Risk register (before mitigation)

Scale: likelihood L 1 = unlikely / 2 = possible / 3 = likely or already observed; impact I 1 = minor / 2 = degraded
feature or wasted work / 3 = wrong booking decision or data loss. Score = L × I. Scores are mine (they differ from the
agent's where my verification changed the picture). Owner = repository maintainer (the student) unless noted.
Only confirmed items carry execution evidence; nothing below is invented.

| ID | Src | Category | Cause → event → consequence | Component | Evidence | Status | L | I | Score | Mitigation | Owner | Verification plan | Residual risk |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| R01 | W1, P1 | Correctness | clock from server-local getters → server not in UTC+5 (UTC containers are default) → past slots `AVAILABLE`, future slots `PAST_TIME` | `src/time.js` `nowLocal()` | `w-timezone.txt` | Confirmed | 3 | 3 | **9** | compute campus time with `Intl` in a configured `CAMPUS_TZ` (default `Asia/Qyzylorda`); fail fast on invalid zone | maintainer | test with fixed instant under `TZ=UTC` and `TZ=Pacific/Kiritimati`; full suite in 3 zones | wrong `CAMPUS_TZ` config; host clock drift |
| R02 | W3, P6 | Maintainability / operability | no logger, catch-all and fallbacks unlogged → API errors, wrong model id or bugs → feature silently degrades, 500s untraceable | `src/server.js` catch; `adapter.explain` fallbacks | `server.js:147`; code read | Confirmed (silence); model id plausible | 3 | 2 | **6** | minimal structured JSON-line logger: `explain.fallback {reason, mode}` and `server.error {route, error}`; never bodies, explanations or keys | maintainer | tests capture log sink: timeout → one fallback line; thrown error → 500 + `server.error`; key and request text never in log | no alerting/metrics; model id still unverified |
| R03 | P9 | Agent operations | rules only via CLAUDE.md import or manual paste → sub-agent/other tool works without rules or with stale docs → forbidden action / wrong fix | AGENTS.md, CLAUDE.md, `time.js:3` | placeholder incident; stale comment; README vs AGENTS | Confirmed | 3 | 2 | 6 | require agents to echo a rule ID at start; fix stale comment; mark E2E install as "needs approval" | maintainer | next agent run: check echoed rule | tools that ignore both files |
| R04 | P8 | Agent operations | `rmSync('dist')` relative to cwd → agent runs script from another folder → deletes that folder's `dist/` | `scripts/build.mjs:6` | `t04-verify-p8.txt` (canary deleted) | Confirmed | 2 | 2 | 4 | resolve paths from `import.meta.url` | maintainer | run from temp dir: canary survives | – |
| R05 | P7 | Agent operations / cost | "safe" script writes tracked evidence; `--live` spends money if key set | `scripts/compare-prompts.mjs` | `git ls-files`; lines 21, 60 | Confirmed | 2 | 2 | 4 | AGENTS.md: mark as file-writing; require `ALLOW_PAID_CALLS=1` for `--live` | maintainer | run without opt-in → refuses | – |
| R06 | P5 | Security / cost | limiter wipes all counters at > 10,000 keys → attacker rotates IPs → unlimited paid calls | `src/server.js` `createRateLimiter` | `t04-verify.txt` (`false true`) | Confirmed (proxy part plausible) | 2 | 2 | 4 | evict oldest window only; global daily budget | maintainer | test: over-limit client stays limited after 10,001 keys | live mode not deployed today |
| R07 | P2 | Correctness / security | keyword validator → model paraphrases a contradiction → student told to use a booked room | `validateExplanation.js` | 4 bypass sentences `ok:true` | Confirmed (bypass); frequency unverified | 2 | 2 | 4 | server-side template for the status clause; model writes only the reason clause | maintainer | adversarial sentence table | heuristic validation never complete |
| R08 | W4, P10 | Maintainability / agent ops | no CI, narrow lint → unchecked merges | repo, `scripts/lint.mjs` | `ls .github`; lint.mjs:30,33 | Confirmed | 2 | 2 | 4 | CI job `npm run check`; widen lint patterns | maintainer | CI run on PR | – |
| R09 | P6 | Dependency | model id `claude-haiku-5-5` / API version never exercised → live mode broken on day one | `adapter.js` | not verifiable offline | Plausible/unverified | 2 | 2 | 4 | one approved live smoke test | maintainer | smoke test log | – |
| R10 | P4 | Correctness | malformed time in data parses to `null` → booking ignored → double booking shown free | `availability.js` + `data.js` | `t04-verify.txt` | Confirmed | 1 | 3 | 3 | validate data at load / in a test | maintainer | data test fails on bad time | – |
| R11 | W2 | Maintainability | no type check → stale JSDoc contracts mislead agents/humans | `src/**` | 9 non-strict `tsc` errors | Confirmed | 2 | 1 | 2 | fix JSDoc, add optional `typecheck` script | maintainer | `tsc` 0 errors | – |
| R12 | P3 | Maintainability | validator word list from demo data → harmless words rejected | `validateExplanation.js` | "…your group." rejected | Confirmed | 2 | 1 | 2 | separate deny-list from data | maintainer | phrasing test | – |
| R13 | P11 | Agent operations | shared checkout for concurrent agents → mixed evidence | working tree | untracked file mid-review | Confirmed | 2 | 1 | 2 | worktree per agent (see Task 08) | maintainer | `git status` at start/end of agent report | – |
| R14 | P12 | Dependency | Node 20 untested; E2E Chrome `--no-sandbox` | `package.json`, `ui_scenarios.py` | engines `>=20`; flag in code | Plausible (Node 20) / Confirmed (flag) | 1 | 2 | 2 | narrow `engines` to `>=22` or test 20 | maintainer | run on Node 20 | dev-only script |
| – | P12 | Dependency | "playwright 1.63.0 may not exist" | – | installed version 1.63.0 | **Unsupported** | – | – | – | none | – | – | – |
| – | P9-3 | Agent operations | "baseline record W5 is stale" | – | baseline file did hardcode Chrome | **Unsupported** | – | – | – | none | – | – | – |

## Top two confirmed risks for corrective action
1. **R01 – campus clock follows the server time zone (score 9).** The only risk that makes the *source of truth*
   give a wrong answer in a normal deployment.
2. **R02 – failures are silent (score 6).** Tied with R03 at 6. Chosen over R03 because it affects the running product
   (every live-mode failure and every 500 is invisible today), and its fix can be verified by automated tests; R03's
   mitigation is a process rule that no test can prove. R03 keeps an owner and stays first in line.
