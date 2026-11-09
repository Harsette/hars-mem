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

**Example.** A write timed out after push. Read active main and the task revision, then look for the attempted commit and checkpoint. If it landed, record its receipt and retire the duplicate outbox item under your retention rules. Otherwise preserve the outbox, check the current lease and revision, and replay only the still-valid change. A save blocked by a hold can leave its only copy in the local outbox. Preserve it in an authorized recovery location and record the blocker without retrying the held action.

**Another example.** A shared checkout with worktrees but no per-worktree Git config lets every worktree share one `.git/config`. A worktree commit that sets `user.name`/`user.email` globally, instead of scoping it to that one command, silently rewrites the shared checkout's identity and leaks the writer into checkouts that never ran that commit. Set identity per command only (`git -c user.name=... -c user.email=... commit`, or the `GIT_AUTHOR_*`/`GIT_COMMITTER_*` environment scoped to that one process) inside any worktree, never a bare `git config user.*`. Confirm the shared checkout's identity afterward and restore it if it drifted.

## Optional upkeep and missed runs

Start with the manual commands above. If the owner authorizes a cadence, choose an operator and backup, an IANA time zone, and a private destination. Start with a daily read-only check and a weekly human review of recurring failures. Keep the schedule and receipts in the owning scope.

An optional runner can use a scheduler to wake a durable ledger. Key each occurrence by schedule ID, policy version, and scheduled UTC instant. Under a compare-and-swap lock, reconcile uncertain runs, list missing occurrences, and apply the owner's skip, coalesce, or bounded replay policy. Limit retries and concurrency. Advance the success watermark after readback. Record every skipped or failed occurrence with its reason and manual recovery command. Keep credentials at the runtime boundary and require destination idempotency before automating an external side effect.

For approved sources that can replay from a cursor, use the [owner-controlled recurring ingestion runner](../../INGESTION.md). Check each source's coverage and use the outbox when a write outcome is uncertain.
