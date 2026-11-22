# A05 Task 04 – Read-only AI risk review and verification

## How the review was run
- **Assistant:** a separate Claude sub-agent (general-purpose agent in the Claude app's agent harness, same model
  family as the main assistant), started 2026-11-22 ~18:40 (UTC+5).
- **Read-only boundary:** prompt forbade creating/editing/deleting files, state-changing git, network and installs;
  scratch only under `/tmp/a05-review/`. The agent reports it changed nothing; `git status` after the review showed
  only my own file `a05/08-background-agent.md` (written in parallel – see P11). The agent chose not to run
  `npm run build` because it deletes `dist/` – correct under the read-only rule.
- **Context given:** repo path + branch, short description, categories to cover, required fields per finding.
  **Disclosure:** the prompt was meant to contain a pasted copy of AGENTS.md, but the paste failed – the agent
  received the literal placeholder `$(AGENTS)` plus the instruction to read `/home/claude/smart-campus/AGENTS.md`
  and treat it as binding. It reported the failure and read the file from disk. Sub-agents do not load `CLAUDE.md`
  automatically, so the explicit path reference was the only channel.
- Full agent output: `a05/ai-evidence/risk-review-agent-output.md`. My verification script and outputs:
  `a05/evidence/t04-verify*.txt`.

## Classification of the 12 candidates
Confirmed = I reproduced it or read the exact code myself; Plausible/unverified = mechanism real but the
triggering condition could not be checked here; Unsupported = my check contradicts the claim.

| ID | Category | Candidate (short) | Classification | My verification |
|---|---|---|---|---|
| P1 | Correctness | Campus clock follows server time zone | **Confirmed** | `w-timezone.txt`: `TZ=UTC` → 13:37, `TZ=Asia/Qyzylorda` → 18:37; a 15:00 slot today → `AVAILABLE` on a UTC server. `src/time.js:3` comment says the opposite. |
| P2 | Correctness / security | Validator misses paraphrased contradictions | **Confirmed** | `t04-verify.txt`: 4 of 4 agent sentences return `ok:true` (e.g. "…the room is vacant so just walk in"); control sentence rejected. Real-model frequency: unverified. |
| P3 | Maintainability | Validator word list coupled to demo data | **Confirmed** | "…ready for your group." → `INVENTED_DETAIL` because "Group" comes from `BOOKINGS[].holder`. |
| P4 | Correctness | Malformed booking/blocked time silently ignored | **Confirmed** | booking `end:"2026-11-23T10:3"` → `AVAILABLE` (correct data → `OVERLAP`); blocked `end:"2026-11-24 20:00"` → `AVAILABLE`. |
| P5 | Security / cost | Rate limiter wipe resets every counter; proxy shares IP | **Confirmed** (wipe) / **Plausible** (proxy) | limiter `perMinute:2`: `true true false`, after 10,001 other keys `false true` → over-limit client allowed again. No deployment exists, so the proxy part is unverified. |
| P6 | Dependency / operability | Live mode may fail silently (unverified model id / API version) | **Plausible/unverified** (model id) + **Confirmed** (silent) | Silent part: `src/server.js` catch-all has no log, every adapter error → fallback (code read; = my W3). Model id and version header cannot be checked offline. |
| P7 | Agent operations | "Safe" script writes tracked files; `--live` one flag away | **Confirmed** | `git ls-files docs/prompt-eval` lists both outputs; `compare-prompts.mjs:21,60` `writeFileSync`. AGENTS.md §4 called it "offline" without saying it writes files. |
| P8 | Agent operations | Build deletes `dist/` relative to the current folder | **Confirmed** | `t04-verify-p8.txt`: from a temp folder, `node …/scripts/build.mjs` deleted `$T/dist/canary.txt`, then crashed (`ENOENT 'src'`). Agent shells do reset cwd (this session's harness printed "Shell cwd was reset"). |
| P9 | Agent operations | Rules not reliably delivered; misleading docs | **Confirmed** in part | (1) placeholder delivered instead of AGENTS.md – happened; (2) stale `time.js:3` comment – true; (4) README tells to `pip install` while AGENTS.md §4 requires approval – true. **(3) Unsupported:** W5 in `01-baseline.md` correctly describes the *baseline* (`a05-baseline:scripts/ui_scenarios.py:65` did hardcode Chrome); the later fix does not make the baseline record stale. |
| P10 | Agent ops / maintainability | No CI, lint too narrow, no type check | **Confirmed** | `ls .github` → missing; `lint.mjs:30,33` only match `.innerHTML =`, `insertAdjacentHTML`, `console.log`; `tsc` 9 non-strict errors (`baseline-typecheck-nonstrict.txt`). |
| P11 | Agent operations | Several agents write one checkout | **Confirmed** (low impact) | True: I wrote `a05/08-background-agent.md` while the reviewer was reading. No wrong commit resulted (I commit only after review), but its `git status` was not a clean snapshot. |
| P12 | Dependency | `playwright==1.63.0` may not exist; Node 20 unverified; `--no-sandbox` | **Unsupported** (version) / **Plausible** (Node 20) / **Confirmed** (`--no-sandbox`) | `importlib.metadata.version('playwright')` → `1.63.0` – the pinned version exists (it is installed here). Node 20 not available to test. `ui_scenarios.py` passes `--no-sandbox`. |

**Totals:** 12 candidates in 5 categories (correctness, maintainability, security, dependency, agent operations):
9 confirmed (2 with partly plausible sub-claims), 1 plausible/unverified (P6 model id), 2 sub-claims unsupported
(P9-3, P12 version). The agent's own confidence matched my result in 10 of 12; it over-stated P12's install risk and
mis-read a baseline record as stale.
