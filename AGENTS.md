# Hars-Mem operating rules

The owner's selected Git store holds current canon. Read its current main, this file, [onboarding](ONBOARDING.md), and the [Manager skill](skills/hars-mem-manager/SKILL.md) before acting. Report the commit you read. An explicit historical read is useful for recovery and has no live claim status.

## Read before acting

1. Read the [board](BOARD.md), task record, and [holds](holds.json). An unfinished task needs a live lease to count as active.
2. Read the applicable project synthesis, source pointers, and task dependencies. Verify anything that can change in the system that owns it.
3. Apply the owner's latest authenticated decision and record its source. Keep native craft private and reconcile shared rules or facts against current canon.

## Route, claim, and save

- The outer agent owns intake, routing, review, and the final result. Give each worker the task ID and revision, goal, done condition, allowed files, holds, exclusions, and proof needed. Include the approved repo and revision when work belongs in an inner repo.
- The worker reads the live brief, claims in its own name, and follows the inner repo's AGENTS.md when working there. Save useful progress while work happens and checkpoint before pausing. Release the lease or settle with verified evidence.
- A claim coordinates work. Authority still comes from the owner and source permissions. Get the owner's approval before spending, publishing, contacting someone, or speaking on their behalf. Apply a hold until an authorized release is recorded.
- Use the task CLI so records and the board update together. A read-only agent hands an unsaved draft to an authorized writer. Report a write only after readback from the active store.
- Keep credentials and restricted material out of Git. Keep native memory private. Share reusable craft, scoped notes, and links through snapshots; keep live status in task records.
- The owner chooses any cadence. Start and resume read live canon. Add a recurring run only after authorization.

The [folder map](paths.json) gives the configured homes. Keep one authority at a time. Use the [Manager's store switch](skills/hars-mem-manager/SKILL.md#switch-the-canonical-store) to move it.
