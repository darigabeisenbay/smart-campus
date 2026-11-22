# AI output – read-only risk review (Task 04), condensed record

Tool: Claude sub-agent (general-purpose), launched by the main Claude assistant on 2026-11-22 ~18:40 (UTC+5).
Prompt summary: "STRICTLY READ-ONLY … propose 8–12 candidate risks for /home/claude/smart-campus (branch
assignment-05) covering correctness, maintainability, security, dependency, agent operations; for each: ID,
category, cause→event→consequence, component, evidence observed OR 'not verified', confidence, L(1–3), I(1–3)."
AGENTS.md: placeholder `$(AGENTS)` delivered by mistake + instruction to read the file from disk (agent did so).

Agent-reported baseline: `npm test` 68/68 (also under TZ=Pacific/Kiritimati and Pacific/Pago_Pago), lint OK;
did not run `npm run build` (deletes `dist/`).

| ID | Category | Claim (agent's words, shortened) | Agent evidence | Agent confidence | Agent L×I |
|---|---|---|---|---|---|
| P1 | correctness | `nowLocal()` uses server-local getters; campus is UTC+5 → wrong PAST/AVAILABLE | time.js:3 vs :29; w-timezone.txt; no test exercises unpinned clock | high | 3×2 |
| P2 | correctness/security | word-list validator misses paraphrased contradictions | 4 sentences `ok:true` via node -e; "come by anyway" rejected | high (bypass) / low (frequency) | 2×2 |
| P3 | maintainability | validator word list built from data.js → harmless wording rejected | "…ready for your group." → INVENTED_DETAIL | medium | 2×1 |
| P4 | correctness | malformed time in data → null → booking/block ignored | `end:"…T10:3"` → AVAILABLE; blocked `"2026-11-24 20:00"` → AVAILABLE | high | 1×3 |
| P5 | security/cost | limiter full wipe at >10,000 keys; remoteAddress behind proxy; no global budget | wipe experiment `false true`; 200k keys ≈ 28 MB | high (wipe) / medium (proxy) | 2×2 |
| P6 | operability/dependency | unverified model id + API version; all errors → fallback; no log → feature can be dead unnoticed | code read; "not verified" | medium | 2×2 |
| P7 | agent ops | AGENTS §4 lists compare-prompts as safe/offline but it writes tracked files; `--live` spends money | code read, git ls-files | high | 2×2 |
| P8 | agent ops | build.mjs `rmSync('dist')` relative to cwd → deletes another folder's dist | code read, not run | high (code) / low (event) | 1×2 |
| P9 | agent ops | rules not reliably delivered; stale/contradictory docs (4 items) | `$(AGENTS)`; time.js:3; 01-baseline W5; README vs AGENTS | high | 3×2 |
| P10 | agent ops/maint. | no CI/hooks; lint narrow; no type check | ls .github; lint.mjs:30,33; W2 | high | 2×2 |
| P11 | agent ops | concurrent writer in shared checkout | `?? a05/08-background-agent.md` appeared mid-review | high | 2×2 |
| P12 | dependency | playwright pin without hashes / may not exist; `--no-sandbox`; Node 20 untested | file read; "not verified" | low–medium | 1×2 |

Agent "checked and not raised": tests never read LLM_MODE/API key from env (explicit env + adapter everywhere);
static server blocks `..` and unknown extensions.
