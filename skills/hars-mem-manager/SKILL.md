---
name: hars-mem-manager
description: Onboard agents, route and claim tasks, verify evidence, hand off work, and maintain a Hars-Mem workspace.
---

# Hars-Mem Manager

Start with [onboarding](../../ONBOARDING.md). Read current canon, the live board and task, [holds](../../holds.json), the relevant synthesis, and only the source pointers that the decision needs. Report the store and commit. Check a live source before relying on a changing fact.

~~~sh
node hars-mem.mjs store check
node hars-mem.mjs board
node hars-mem.mjs brief example/task --packet minimal
~~~

The board is generated from task records. Count active work from live leases. A minimal packet retains source pointers and leaves out tracked source bodies. Check the packet for scope before handing it off.

## File, route, and work

~~~sh
node hars-mem.mjs add example/task --agent desk-agent --goal "Check the requested change" --done-when "The check passes and the receipt is readable"
node hars-mem.mjs brief example/task --packet minimal
node hars-mem.mjs start example/task --agent project-worker --packet minimal
~~~

Use the real task ID and registered agents. Use `--files`, `--excluded`, and `--proof` on add when scope needs to be explicit. The outer agent routes the work and stays available. The worker boots in its own scope, claims before doing the work, checks `ready`, and renews its lease with `heartbeat` during long work. Follow the [work loop](../../WORKFLOW.md) for guarded writes, failed saves, and recovery.

~~~sh
node hars-mem.mjs save example/task --agent project-worker --detail "Next step: run the project check" --file checkpoint.md
node hars-mem.mjs release example/task --agent project-worker
~~~

Record the verified save commit and checkpoint path. The next worker reads the current brief, claims, and reads that exact checkpoint from Git. Use `snapshot --agent ID --file SNAPSHOT.md` for reusable private-repo craft and source pointers. Keep native memory in its harness, and put work logs in the repo that owns them.

## Hand off to an inner repo

The outer agent opens the task and hands the worker its ID, revision, goal, done condition, approved repo and revision, allowed files, applicable holds, exclusions, and required proof. Use the repo's actual path or authorized source pointer. Start the worker in that repo through your harness.

The inner repo carries its own AGENTS.md, scoped skills and memory pointers, local work log, and environment guidance. Keep secret values in your credential system. The worker follows the inner instructions, checks the work there, and returns the repo identity, immutable revision, evidence path or command output, and central task ID. Keep inner logs and unrelated memory in the inner repo.

The outer agent independently reads and checks the artifact. The current central lease holder then settles using one of these receipt forms:

- A verified, credential-free HTTPS evidence URL. The lease holder verifies the destination and evidence before attaching it.
- A tracked central receipt file containing the independently verified inner repo, full commit, evidence path, and result. Save it with the CLI, then use the returned tracked checkpoint path in `finish --receipt PATH`.

A bare inner-repo SHA needs one of those links or records. Direct SHA receipts must be reachable from central main. Confirm the finished task, evidence, and cleared lease on the live board. If the worker released before review, the authorized receiver claims the task before recording the terminal receipt.

## Switch the canonical store

Supported store routes are GitHub and a local bare Git repository. Choose one. Inspect it from a full standalone clone with one origin and the same read and write endpoint. Have an owner-authorized writer checkpoint and release in-flight work before the switch. Preserve the original source SHA and use a destination with no refs.

~~~sh
node hars-mem.mjs store check
node hars-mem.mjs store migrate --to DESTINATION --from FULL_LIVE_MAIN_SHA
node hars-mem.mjs store check
~~~

Migration freezes the old main, transfers the canonical history, activates and verifies the destination, then reconnects the invoking clone. Check the returned destination commit and read back the task, checkpoint, and any receipt before resuming. Repoint other authorized agents to the verified destination. Old participating Hars-Mem clients refuse live reads and writes against the frozen source. Restrict raw Git writers separately at the repository level.

If activation is interrupted after freezing, retry with the **same destination and original** `--from` SHA. While frozen, explicit `board`, `brief`, `check`, or `recall --as-of FULL_SHA` reads are historical and cannot grant a live claim. A read-only client reports an unsaved handoff when it cannot reach an active writer.

An adapter must offer a verifiable canonical revision, consistent reads of rules and state at that revision, a conditional write with readback, and a recoverable cutover that leaves one active authority. Transfer task revisions, holds, leases, receipts, and checkpoint bytes or provide a verified evidence mapping. Add a new store type only after proving those operations and the retired-source behavior. Other systems can serve as [source pointers](../../ADAPT.md#link-project-sources).

## Reconcile and maintain

- Use `check` to compare board and records. Use `rebuild --agent ID` with write access to repair a stale board. Recheck the live result.
- Use `recall "query" --backend git` for direct reads. Auto recall can use a local SQLite index where available. It is rebuildable from the selected store. Treat unavailable canon as unavailable, even with a populated cache.
- Use `outbox` to recover pending inputs after a failed write. Check live task revision and lease before retrying. Keep the attempted input and report it unsaved until readback succeeds.
- Reconcile current holds, blocked work, stale source observations, and missing receipts during the owner's review. Run upkeep on request or at the owner's authorized cadence.
