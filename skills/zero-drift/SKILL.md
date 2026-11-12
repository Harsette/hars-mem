---
name: zero-drift
description: Compare an owner's Hars-Mem store with local work, evidence and mirrors, then reconcile discrepancies without losing recovery copies.
---

# Check and reconcile drift

Read the current [rules](../../AGENTS.md), [Manager](../hars-mem-manager/SKILL.md), board, and holds. Name the active authority and observation time. Record unverified machines, sources and permissions as unknown.

~~~sh
node hars-mem.mjs store check
node hars-mem.mjs check
node hars-mem.mjs outbox
git status --short --branch
~~~

1. Compare the live revision with each authorized checkout and intended mirror. List dirty files, unique commits, unresolved checkpoints, pending writes and missing evidence separately. A failed fetch or a frozen store leaves the read historical or unknown.
2. Check record IDs, revisions, dates, source links, evidence hashes and board parity. Verify changing facts at their live sources. Use a scoped model only to explain an ambiguous difference or propose a synthesis correction.
3. Preserve unique work and outbox input before changing a checkout. Keep a verifiable archive of the sole recovery copy. Protect source permissions and scan proposed shares for credentials and restricted content. Rebuild derived indexes from the active store.
4. Reconcile in the owning scope. Check the live revision, holds, and lease before a retry. Use `node hars-mem.mjs rebuild --agent ID` to repair a stale board after confirming the task records. Record an applied change after readback.
5. Flag an unclaimed write: a commit touching a task record or project file in the recent window whose author held no active lease, task row, or delegation on it. Warn only; let the owning agent explain or correct it rather than reverting automatically.
6. Sweep live claims for a dead holder, not just an expired one: a `doing` task whose lease has not yet expired but whose agent has posted no heartbeat or save in several TTL windows is already stale, just not yet reclaimable. Flag it instead of waiting out the full TTL. Treat an agent ID no longer in the active roster the same way: before reassigning or retiring any of its claimed work, settle each task on an actual receipt (`settle --as done` or `--as cancelled`; work replaced by a newer task settles as `cancelled` with that task's record as receipt) rather than silently relabeling or re-owning it to another agent.

**Example.** A write timed out after push. Read active main and the task revision, then look for the attempted commit and checkpoint. If it landed, record its receipt and retire the duplicate outbox item under your retention rules. Otherwise preserve the outbox, check the current lease and revision, and replay only the still-valid change. A save blocked by a hold can leave its only copy in the local outbox. Preserve it in an authorized recovery location and record the blocker without retrying the held action.

**Another example.** A shared checkout with worktrees but no per-worktree Git config lets every worktree share one `.git/config`. A worktree commit that sets `user.name`/`user.email` globally, instead of scoping it to that one command, silently rewrites the shared checkout's identity and leaks the writer into checkouts that never ran that commit. Set identity per command only (`git -c user.name=... -c user.email=... commit`, or the `GIT_AUTHOR_*`/`GIT_COMMITTER_*` environment scoped to that one process) inside any worktree, never a bare `git config user.*`. Confirm the shared checkout's identity afterward and restore it if it drifted.

**Another example.** An owner's automation let a write attributed to an unverified relay (someone quoting a decision on another person's behalf, not that person's own write) fall back to committing under the account owner's own identity whenever the actual writer was missing, instead of refusing the write. A batch of tasks piled up under retired one-off agent IDs, each still showing as `doing` long after those agents stopped running, because nothing treated a dead-but-unexpired claim as different from a live one. The fix has two halves: identity assignment fails closed (refuse the write without an explicit, verified actor, never default to the owner) rather than accepting a name typed after a colon; and a claim held by an agent ID no longer in the active roster gets the same stale-claim sweep as a lease approaching expiry (point 6 above), re-owned or settled with a receipt rather than left to rot.

## Optional upkeep and missed runs

Start with the manual commands above. If the owner authorizes a cadence, choose an operator and backup, an IANA time zone, and a private destination. Start with a daily read-only check and a weekly human review of recurring failures. Keep the schedule and receipts in the owning scope.

An optional runner can use a scheduler to wake a durable ledger. Key each occurrence by schedule ID, policy version, and scheduled UTC instant. Under a compare-and-swap lock, reconcile uncertain runs, list missing occurrences, and apply the owner's skip, coalesce, or bounded replay policy. Limit retries and concurrency. Advance the success watermark after readback. Record every skipped or failed occurrence with its reason and manual recovery command. Keep credentials at the runtime boundary and require destination idempotency before automating an external side effect.

For approved sources that can replay from a cursor, use the [owner-controlled recurring ingestion runner](../../INGESTION.md). Check each source's coverage and use the outbox when a write outcome is uncertain.
