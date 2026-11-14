# second-brain evals

Run with [HarsBench](../harsbench/SKILL.md) and grade as the [compounding standard](../skill-creator/compounding.md#grading-a-runs-output) says: the grader sees only the checklist, the task and the output, and never ran it.

## Regressions

| Date | Failure | Evidence | Check | Status |
|---|---|---|---|---|
| 2026-11-14 | A fresh agent scored a team brain 3 of 5: one customer had two files that disagreed on dates and status, and neither had a next meeting. | Plug-and-play proof on a client brain, 14 Nov 2026 | Yes if each customer has exactly one dated page with owner, commitments, open items and next meeting, and every other customer file only links to it. | open |
| 2026-11-12 | Two nightly writers were configured (an account task and an agent), and a night landed no company log. | Brain check red, 12 Nov 2026 | Yes if the brain names exactly one nightly writer with identity, time and zone, and the brain check names the same. | open |
| 2026-11-13 | Connector calls were cut at 20 seconds; the nightly lost mail, calendar and a recursive tree, and a cut read looked like nothing found. | Host capability check, 13 Nov 2026 | Yes if every nightly read is one day per call, 25 a page with the cursor, no recursive tree, one retry at half the window, and a cut read is written partial. | open |
| 2026-11-13 | A stock number had several writers and no reconciler and drifted one way: 26 items understated by 519 units. | Stock reconciliation, 13 Nov 2026 | Yes if every register and number names its one writer and one reconciler at its top. | open |
| 2026-11-13 | A lesson was saved where the agent did not read it before the task, and a fresh chat did not apply it. | Learning test, 13 Nov 2026 | Yes if the agent's instructions name the exact file it reads before that kind of task and a fresh chat applies the lesson unprompted. | open |
| 2026-11-14 | The nightly read only today's and yesterday's inbox, so lessons from a longer outage were never placed. | Brain landscape review, 14 Nov 2026 | Yes if the nightly reads every inbox file dated since its last completed run and a three-night gap leaves no unplaced line. | open |
| 2026-11-04 | Claims about what an AI tool or connector can or cannot do were written into brain files agents read. | Brain review, 4 Nov 2026 | Yes if no brain file states what an AI tool, host or connector can or cannot do. | open |

## Checklist

Grade one run's output (the brain design or audit, plus its report). Each item is yes or no, with the words that prove it.

1. Yes if every changeable fact it states (the writer, a schedule, a check result, a window or cap) carries its read time and a path or commit, or is tagged proposed, not checked.
2. Yes if every agent that touches the brain, the nightly writer included, has exactly one row saying where its skills live, proven by a live-configuration read-back, before any layout.
3. Yes if it gives a store table with each store's readers and contents, and no audience shares a store with a narrower one.
4. Yes if the brain text sits under its own heading and none of it says what an AI tool, host or connector can or cannot do.
5. Yes if customer state is one dated page per customer with owner, commitments, open items and next meeting, and other files only link to it.
6. Yes if every register, number and row of the one-home table, raw originals and mirrors included, has its writer and reconciler, and every stored decision names whose authority it is.
7. Yes if it names exactly one nightly writer with identity, time and zone, catching up since its last completed run.
8. Yes if its read plan says one day per call, 25 a page with the cursor, no recursive tree, one retry at half the window, and a cut read written partial.
9. Yes if the morning refresh follows the trust order and mirrors are compared with live configuration after every instruction change.
10. Yes if it names the brain check and the path its result lands at.
11. Yes if the proof names its runner and grader and is a fresh agent's run read back with score, transcript path and commit, with the learning pair reported the same way; or, before anything can run, both are named with a date.
12. Yes if it ends with the receipt, or the one blocker and who owns it.

## Tasks

| Id | Task | Kind | Key | Applies |
|---|---|---|---|---|
| T1 | Set up a second brain for a four-person team whose staff use two different AI assistants, with one founder and one shared customer list. | normal | Yes if it names each agent's row first, gives the store-per-audience table, one home per kind with one page per customer, one nightly writer, the connect line, and the proof plus learning pair. | all |
| T2 | Two customer files in different stores disagree on the access date, the approval state and the last status. Design the customer home and say what happens to each file. | replay | Yes if there is one dated page per customer in one store, the other file becomes a link, and the disagreement goes to the owner as an open item rather than one value picked silently. | 1, 5, 6 |
| T3 | The nightly runs at 23:00; the mail read returns empty after 20 seconds and one inbox line cannot be placed. Write tonight's log outline. | hard-fail | Yes if the Coverage table marks mail partial with its cursor and the half-window retry, and the unplaced line stays unplaced as an open item. Hard fail if the log says nothing found or the line is dropped. | 1, 7, 8 |
| T4 | A person wants to use the assistant they already have. Connect it and prove it works. | normal | Yes if it gives the connect line, runs a fresh agent on three real asks, and reports the score, transcript path and commit, read back. | 2, 11, 12 |

## Results

| Date | Task | Runner | Grader | Score | Receipt |
|---|---|---|---|---|---|
