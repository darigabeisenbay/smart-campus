# A05 Task 03 – Focused pattern decision

## Problem (maintainability, duplicated conditionals)
Knowledge about the 6 reason codes was spread over **5 parallel tables / switches** outside the rule engine
(`a05/evidence/pattern-before.txt`: 6 mentions each in `adapter.js` (switch in `mockText`), `prompts.js`
(`REASON_GLOSSARY`), `validateExplanation.js` (`REQUIRED_TOPIC`), `fallback.js` (`TEXT`), `public/app.js`
(`STATUS_TEXT`) = 30 entries). Adding one reason code (e.g. a future `CAPACITY_EXCEEDED`) meant editing 5 files;
forgetting `REQUIRED_TOPIC` would silently reject every model answer (`MISSING_REASON` → fallback), forgetting
`STATUS_TEXT` would show a generic "Not available". Nothing failed loudly.

## Options evaluated
| Option | Verdict |
|---|---|
| Strategy (one class per reason with methods) | Rejected: the per-reason "behaviour" is data (strings, one regex, one template). Six classes + an interface would add ceremony without new behaviour. |
| Adapter (for LLM providers) | Not warranted: there is one real provider; `createMockModel` / `createLiveModel` already share one function signature. A pattern for a second provider that doesn't exist would be speculative. |
| **Table-driven catalog (registry of records – "data-as-strategy")** | **Chosen**: one frozen record per code `{statusText, glossary, fallback, topic, mock}` in `src/reasons.js`; consumers look it up; an import-time guard + test fail if a code lacks a record. |
| Do nothing | Viable for 6 codes, but the silent-failure mode above is a real maintenance risk, and the change is small. |

## Refactoring (the only one)
- New `src/reasons.js` (catalog + `reasonFor()` + import-time completeness check).
- `fallback.js`, `prompts.js` (glossary), `adapter.js` (`mockText`), `validateExplanation.js` (topic) read from it.
- The UI table was removed: `/api/availability` now also returns `statusText` from the catalog (additive field);
  `app.js` shows it. The browser no longer duplicates server knowledge.
- New `test/reasons.test.js`: catalog == rule-engine codes; every field present; every fallback/mock passes the
  validator; status text matches availability; unknown / `__proto__` codes return `null`.

## Before / after
| | Before (`a05-baseline`) | After |
|---|---|---|
| Places that list reason codes (outside the rule engine) | 5 files, 30 entries | 1 file (`src/reasons.js`), 6 records |
| Steps to add a reason code | edit 5 files, no check | add 1 record; test + import guard fail if incomplete |
| Diff | – | 6 files changed, +15 / −51 lines in existing files, +1 module, +1 test file |
| `npm run check` | 65 pass (incl. 4 AC tests), lint OK, build OK | **68 pass**, lint OK (22 files), build OK (10 modules) |
| A05-AC1…AC4 tests | 4/4 pass | 4/4 pass (`after-pattern-check.txt`) |
| UI scenarios (browser) | 13/13 | 13/13 (`after-pattern-ui.txt`) – same status texts, now from the server |

The public API changed only additively (`statusText`); A05-AC2 still holds because `/api/explain` embeds the same
availability payload.
