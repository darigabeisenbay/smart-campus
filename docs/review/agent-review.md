# Agentic code review – "Explain availability"

Reviewer: separate Claude sub-agent (general-purpose), read-only.
Given: the diff `checkpoint-baseline-green..HEAD` (src, public, test, AGENTS.md, README.md), README.md, AGENTS.md,
docs/FEATURE_SPEC.md, AC1–AC5 and the course constraints. Asked for correctness / security / quality / performance,
each finding with evidence, severity and verification steps. Scratch scripts: `docs/review/repro/`.

Agent ran: `npm test` (45/45), `npm run lint` (0 problems), Node experiments.

## AC verdicts (agent)

| AC | Verdict | Evidence (agent) |
|---|---|---|
| AC1 | Met | `git diff --stat checkpoint-baseline-green HEAD -- src/availability.js src/validation.js src/time.js src/data.js test/availability.test.js test/validation.test.js` empty; baseline tests pass |
| AC2 | Partially met | status always from `checkAvailability()`; but explanation text can contradict status / contain invented details and still validate (R1–R4) |
| AC3 | Met | HTTP probes: `''`, `{`, `[]`, empty fields, 40-char field, 5000-byte body, extra `isAvailable` → all 400, model never called |
| AC4 | Met, with one config gap | `withTimeout` races even if model ignores abort; all failure classes map to fallback; timeout unbounded and not cancelled on client disconnect (R6) |
| AC5 | Mostly met | separate sections, badge, disclaimer, textContent; weakened by R2 ("Your booking is now confirmed") and R10 |

## Findings

| ID | Area | Severity | File | Finding | Evidence (agent repro) | Verification proposed |
|---|---|---|---|---|---|---|
| R1 | Correctness | High | validateExplanation.js:17,51 | `CLAIMS_AVAILABLE` only catches "is (currently) available" | OVERLAP facts → `ok:true` for "…but the room is actually available to you." / "…so go ahead and use the room anyway." / "…yet Room A-101 is open for you then." | table-driven test of ≥ 20 paraphrases → `CONTRADICTS_STATUS` |
| R2 | Security / Correctness | Medium | validateExplanation.js:20-24 | `CLAIMS_ACTION` misses "is now confirmed", "I've cancelled" | both `ok:true` | add both + "I'll reserve it", "The reservation is now in place" |
| R3 | Correctness / Security | Medium | validateExplanation.js:28-32, 66-69 | room-label exemption lets real holder name through; denylist cannot catch unknown names | "…held by Study Group 7." → `ok:true`; "…made by Dr. Smith for a workshop." → `ok:true` | tests for "held by Study Group 7", "made by Dr. Smith", "booked by the chess team" |
| R4 | Security | Medium | validateExplanation.js:42 | invisible Unicode defeats keyword checks | "The room is av​ailable: …" (isAvailable:false) → `ok:true` | zero-width + soft hyphen → `FORBIDDEN_FORMAT` |
| R5 | Quality | Low | validateExplanation.js:18, 36-38 | false rejections of correct phrasing; "e.g."/"Dr." counted as sentence ends | "…is free … and no booking overlaps it." → `CONTRADICTS_STATUS`; `countSentences('A is free, e.g. now. B. ')` = 3 | accept those for AVAILABLE; `countSentences('e.g. this works.') === 1` |
| R6 | Performance / AC4 | Low-Medium | adapter.js:106, server.js:79-96 | timeout unbounded, not cancelled on client disconnect | `LLM_TIMEOUT_MS=600000`, client aborted at 300 ms → server still had 1 open connection until killed at 20 s | clamp test; client-abort test sees `signal.aborted` |
| R7 | Quality | Low | adapter.js:30-40 | fenced JSON rejected | live stub returning ```json fence → `INVALID_OUTPUT` | fenced JSON parses, prose still invalid |
| R8 | Performance / Security | Medium (unverified at runtime) | server.js:108-111, adapter.js:125-136 | no rate limit, cache or concurrency cap on paid calls | code reading | 20 identical requests → 1 call; 11th request/min → fallback |
| R9 | Quality | Low | results.md:1, compare-prompts.mjs:3,17-18 | eval outputs simulated; header says "3 runs" but loop runs once | code + file | `--live` run, note starts "Live run" |
| R10 | Quality (AC5) | Info | server.js:91, app.js:21,65 | mock text titled "AI-generated"; off mode looks like an error | code | UI runner checks titles/badges per mode |
| R11 | Quality | Info | test/explain.validate.test.js:26-54 | tests only use phrasings the regexes were written for | – | adversarial paraphrase tables |

## Positive observations (agent)
- Status recomputed server-side; extra client fields rejected; UI refuses to show an explanation if the status changed.
- `withTimeout` works even when the model ignores abort (tested).
- Model never sees user text; prompt C says FACTS are data.
- textContent-only rendering + strict CSP → a validator bypass cannot become XSS.
- AGENTS.md / README document modes, env vars and invariants.
