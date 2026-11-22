# A05 Task 10 – AI reflection

I used Claude (Claude Opus 5.5 in the Claude app's agent workspace) as the main assistant, plus a separate Claude
sub-agent for the read-only risk review. The main assistant had the full repository, the assignment PDF and the
command outputs. The reviewer got the repository path, the categories to cover and a read-only rule. Its copy of
AGENTS.md arrived as a broken placeholder, so it had to read the file from disk.

The most useful suggestion was P8: `scripts/build.mjs` deletes `dist/` relative to the current folder. I would not
have looked for it, because `npm run build` always works from the root. I reproduced it in a temporary folder and
watched a canary file disappear. The weakest suggestion was P12, which said `playwright==1.63.0` might not exist. The
installed version is exactly 1.63.0. The reviewer also called a baseline record "stale", but that record correctly
describes the baseline.

I checked every claim myself: I re-ran each reproduction, wrote failing tests before both fixes and compared the
before and after logs. Tests changed my decisions three times. The clock test showed that my first fix still accepted
an invalid zone whenever the clock was pinned. The logging tests made me drop warnings for the deliberate "off" mode.
The type check exposed one new error that I had introduced. Because the tests were green and covered the rule
engine, I could choose CONDITIONAL instead of NO-GO.

Repository instructions helped: the reviewer refused to run `npm run build` under the read-only rule, and the
AGENTS.md forbidden list kept both fixes away from the booking rules. They also showed their limit, because a
sub-agent does not load CLAUDE.md. Next time I would verify instruction delivery automatically and add CI so that the
review gates do not depend on me.
