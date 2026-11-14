# The compounding standard

A skill on this standard gets better with every failure and never loses a fix it already had. It carries its own learning loop, keeps its failures as checks, and proves its current text on a cold run graded by someone else. `node skill-check.mjs` scores every check a script can read.

A skill joins the standard by adding an `evals.md` beside its `SKILL.md`. From then on the repo tests hold it to every scripted check below, so a later edit cannot quietly drop one.

## The learning loop

Each skill on the standard has a `## Learning loop` section that applies these steps to its own work and links here.

1. **Capture the same turn.** A correction from the owner, a failure or a near miss becomes a row in the skill's `evals.md` under `## Regressions`: date, what failed, evidence, a check starting "Yes if", and status `open`. File it through [Hars Flags](../hars-flags/SKILL.md) too. Nothing waits in a chat.
2. **Reproduce before fixing.** Rerun the original ask on the agent that made the mistake, in a fresh session. If it does not reproduce, say so on the row and add no rule.
3. **Fix the smallest thing.** Rewrite the line that caused it; never add one beside it. If a script can see the failure, write the check first and watch it fail on the old text.
4. **Prove it is applied, cold.** A fresh session on the consumer's own model, with only what it will really see, runs the original ask and one harder variant. It passes with the fix and fails without. Saving a lesson proves nothing; the test is a fresh chat applying it unprompted, as a different person where the agent is shared.
5. **Lock it.** The row turns `locked` with its receipt (a commit, a run id or a dated read-back) and names the script, test or checklist item that now enforces it.
6. **Ripple, then retire.** Search sibling skills and agent instructions for the same failure and fix each owner in the same pass. When a model lands, rerun the tasks and cut what the bare model now does alone. When eval cases reach a limit, drop one a newer case covers or whose rule is gone, never simply the oldest; otherwise raise the limit.

## The checks

`node skill-check.mjs SKILL` prints yes or no for each, with the reason. The repo tests fail when a skill that has `evals.md` misses C1 to C6. C7 reports whether the latest proof ran against today's text; it informs, it does not block, because a run needs a model and a grader the tests do not have.

| # | Check | Yes if |
|---|---|---|
| C1 | Trigger | Front matter has `name` matching the folder and a `description` of 300 characters or fewer. |
| C2 | Learning loop | `SKILL.md` has `## Learning loop` naming `evals.md`, Regressions, a fresh session or fresh chat proof, and linking this standard. |
| C3 | Regressions | `evals.md` has `## Regressions` as a table with at least three rows, each with a `YYYY-MM-DD` date, a check starting "Yes if" and a last cell of `open` or `locked`. A `locked` row names what enforces it. |
| C4 | Output checklist | `evals.md` has `## Checklist` with at least eight distinct numbered items, each starting "Yes if". |
| C5 | Tasks and keys | `evals.md` has `## Tasks` as a table with an `Applies` column and at least four tasks, at least one `hard-fail` and one `replay`, each key starting "Yes if", and every number in Applies naming a checklist item that exists (or `all`). |
| C6 | Hygiene | `SKILL.md` and `evals.md` have no em dash or middle dot, and `SKILL.md` keeps no text marked superseded or "kept as history". |
| C7 | Proof is current | The newest dated row under `## Results` names the model, a grader who is not the runner, and the `git hash-object` of the `SKILL.md` it ran against, and that hash equals today's. |

## Grading a run's output

A grader gets the task row (its key and its Applies list), the checklist items that list names, and the output, nothing else. For the key and each listed item: yes or no, with the exact words of the output that prove it. An item the output cannot prove is a no. When the grader cannot run, the result is "not graded", never a pass. A claim that an action happened (pushed, sent, saved) needs the tool result or the artifact read back in the output. The run's author never grades it, and the agent never grades its own run.

The task's author decides the Applies list before the run, and checks that every listed item can pass on the same output: a read-only task is not graded on items written for a live run.

## What a perfect score proves

C1 to C7 all yes means the skill is built to compound: every known failure is a row with a check, and its current text passed a blind-graded cold run. It does not promise every future output is right. That is what the checklist and tasks measure, and why the loop reruns them whenever the skill or the model changes. The minimums are floors, not targets: cover every known failure and never pad to reach a count.
