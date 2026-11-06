# Hars-Mem operating rules

The canonical branch is this private repository's current GitHub main. At the start of each task, fetch main and read this file at the returned commit. Keep your harness's craft, preferences, and tools. Remove any copied rule, fact, or status from native memory when it conflicts with the current source.

## Read before acting

1. Read the [task board](BOARD.md) and the task record. An in-progress status without a live lease describes unfinished work.
2. Read the [holds](holds.json), the project's synthesis and source pointers, and the task's dependencies. Recheck a live source before calling its facts current.
3. Read the authority and completion conditions. An authenticated newer owner instruction can change a decision. Record the instruction and its source.

## Route and write

- The outer agent owns the conversation, routing, review, and final answer. It stays available while the worker runs. Give the worker the task ID, goal, completion condition, files, holds, exclusions, and proof expected.
- The worker reads the current brief, takes its own claim, and executes. It checkpoints before losing the session or changing machines. It stops when a hold applies or the lease expires.
- A claim coordinates work. It grants zero access. Get owner approval before spending, publishing, contacting someone, or speaking on the owner's behalf. Apply a hold until its owner records a release.
- Use the task CLI to claim, save, release, and settle. The task record and board update together. Check the evidence before attaching the receipt.
- Keep credentials, personal data, and restricted exports out of Git and handoffs. Point to an authorized source. Mark an unread source unknown.

## Where things go

| Kind | Location |
| --- | --- |
| Canon | This file and decisions accepted by their owners |
| Records | [Task records](state/), Git history, and receipts |
| Process | [Work loop](WORKFLOW.md) and your harness tools |
| Situation | Current ask, lease, task brief, and checkpoints |
| Memory | [Snapshots](snapshots/) with reusable craft and retrieval links |

Project syntheses explain what holds, why, and where to verify it. Update the owning source when a fact changes. Update its synthesis if the change affects future work. Keep facts and task status out of agent snapshots.

The [folder map](paths.json) defines the configured locations. The [portable skills](skills/) cover onboarding and routing, claims, and checkpoints.
