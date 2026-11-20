# Agent findings vs manual inspection

| Topic | Agent | Manual | Verdict | Fixed in |
|---|---|---|---|---|
| Contradiction phrasings pass ("actually available", "go ahead and use", "open for you") | R1 High | – (missed) | Confirmed by repro | `validateExplanation.js` status check rewritten (strip allowed negations, then reject any positive/negative status word) |
| Booking-action claims pass ("is now confirmed", "I've cancelled") | R2 Medium | – (missed) | Confirmed | blanket ban on confirm/cancel/reserv* + first-person action verbs |
| Real holder name passes via room-label exemption ("Study Group 7"), outside names ("Dr. Smith") | R3 Medium | – (missed) | Confirmed | strip exact room label first, ban actor phrases ("held by", "because of"), titles, stray numbers |
| Zero-width / soft-hyphen characters hide forbidden words | R4 Medium | – (missed) | Confirmed | NFKC + printable-character allowlist |
| ISO date-time (`2026-11-23T12:30`) bypasses invented time/date checks | – (missed) | M1 High | Confirmed | digit look-arounds instead of `\b` |
| Other rooms in lower case / "room 202" | – (missed) | M2 Medium | Confirmed | case-insensitive room check + stray-number rule |
| False rejections of correct phrasing; "e.g." counted as sentence end | R5 Low | M5 Low (partly) | Agreed | negations stripped before the AVAILABLE check; abbreviations ignored in sentence count |
| Unbounded timeout; work continues after client disconnects | R6 Low-Medium | – (missed) | Confirmed (agent repro: connection still open after abort) | timeout clamped to 500–7000 ms; `res.on('close')` aborts the model call |
| Fenced JSON (```json) rejected | R7 Low | – | Agreed | single surrounding fence stripped, one-key check kept |
| No rate limit / cache / concurrency cap for paid calls | R8 Medium | M3 Medium | Both found | per-IP limit (live mode), LRU cache of validated outputs, in-flight cap |
| Prompt-eval evidence simulated; "3 runs" comment wrong | R9 Low | – (I disclosed the simulation, missed the comment) | Agreed | comment fixed; limitation stated in report |
| Mock / off labelling | R10 Info | – | Agreed | mock = "Generated explanation (mock model)"; off = "Standard explanation" |
| Adversarial test coverage | R11 Info | – | Agreed | all reproductions added as tests |
| Upstream body read without size cap | – | M4 Low | Manual only | 20 KB cap |
| 404 without security headers; Content-Type not checked | – | M6 Low | Manual only | headers on all responses; non-JSON POST → 415 |

**Summary.** The agent found 11 issues, I found 6; 2 overlapped (rate limiting, false rejections). The agent was much
stronger on adversarial phrasing of model output (R1–R4: it tried paraphrases I didn't), and it ran a runtime
experiment for the timeout. I found the ISO date-time bypass and the case-insensitive room bypass, which the agent
missed although it reviewed the same validator. Both reviews together were needed: neither alone covered AC2.
No agent finding was a false positive; R8 was marked "Unverified at runtime" by the agent and is real by code reading.
