# A05 Task 09 – Release decision

**Reviewed version:** tag `a05-final` (commit `74fd2e7`, branch `assignment-05`).

## Decision: CONDITIONAL
Release in **mock or off mode** (`LLM_MODE=mock|off`, the default) as the teaching demo. **Live LLM mode and
unattended agent work are not released** until the conditions below are met.

## Evidence for
- Critical checks pass: `npm run check` → 78/78 tests, lint OK, build OK (`final-check.txt`); A05-AC1…AC4 4/4
  (`final-acceptance.txt`); the suite passes under three server time zones (`final-test-timezones.txt`);
  13/13 browser scenarios (`final-ui.txt`).
- The highest risk (R01, score 9: wrong availability decision on non-UTC+5 servers) is mitigated and regression-tested.
- Failures are no longer silent (R02 6 → 2).
- No real secrets in the repository (`final-secret-scan.txt` shows only the documented fake fixture).

## Why not GO
| Open item | Score | Control (condition) | Owner |
|---|---|---|---|
| R09 live model id / API never exercised | 4 (plausible) | Live mode stays off; one approved smoke call + log check before enabling | maintainer |
| R06 rate-limiter wipe | 4 | Live mode off (no paid calls possible); fix eviction before enabling live | maintainer |
| R07 validator paraphrase gap | 4 | Explanation box stays labelled "not a booking confirmation"; live off; adversarial tests before enabling | maintainer |
| R04 build deletes cwd-relative `dist/` | 4 | Agents must run scripts only via `npm run …` from repo root (AGENTS.md); fix paths before unattended agents | maintainer |
| R05 "safe" script writes tracked files | 4 | Human-run only until AGENTS.md entry and opt-in flag are fixed | maintainer |
| R03 instruction delivery | 6 | Every agent prompt pastes AGENTS.md and the agent must quote a rule back | maintainer |
| R08 no CI; R11 no type check | 4 / 2 | Human runs `npm run check` before every merge and pastes totals | maintainer |

## Why not NO-GO
No confirmed product risk above score 4 remains in the released configuration (R03, score 6, concerns agent
workflow, which is not part of this release and has a control); the source of truth (rule engine) is
covered by acceptance tests and unchanged; every remaining item has a named control and owner, and the risky
configurations (live mode, unattended agents) are simply not released.
