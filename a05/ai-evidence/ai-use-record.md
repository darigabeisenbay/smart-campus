# AI-use record and evidence appendix

**AI assistant used:** Claude (Anthropic) – model Claude Opus 5.5, in the Claude app's agent workspace (file tools,
shell, sub-agents). Read-only risk review: a Claude sub-agent (general-purpose) started by the main assistant.
Date of all work: 2026-11-22 (UTC+5). No other AI tools were used.

| # | Tool / date | Prompt summary | Output used | Problems found in the AI output | Changes made by the human-review step | Verification source |
|---|---|---|---|---|---|---|
| 1 | Claude main, 2026-11-22 | "Do all tasks of Assignment #05 and provide what the submission details require" + assignment PDF; chose the existing Smart Campus repo | Repo map, command runs, weakness list W1–W5 | W5 described the E2E script; README claim of Node 20 support could not be checked | Node 20 recorded as *assumption*, not fact | `a05/evidence/baseline-*.txt`, `w-timezone.txt` |
| 2 | Claude main | Draft AGENTS.md with purpose, architecture, setup, safe commands, conventions, tests, forbidden actions, review gates | `AGENTS.md`, `CLAUDE.md` (`@AGENTS.md`) | First draft referenced things that did not exist yet (`src/log.js`, `src/reasons.js`, a `typecheck` script) | Removed until implemented; re-added when real. Import syntax checked against Claude Code docs | code.claude.com/docs/en/memory (CLAUDE.md `@path` import; "Claude Code reads CLAUDE.md, not AGENTS.md") |
| 3 | Claude main | Evaluate Strategy / Adapter / none for duplicated reason-code tables; implement at most one | `src/reasons.js` catalog + `test/reasons.test.js` | Strategy classes and an Adapter for a second provider were over-engineering for 6 data records | Chose a table-driven catalog; rejected the class-based variant | `pattern-before.txt` vs `pattern-after.txt`; `after-pattern-check.txt` 68/68; `after-pattern-ui.txt` 13/13 |
| 4 | Claude sub-agent (read-only), ~18:40 | "STRICTLY READ-ONLY … propose 8–12 candidate risks across correctness, maintainability, security, dependency, agent operations, with evidence / confidence / L×I" | 12 candidates P1–P12 (`risk-review-agent-output.md`) | AGENTS.md paste failed (placeholder `$(AGENTS)` – my prompt error); P12 "version may not exist" unsupported; P9-3 mis-read a baseline record as stale; L×I sometimes differed from mine | Every candidate re-verified and classified; my own scores used in the register | `t04-verify.mjs` + `t04-verify*.txt` (re-ran P2–P5, P8 in a temp folder, P7, P9, P10, P12) |
| 5 | Claude main | Propose minimal fix for R01 (campus clock) with a test first | `src/time.js`, `test/clock.test.js` | Proposed fail-fast check was skipped when the clock is pinned | Added `campusTimeZone()` + test; probed midnight | `m1-before.txt` (3 fail), `m1-review.txt`, `m1-after.txt` (5/5; 73/73 in 3 TZs) |
| 6 | Claude main | Propose minimal fix for R02 (silent failures) with a test first | `src/log.js`, server wiring, `test/logging.test.js` | Logged `DISABLED` on every request (noise); introduced one new `tsc` error | Excluded `DISABLED` + test; type guard added (back to 9 baseline errors) | `m2-before.txt`, `m2-after.txt` (5/5), manual `curl` smoke run, `final-typecheck-nonstrict.txt` |
| 7 | Claude main | Readiness audit, release decision, background-agent design, reflection, report | `a05/06…10*.md`, report document | First draft of the decision said "CONDITIONAL GO" (not one of the allowed labels) | Changed to "CONDITIONAL" | assignment PDF, `final-check.txt`, risk register |

## Human verification summary
- Every command result in the report comes from a saved log in `a05/evidence/`; no result was typed by hand.
- Every AI-proposed risk was re-run or re-read before classification; 2 sub-claims were rejected as unsupported.
- Both mitigation diffs were reviewed before acceptance; each review changed the diff (see rows 5–6).
- Not executed and not claimed: live LLM API, Node 20, CI, strict type check.

> Note for the submitting student: rows above describe checks run in this AI-assisted session. Before submitting,
> re-run `npm run check` and `node --test test/acceptance.test.js` yourself and confirm the reflection matches
> your own experience.
