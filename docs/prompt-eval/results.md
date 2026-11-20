Source: Outputs produced in-session by Claude Opus 5.5 acting as the model for each system prompt (no API key / network in the classroom sandbox). Re-run live with: LLM_MODE=live ANTHROPIC_API_KEY=... node scripts/compare-prompts.mjs --live

| Prompt | Scenario | JSON contract | Validator (fact agreement) | Sentences | Chars |
|---|---|---|---|---|---|
| A | available | not JSON | TOO_MANY_SENTENCES | 3 | 148 |
| A | overlap | not JSON | TOO_MANY_SENTENCES | 3 | 240 |
| A | blocked | not JSON | INVENTED_DETAIL | 2 | 179 |
| A | invalid | not JSON | pass | 2 | 198 |
| A | past | not JSON | pass | 2 | 131 |
| A | outside | not JSON | INVENTED_TIME | 2 | 162 |
| B | available | not JSON | pass | 2 | 113 |
| B | overlap | not JSON | pass | 2 | 130 |
| B | blocked | not JSON | pass | 1 | 107 |
| B | invalid | not JSON | pass | 2 | 131 |
| B | past | not JSON | pass | 1 | 72 |
| B | outside | not JSON | pass | 1 | 97 |
| C | available | ok | pass | 1 | 125 |
| C | overlap | ok | pass | 2 | 171 |
| C | blocked | ok | pass | 1 | 139 |
| C | invalid | ok | pass | 2 | 135 |
| C | past | ok | pass | 1 | 109 |
| C | outside | ok | pass | 1 | 121 |

| Prompt | JSON contract | Factual agreement | ≤ 2 sentences | Mean length (chars) | Length SD |
|---|---|---|---|---|---|
| A | 0/6 | 2/6 | 4/6 | 176 | 36 |
| B | 0/6 | 6/6 | 6/6 | 108 | 20 |
| C | 6/6 | 6/6 | 6/6 | 133 | 19 |
