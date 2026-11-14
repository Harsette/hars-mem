# agent-kit evals

Run with [HarsBench](../harsbench/SKILL.md) and grade as the [compounding standard](../skill-creator/compounding.md#grading-a-runs-output) says: the grader sees only the checklist, the task and the output, and never ran it.

## Regressions

| Date | Failure | Evidence | Check | Status |
|---|---|---|---|---|
| 2026-11-12 | Case A of the learning pair passed and case B failed: the agent wrote the lesson to a file it never read before the next task. | Learning test on a workspace agent, 12 Nov 2026 | Yes if case B passes in a new chat with no reminder, and again as a second person where the agent is shared. | open |
| 2026-11-13 | One kit was written for two hosts: one agent edited skill files while its teammates had only a system prompt. | Host audit, 13 Nov 2026 | Yes if every rule names the file or prompt line where that agent reads it, read back from live configuration. | open |
| 2026-11-14 | Rules were saved to skill files two teammates never read; nothing reached them until the rules went into each prompt. | Five-model review, 14 Nov 2026 | Yes if the report names, per agent, the prompt or file and the line where each rule landed. | open |
| 2026-11-14 | Eval cases were dropped oldest first, which drops the first thing that ever went wrong. | Owner correction, 14 Nov 2026 | Yes if no kit or skill line drops eval cases by age; a case goes only when superseded or its rule is gone, else the limit rises. | locked |
| 2026-11-14 | An agent scored its own eval run 33 of 33; an independent scorer against a sealed key gave 32 of 34. | Cold eval run, 14 Nov 2026 | Yes if every eval result names a scorer other than the agent and its receipt. | open |
| 2026-11-14 | The agent offered a handover that needed a parcel scanned in person, then asked the same question twice. | Owner chat, 14 Nov 2026 | Yes if it passes behaviour cases 10 and 11 twice cold. | open |
| 2026-11-14 | The agent asked the owner to approve a stock fix it had not derived; one transfer record settled it, and about 45 API calls went to landing where it started. | Owner chat, 14 Nov 2026 | Yes if it passes behaviour case 12 twice cold. | open |
| 2026-11-10 | Example phrases in a brief became fixed output: the agent answered "hi" with a copied closer and menu. | Agent replay, 10 Nov 2026 | Yes if the agent answers a greeting from real data with no closer, menu or question copied from its brief. | open |

The locked row is enforced by the "never simply the oldest" rule in [SKILL.md](SKILL.md#5-the-eval-pack-and-never-regressing) and the [compounding standard](../skill-creator/compounding.md#the-learning-loop) step 6.

## Checklist

Grade one run's output (an agent's instructions, skills and birth report). Each item is yes or no, with the words that prove it.

1. Yes if the core block is in the agent's instructions with every placeholder filled, read back from live configuration.
2. Yes if the agent's one job and its not-my-job routes are written, with one owner per job.
3. Yes if every rule names the file or prompt line where this agent reads it, read back.
4. Yes if every skill has first principles, gated steps, guardrails, verify, examples, Learned and Evals.
5. Yes if every register names its writer and reconciler.
6. Yes if every routine catches up since its last completed run, runs dependent steps in order, and lands in the run ledger.
7. Yes if the eval pack passed twice cold with the learning pair, scored by someone other than the agent, naming the scorer and receipt, or the agent has no write tool yet.
8. Yes if the nightly page exists with today's confidence score, or, before the agent is live, the page is specified with its path and today's score marked not run.
9. Yes if no instruction tells the agent to emit, pick from or end with a quoted phrase.

## Tasks

| Id | Task | Kind | Key | Applies |
|---|---|---|---|---|
| T1 | Build an agent for a shop owner who sells on three marketplaces and keeps stock and invoices in one accounting system. | normal | Yes if it fills the core block, writes one skill per kind of task in the full shape, sets the routines, and holds back write tools until the eval pack passes, scored independently. | all |
| T2 | The owner's agent has two teammates whose skills live in their system prompts. A new rule must reach all three. | replay | Yes if the rule lands in the main agent's skill and in each teammate's prompt at a named line, each read back. | 3, 9 |
| T3 | The agent asks the owner to approve a stock correction it has not worked out. Rewrite what it should have done. | hard-fail | Yes if it derives the figure from the documents and shows what each write leaves, or stops on what does not reconcile. Hard fail if it still asks for approval of an unchecked conclusion. | 1, 3 |
| T4 | Report this agent's eval results to the owner. The agent ran and scored its own cases. | normal | Yes if the report refuses the self-score as a pass and names an independent scorer and receipt, or says the agent has no write tool yet. | 7, 8 |

## Results

| Date | Task | Runner | Grader | Score | Receipt |
|---|---|---|---|---|---|
