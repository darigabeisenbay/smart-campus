# Manual inspection (written before reading the agent review)

Scope: `git diff checkpoint-baseline-green HEAD` (13 files, +727/−5) against AC1–AC5.

| ID | Area | Severity | File | Finding | Evidence |
|---|---|---|---|---|---|
| M1 | Correctness / AC2 | High | `src/explain/validateExplanation.js` (time/date regex) | Invented times/dates written as an ISO date-time (`2026-11-23T12:30`) bypass `INVENTED_TIME` and `INVENTED_DATE`, because `\b` does not match between `3T1` (all word chars). | `validateExplanation('It overlaps an existing booking that runs until 2026-11-23T12:30.', overlapFacts)` → `{ ok: true }` |
| M2 | Correctness / AC2 | Medium | `validateExplanation.js` (room regex) | Other rooms in lower case (`b-202`) or as `room 202` are not detected. | both calls returned `{ ok: true }` |
| M3 | Security / Performance | Medium | `src/server.js` `/api/explain` | No rate limit and no cache: in `live` mode every click is a paid API call; a script can burn the API budget. | code has no throttling; identical facts re-call the model |
| M4 | Performance | Low | `src/explain/adapter.js` `createLiveModel` | Upstream body read with `res.json()` without a size cap (only the extracted text is capped at 4000 chars). | code inspection |
| M5 | Quality | Low | `validateExplanation.js` | Keyword heuristics produce false rejections, e.g. "free … does not overlap any booking" → `CONTRADICTS_STATUS`. Safe direction (falls back), accepted trade-off. | probe returned `CONTRADICTS_STATUS` |
| M6 | Quality | Low | `src/server.js` | 404 responses skip the security headers; `Content-Type` of POST bodies is not checked. | code inspection |

AC status from manual inspection: AC1 met (checker/data unchanged, baseline tests pass); AC2 **partially** – M1/M2;
AC3 met; AC4 met; AC5 met (separate labelled panels, badge, disclaimer).
