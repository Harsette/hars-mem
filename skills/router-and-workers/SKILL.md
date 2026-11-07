---
name: router-and-workers
description: Stay reachable while an independently claimed worker performs scoped work and returns verified evidence.
---

# Router and workers

The router is the agent talking to the owner. Keep that conversation reachable. Route independent work that would otherwise hold it up, and keep related decisions with the router. Use the measured fit from [HarsBench](../harsbench/SKILL.md) to select a worker.

## Route and return

1. The router finds or adds the task on live main and checks holds and leases. Pass the original ask, goal, task ID and revision, verified store and source pointers, scope and allowed files, holds and exclusions, done condition, and proof expected. Deliver a correction promptly. Restart a worker only when the correction cannot safely be applied in flight.
2. The worker boots in its own ID and scope, runs `start --packet minimal`, and checks `ready` and the live lease before doing work. A conflict belongs with the current holder. If the claim or lease cannot be verified, report unknown and wait for a verified handoff.
3. The worker heartbeats, saves checkpoints, and reports blockers, uncertain actions, and verified receipts to the router. The router checks the live brief and verifies the evidence. The current holder closes the task once the result is verified. The router checks the finished task and cleared lease without taking over a live lease.
4. On pause, preserve the checkpoint and release the lease. For cancellation, verify the worker has stopped and preserve the last checkpoint and any uncertain action before release. Use `settle --as cancelled` with a verified receipt only after the work was actually cancelled and an authorized holder can record it. Keep paused work open.

A read-only worker gives the router an [UNSAVED handoff](../../HOSTED.md#a-read-only-connector) with the source and revision. The authorized holder rechecks the live task and saves the draft. Confirm the verified write before reporting it saved.

## One complete handoff

Use a disposable owner store. In a real run, the router and worker run their own commands. This example verifies that the scoped worker can retrieve one tracked source, checkpoint, pause, and resume before the router verifies closure.

~~~sh
# Router
node hars-mem.mjs boot --agent guide-router --role outer --scope field-guide --capabilities shell,git-read,git-write
node hars-mem.mjs add field-guide/verify-workflow --agent guide-router --goal "Verify the tracked workflow is readable" --files WORKFLOW.md --excluded "Editing canon" --done-when "The scoped worker reads WORKFLOW.md at live main and saves the verified revision" --proof "A tracked checkpoint with the source revision"
node hars-mem.mjs brief field-guide/verify-workflow --packet minimal

# Worker. Confirm that start returned ready with a live lease before continuing.
node hars-mem.mjs boot --agent guide-worker --role worker --scope field-guide --capabilities shell,git-read,git-write
node hars-mem.mjs start field-guide/verify-workflow --agent guide-worker --packet minimal
node hars-mem.mjs heartbeat field-guide/verify-workflow --agent guide-worker
LAB=$(mktemp -d)
SHA=$(git rev-parse origin/main)
git show "$SHA:WORKFLOW.md" > "$LAB/workflow-readback.txt" &&
  printf 'Verified WORKFLOW.md at %s.\n' "$SHA" > "$LAB/verified-workflow.md"
RECEIPT=$(node hars-mem.mjs save field-guide/verify-workflow --agent guide-worker --detail "Verified the tracked workflow at observed main" --file "$LAB/verified-workflow.md" |
  node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8')).task.checkpoints.at(-1).path")
node hars-mem.mjs release field-guide/verify-workflow --agent guide-worker

# Resume under the same worker ID. Verify ready and the saved checkpoint.
node hars-mem.mjs start field-guide/verify-workflow --agent guide-worker --packet minimal
node hars-mem.mjs brief field-guide/verify-workflow --packet minimal
node hars-mem.mjs finish field-guide/verify-workflow --agent guide-worker --receipt "$RECEIPT"

# Router verifies the finished task and the tracked receipt.
node hars-mem.mjs brief field-guide/verify-workflow --packet minimal
git show "origin/main:$RECEIPT"
~~~
