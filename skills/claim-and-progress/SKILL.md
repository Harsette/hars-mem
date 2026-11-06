---
name: claim-and-progress
description: Claim a task before work, save progress to the board, and finish or release with evidence.
---

# Claim and progress

1. Read the live board and task brief. Confirm applicable holds, prerequisites, and whether the current lease is live. Add a task if no existing record covers the ask.
2. Run start with your agent ID. Proceed after it returns ready and your live lease. If another live lease owns it, coordinate with that owner.
3. Save a short progress line, the next step, and any material working file. Renew your lease before expiry. Use a blocked or waiting status with the reason when that is the real state.
4. Before pausing, save the checkpoint and release. Another checkout reads the checkpoint and takes its own claim. If a write fails, inspect the outbox and live task before retrying.
5. After review, run finish with the checked evidence path, commit SHA, or verified URL. Read the board back to confirm the receipt and release.

WORKFLOW.md gives the runnable commands. Task rows produce the board. Keep status in those rows.
