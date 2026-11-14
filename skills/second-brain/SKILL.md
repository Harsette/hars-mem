---
name: second-brain
description: "Set up and keep a second brain for a person, team or company: a store per audience, a router, one home per kind, raw then logs then dated syntheses, inboxes, one nightly writer, mirrors, a brain check, and a cold proof that a fresh agent can use it."
---

# Set up and keep a second brain

A second brain holds pointers, raw originals and dated syntheses. The systems of record stay where they are: the accounting system, the CRM, the issue tracker, the wiki, the shop. The brain says where each truth lives, what was decided and why, and what changed since yesterday. Any agent the owner uses reads the same brain, so the work compounds and no tool owns it.

**Done means** three things, each read back: a fresh agent with only the connect line and read access answers three of the owner's real asks with file citations; the brain check passes for the latest night; and one lesson has gone inbox, nightly, home file, and a fresh chat applied it with no reminder.

## Read live first

These change on their own. Read each at the start of a run, write the read time, and trust a saved note only when nothing newer exists.

- Each store's live main. A note describing the layout is true only as of its date.
- The newest brain check result.
- Who the nightly writer is and when it runs, from the store's own writer line.
- Each agent's live configuration (its settings or builder view), not its mirror in the store.
- [holds.json](../../holds.json).

## Steps

1. **Find where each agent learns.** For every agent that will read or write the brain, the nightly writer and any checker included, write one row: where its skills live (files it edits itself, a builder only, its system prompt only, or instructions it edits in place), whether it can write Git, whose identity its schedules run as, and how long a connector call may run. Prove the skills column per agent by reading back its live configuration, never by its product's category. This decides where its Learned lines go. Keep this table in your report and in each agent's own instructions, never in the brain.
2. **One store per audience.** Git permissions are per repository, so a folder cannot be hidden from some readers. Make a company store (everyone), one per department (that department plus founders), a founders store, and one per person (that person plus founders). Before importing anything, run one allowed read and one denied read per audience as the real identity.
3. **A router AGENTS.md in every store**, in five short parts: what this store holds, who reads it, where each kind lives, who writes what and when, and "a greeting needs no reads; open the brain only when the task needs it". The company store's AGENTS.md is the entry every agent reads first.
4. **One home per kind.** Put this table in the company AGENTS.md and link to it from every other store.

   | Kind | Its one home | Writer; reconciler |
   |---|---|---|
   | Customer state | One dated page per customer: owner, commitments, open items, next meeting, `as_of`. Every other customer file only links to it | Nightly writer; the customer's owner |
   | Decisions and open questions | Founders store, each with whose authority it is and the owner's words or message id | Nightly writer, from the owner's words only; a founder |
   | Rules and procedures | The department store's `sops/`, one file per rule set | Nightly writer; the rule's owner |
   | Open items | `open-items.md` with an `id` column, in the store whose audience may see it | Nightly writer; each item's named owner |
   | Raw originals | `raw/SOURCE/` in the narrowest store whose whole audience may see them | Nightly writer, unchanged; brain check (Carry) |
   | Logs and check results | `logs/YYYYMMDD.md` in every store; `checks/YYYYMMDD.md` in founders | Nightly writer; brain check |
   | Agent mirrors | `agents/AGENT/` in the agent's own store | That agent; brain check (Config) against live config |
   | Lessons not yet placed | The person's `inbox/YYYYMMDD.md` | That person's agents; nightly writer marks placed |

   Any other register, list or number gets its own row, and states its one writer and one reconciler at its top: a number with several writers and no reconciler drifts one way until someone counts by hand. Every stored decision names whose authority it is. Brain text says where to read and write and who does it, never what an AI tool, host or connector can or cannot do. Write the brain text under its own heading, apart from your report: a sentence about what a tool, host or agent can or cannot do (an agent that cannot write Git, a builder that drops a word) belongs only in the report and that agent's own instructions.
5. **Raw, then logs, then dated syntheses.** Originals go into `raw/SOURCE/` unchanged, with source id, speaker and date. Each night the writer writes `logs/YYYYMMDD.md` in every store, with front matter `as_of`, `prior` and `sources`, and a `## Coverage` table with one row per connected source: asked, came back, cursor, and a status of read, partial or not connected. Home files are syntheses: each fact carries its quote, source, date and modality and cites its raw file or log line. Never drop what you cannot resolve: keep it as an open item and alert its owner once.
6. **An inbox per person.** During the day a person's agent writes one line per lesson, rule or decision to their store's `inbox/YYYYMMDD.md`: `- HH:MM ZONE | KEEP | KIND | LINE | SOURCE OR MESSAGE ID | placed: no`. By day agents write only their inbox, mirror, notes and learned files; the nightly writer alone updates logs and home files.
7. **One nightly writer.** Exactly one routine writes logs and home files; name its identity, time and zone in the founders store and in the brain check. Tag that line, and every other changeable value you state (a schedule, a window, a cap, a check result), with its read time and source, or `(proposed, not checked)` when you are choosing it. It runs after every mirror, as one pass with its steps in order and a checkpoint after each, so a stopped run resumes at its first missing step. It reads every inbox file dated since its own last completed run, so a missed night is caught up, and places only lines marked `placed: no`. It reads each source in the smallest window: one day per call, 25 items a page with the next-page cursor, never a recursive tree. A call that is cut off is retried once at half the window; a read that was cut off is written `partial` with its cursor and never advances it. It is never written as "nothing found". It folds lasting facts into their homes and commits straight to main.
8. **Mirrors and the morning refresh.** Each agent mirrors its instructions, routines, memory and skills into `agents/AGENT/` before the writer runs. After every instruction change, compare the mirror with the live configuration and write which of the two you read; a comparison on a timer alone misses the change made between runs. The morning refresh rereads the rules, the newest brain check and the agent's own Learned lines. When sources disagree, trust them in this order and report the disagreement: the live system, the owner's newest dated words, the brain, the agent's files, the agent's memory. A note is replaced only when its source is newer than the note.
9. **Make the learning loop reach the store.** A correction becomes, in the same turn, a Learned line in the file the agent reads before that kind of task, and an inbox line. A saved path is not an installed rule: an agent whose skills live in its system prompt gets the rule in that prompt, at a named line. The nightly places the lesson in its owning procedure. It counts only when a fresh chat applies it with no reminder, as a different person where the agent is shared.
10. **Run the brain check.** A model-free script, run after the nightly and again in the morning, that writes `checks/YYYYMMDD.md` in founders: every store has tonight's log (Landed), logs carry their front matter and a Coverage table, nothing open last night vanished without a settle (Carry), links resolve, no personal data or tool claims in brain text, each kind has one home, mirrors match live configuration, no inbox line older than a night stays unplaced, and no home file is stale past its window. The next nightly fixes what it lists first.
11. **Bring your own agent, then prove it.** Any agent a person already uses gets read access for their audiences, a write route to their own inbox, and one connect line: "Read ORG-company AGENTS.md first and follow its routes. Write only to ORG-PERSON:inbox/YYYYMMDD.md." Then run the proof, do not describe it: a fresh agent with only that line and read access gets three of the owner's real asks (a customer's status and a reply draft, the owner's rules and style, and a new standing rule). Score five yes-or-no points: cites file paths; one customer page answers status and next meeting; the new rule goes to the right inbox; it asks personal or team scope when unclear; nothing is written elsewhere or sent. Name who runs the proof and who grades it (never the same agent, never the designer), then report the score, the transcript path and the commit, and read the transcript back. When nothing can be run yet, say so and name the runner, the grader and the date. Then run the learning pair from step 9 the next day and report it the same way.

## Why anyone can use it at any hour

- **Chats never collide.** Every chat and routine is its own session, memory is per person, and by day agents write only their own inbox, mirror and notes.
- **Late work still lands.** The nightly collects from each source's last good read and places every unplaced inbox line since its last completed run, so a 03:00 lesson is placed the next night.
- **Salience is a line, not a watcher.** Anything that needs a person becomes a `PING:` line in that day's log or an open item with an owner and a date; the person's assistant or the morning brief surfaces it once, with its link, and the nightly carries it until it is settled.
- **The brain only gets newer.** One writer folds facts into one home each, and the brain check fails loudly when a night lands short.

## Before you hand back

1. Every changeable fact (the writer, every schedule, every check result, every window or cap) carries its read time and a path or commit, or is tagged `(proposed, not checked)` when you are choosing it.
2. Every agent that touches the brain, the nightly writer included, has exactly one row from step 1, proven by a live-configuration read-back.
3. The store table gives each store its readers and contents; no audience shares a store with a narrower one.
4. The brain text sits under its own heading and none of it says what an AI tool, host or connector can or cannot do.
5. Customer state is one dated page per customer; every other file only links to it.
6. Every register, number and row of the one-home table, raw originals and mirrors included, has its writer and reconciler; every stored decision names whose authority it is.
7. Exactly one nightly writer, with identity, time and zone, catching up since its last completed run.
8. The read plan: one day per call, 25 a page with the cursor, no recursive tree, one retry at half the window, a cut read written partial.
9. The morning refresh follows the trust order and mirrors are compared with live configuration after every instruction change.
10. The brain check is named with the path its result lands at.
11. The proof names its runner and grader and is a fresh agent's run, read back with score, transcript path and commit, and the learning pair reported the same way; or, before anything can run, both are named with a date.
12. The reply ends with the receipt, or the one blocker that stops it and who owns it.

## Learning loop

Follow the [compounding standard](../skill-creator/compounding.md#the-learning-loop): a brain miss (a failed proof ask, a red check for a design reason, a lesson a fresh chat did not apply) becomes a row in [evals.md](evals.md) under Regressions the same turn, is reproduced on the same brain commit before any fix, fixes the step that caused it rather than adding one beside it, is proven by a fresh session that passes with the fix and fails without, and is locked with its receipt. A lesson seen in two brains moves into the steps; a step a bare model now does alone is retired.
