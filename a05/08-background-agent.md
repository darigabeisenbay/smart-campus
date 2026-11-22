# A05 Task 08 – Background agent safeguards (hypothetical design, not executed)

No paid background-agent service was used. This is the operating contract a background (asynchronous) coding agent
would run under for one concrete task in this repository.

## Task
"Add a structured `requestId` to every API error response and log line, with tests." Low risk, touches the server only.

## Isolation
| Control | Setting |
|---|---|
| Workspace | Fresh `git worktree add ../sc-agent-<ticket> -b agent/<ticket> main` – never the human's checkout |
| Branch | `agent/<ticket>` only; no pushes to `main`, no force-push, no tags |
| Environment | Container, no production credentials; `ANTHROPIC_API_KEY` **unset**; `LLM_MODE=mock`; network off except package registry (unused – zero deps) |
| Time limit | 30 min wall-clock, 15 min per command; then stop and hand back what exists |
| Budget | max 40 tool calls; abort on 3 consecutive failing `npm run check` runs |

## Allowed files
`src/server.js`, `src/log.js` (new), `test/server.test.js`, new `test/*.test.js`, `README.md` (error-format section only).
**Read-only:** everything else. **Never:** `src/availability.js`, `src/data.js`, `src/reasons.js`,
`src/explain/validateExplanation.js`, `AGENTS.md`, `CLAUDE.md`, `package.json`, `.gitignore`, `scripts/`.

## Allowed commands
`npm test`, `npm run lint`, `npm run build`, `npm run check`, `node --test <file>`, `git status|diff|log|add|commit`
(on `agent/<ticket>`), `SMART_CAMPUS_NOW=… npm start` on a random local port.

## Prohibited operations
Everything in AGENTS.md §5, plus: no `npm install` / `pip install`; no edits outside the allowed list; no deleting or
skipping tests; no changes to lint rules; no `git push`, merge, rebase, `reset --hard`, `clean`; no deploy;
no calls to `LLM_MODE=live`; no reading `~/.ssh`, `~/.aws` or env files.

## Required artifacts (handed back for review)
1. **Change summary** – what and why, files touched, assumptions.
2. **Diff** – `git diff main...agent/<ticket>` as a patch file.
3. **Test log** – full `npm run check` output with pass/fail totals, before and after.
4. **Build result** – `npm run build` output.
5. **Risk notes** – what could break, what was not tested, any rule the agent could not follow.
6. **Command log** – every command run, with exit codes (from the harness, not the agent's own report).

## Human review and merge gate
- A human reviews the diff and artifacts; the agent cannot merge, deploy or approve its own work.
- Merge only if `npm run check` is green **re-run by CI/the human** (not trusted from the agent's log),
  A05-AC1…AC4 pass, and no file outside the allow-list changed (`git diff --name-only` checked against the list).
- Changes touching security headers or error format need a second reviewer.

## Failure and rollback
| Situation | Handling |
|---|---|
| Agent times out / exceeds budget | Stop; keep the worktree; artifacts say "incomplete"; human decides to resume or discard |
| Tests fail at hand-back | No merge; agent's branch stays for inspection; issue re-opened with the failing log |
| Disallowed file touched | Automatic reject; `git worktree remove` + delete branch after a human looks |
| Problem found after merge | `git revert <merge-commit>` on `main` (no history rewrite), re-run `npm run check`, add a regression test |
| Secret appears in diff/log | Reject, purge worktree, rotate the key, record in risk register |
