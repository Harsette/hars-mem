# Why Hars-Mem works the way it does

Hars-Mem lets several agents share one memory without trusting each other's recollection. Chat memory and vector stores keep what an agent said; Hars-Mem keeps what was decided, who holds the work and what proves it is done, in Git you already trust. Each choice below names the failure it prevents, the mechanism that prevents it, and where you see it work.

## One source of truth

### One Git store, read live from main

The owner's selected Git store is canon. Every agent reads it from live main, and every report names the commit it read.

Agents running in different chats, tools and machines each keep their own memory. Without one authority, two agents act on two versions of the same decision, and nobody can tell which one was current.

`node setup.mjs` reports `Verified main at` with the exact commit it read back. `boot` fetches main and returns `canonCommit` and `registrationPath`. `start` fetches main, fast-forwards a clean local main, reopens the updated CLI, and only then claims. Local divergence stops the launch. Every write builds a commit whose parent is the exact main commit it read, and Git accepts the push only while main still points at that parent (`--force-with-lease` in [store.mjs](../store.mjs)). The CLI reads the result back before reporting it. Historical commits are for recovery only. Clients refuse live reads and writes against a store frozen by `store migrate`. See [WORKFLOW.md](../WORKFLOW.md) and [ONBOARDING.md](../ONBOARDING.md).

### Read status live each time you report it

Status in a report comes from main at the moment of the report, never from an earlier report.

An open or done claim copied forward is how a finished task gets reported as still open, and how a stalled one gets reported as done. Each copy looks authoritative and none of them was checked.

`BOARD.md` is generated from task records and shows each lease as recorded. `node hars-mem.mjs board` reports whether each lease is live against current UTC. `node hars-mem.mjs check` compares the board with the records, and `rebuild` repairs a stale board. Hosted readers open `AGENTS.md` and `BOARD.md` at the same commit and record that SHA ([HOSTED.md](../HOSTED.md)). [HarsBench](../skills/harsbench/SKILL.md) task A tests exactly this: an agent that reports the old plan instead of the later verified receipt fails hard.

## Status, claims and receipts

### Board rows hold status; prose holds the why

Everything that can change or close gets one task record, and the board is built from those records. Synthesis, checkpoints and notes carry the reasoning. A handoff is a board task that names the next agent.

Status written into prose drifts, because nothing forces anyone to update a paragraph when the work moves. A handoff note in prose reaches nobody: no agent is assigned to read it, and nothing on the board says work is waiting.

`node hars-mem.mjs add project/task --agent ID --goal "..." --done-when "..."` creates the row, with `--files`, `--excluded` and `--proof` when scope must be explicit. `brief` returns the packet the next agent works from. `save --detail` records progress and a next step on the row, and `--status blocked` or `--status waiting` names the cause. [Claim and Progress](../skills/claim-and-progress/SKILL.md) states it plainly: task rows produce the board, so keep status in those rows.

### Claim before work, heartbeat, release on pause

An agent claims a task before touching it, renews its lease during long work, and releases it when it pauses.

Two agents on one task duplicate the work at best and overwrite each other at worst. An agent that stops without releasing leaves a task that looks owned and is not.

`start` claims and returns `ready` with the live lease. A second claim fails while the first lease is live, with `Live lease held by AGENT through TIME.` The default lease is 15 minutes, and `--ttl` sets it anywhere from 1 second to 4 hours. `heartbeat` extends it. `release` returns an in-progress task to open, with its checkpoint still at a tracked path. The CLI checks the clock before every push and refuses with `Lease expired before push. Read the live task before retrying.` A readback that crosses expiry returns `expiry-crossed-at-readback`, and `start` returns `ready: false` without its packet when the lease is inactive at readback. That commit landed after the lease ran out, so review it before reporting the work as on time.

### Settle zombie claims with a receipt

A lease that is live but whose holder is dead, or any claim held by an agent ID no longer in the active roster, is flagged as stale before it expires and settled with a receipt.

A dead holder's lease blocks work until it expires, and a retired agent's `doing` tasks never move. Silently relabeling or re-owning them erases the record of what happened to the work.

The [Manager](../skills/hars-mem-manager/SKILL.md) sweep and [Zero Drift](../skills/zero-drift/SKILL.md) step 6 flag a `doing` task with no heartbeat or save in several TTL windows, and any claim held by an ID outside the roster. Each one gets `settle --as done`, `cancelled` or `superseded` with evidence, never a quiet edit.

### Receipts that resolve

A task closes only with a receipt that leads to the evidence: a full commit SHA reachable from main, a tracked file path, or an HTTPS link.

A receipt that only has the right shape proves nothing. A forty-character string that is not on main, or a path to a file that was never committed, closes a task on evidence nobody can open.

`receiptAt` in [hars-mem.mjs](../hars-mem.mjs) checks each form. A SHA must be an ancestor of main: `Use a full commit SHA reachable from origin/main.` A path must be a file on main: `Receipt file must exist on origin/main.` A URL must carry no credentials: `Receipt URL must be credential-free.` Anything else gets `Use a tracked path, full commit SHA, or HTTPS evidence URL.` `finish`, also available as `settle`, records the receipt and releases the claim in one commit. The CLI checks files and SHAs. The agent checks a link before attaching it. Another repo's commit goes in as its URL, or as a tracked receipt file naming that repo, the full commit and the evidence path.

## Identity and authority

### Commit as the agent that did the work

Every write is attributed to the agent that did it. The owner's identity is reserved for the owner's own decisions.

The history is how anyone later decides which rules the owner actually set. An agent write under the owner's identity is a forged decision: it reads as the owner's call, and the owner never made it.

The CLI commits under a neutral `Hars-Mem` identity, refuses an agent that has not registered, and puts the agent ID in the commit message (`Claim TASK for AGENT`) and on the lease, checkpoint and receipt it writes. For a direct Git commit, set identity per command with `git -c user.name=... -c user.email=... commit`, or with `GIT_AUTHOR_*` and `GIT_COMMITTER_*` scoped to that one process. [Zero Drift](../skills/zero-drift/SKILL.md) shows how a bare `git config user.*` in one worktree rewrites the identity of every worktree sharing the checkout. Identity assignment fails closed: no verified actor, no write, and never a fallback to the owner.

### Owner approval bound to exact bytes

An owner approval is a code computed from the exact content the owner reviewed. Change the content and the approval stops matching.

A literal flag anyone can type is not a review. A scheduled job that passes `--attest owner-reviewed` keeps running after its allowlist gains a source nobody looked at.

`onboard preview` returns an `approval` that is the SHA-256 digest of the plan. `onboard apply --approve APPROVAL` refuses with `The preview changed. Prepare and review it again.` when the saved preview no longer hashes to that code. Recurring ingestion works the same way. `node hars-mem.mjs ingest check --config FILE` prints an `approval` code: a hash of the allowlist's exact bytes and the destination's fingerprint. `ingest run --config FILE --attest CODE` refuses anything else with `The approval code does not match this allowlist and destination. Run ingest check --config, review the sources, and pass its approval code as --attest.` Change one byte of the allowlist, or point the checkout at another store, and the scheduled run stops until the owner reviews again. [tests/acceptance.mjs](../tests/acceptance.mjs) passes the old literal `owner-reviewed` and asserts that refusal. See [INGESTION.md](../INGESTION.md).

### Holds and approval before spending, publishing, contacting or speaking for the owner

Anything that spends, publishes, contacts someone or speaks for the owner stays a draft until the owner approves that item. A hold stays in force until an authorized release.

These actions are outward-facing and hard to undo. An agent acting on an approval the owner has since revoked does damage no later correction reverses.

[holds.json](../holds.json) lists holds, and `start` refuses a held task with `Task held.` followed by the reason. The [agent starter](../AGENT-STARTER.md) core block keeps these actions as drafts until the named approver approves, and tells the agent to stop at a hold or denial. [HarsBench](../skills/harsbench/SKILL.md) task B fails any agent that sends after the owner revoked approval. [Hars Flags](../skills/hars-flags/SKILL.md) is explicit: a flag records evidence and does not grant permission.

### One writer per file; lessons are proposals

Each file has one writer. A lesson an agent learns stays a proposal until the owner keeps it, and shared rules outrank one agent's own notes.

Two writers to one file means the second silently overwrites the first. An agent's private lesson applied as a rule spreads one agent's mistake to every agent that reads it.

Each task record carries a revision, and `--if-rev` stops a write when the revision you read has changed. A newer accepted claim fences any older update to the same task. Ingestion takes a lock, and a second invocation returns `overlap`. The starter core block puts `AGENTS.md` from live main above the agent's native memory. Imported material lands as reference data under the knowledge folder's `onboarding/` directory. Changing canon, activating a skill and opening a live task each go through their own reviewed workflow ([ONBOARDING.md](../ONBOARDING.md)). [Hars Flags](../skills/hars-flags/SKILL.md) keeps an unverified opinion as a proposal until there is a reproducible observation or an explicit owner correction.

## Methods and checks

### Methods live in skills, revised in the same pass, compared blind

A method that proves out goes into the skill that owns it in the same pass, and a material change is compared blind with HarsBench before it is trusted.

A method left in a report gets rediscovered, or lost, by the next agent. A skill change judged by the agent that wrote it reads as an improvement whether it is one or not.

[Skill Creator](../skills/skill-creator/SKILL.md) updates the existing skill with the same trigger instead of adding a new one, and files the smallest useful delta. [HarsBench](../skills/harsbench/SKILL.md) freezes the tasks, key and skill text. It runs a bare arm, the current skill and the candidate in three fresh contexts each, shuffles the answers under neutral labels and grades them before unmasking. A hard failure rules out an arm. A tied or noisy result keeps the current behavior.

### Cheap checks that actually check

The repo has fast checks that fail on the problems that cause drift, and they pass on a clean machine. Run `node --test tests/*.mjs` before every push.

A check that cannot fail is worse than none, because it reads as green. A test that passes only on its author's machine proves nothing to anyone else.

[tests/repo.mjs](../tests/repo.mjs) runs in seconds. It parses each skill's frontmatter strictly and requires `name` to match the folder and a `description` of 300 characters or fewer. It resolves every relative link in every tracked Markdown file. It scans the tracked tree for personal email addresses and for the shapes of GitHub, cloud and chat tokens and private keys. [tests/acceptance.mjs](../tests/acceptance.mjs) sets its own Git author and committer, so it runs on a machine with no `user.name`. [.github/workflows/test.yml](../.github/workflows/test.yml) repeats the same run on every push to main and every pull request.

## Safety and reporting

### Secrets, runaway cost and leaks guarded up front

Credentials stay out of Git, anything that loops has caps, and nothing personal leaves the private store. The guards are built in, not remembered.

A credential in history is exposed to every reader of every clone. An unbounded loop burns money and rate limits while nobody watches. A private brain pushed to a public repo is a leak no revert recalls.

Setup verifies a GitHub store's identity and private visibility through the GitHub API and refuses with `Choose a private GitHub repository.` `privateOrigin` in [store.mjs](../store.mjs) reruns that check before onboarding and ingestion touch the store, and the public starter refuses outright: `The public starter cannot be the private store.` Onboarding redacts common credential patterns and requires plain-text fields. Receipt URLs and live source pointers must be credential-free. Ingestion caps an allowlist at 12 sources, `maxBatches` at 8, a feed at 16 batches and 128 KiB, and retained raw chat at 512 KiB kept outside Git. A guarded write makes at most five attempts against live main. A feeder's access check expires after 24 hours. Before shipping a script, loop or scheduled task, check it for exposed credentials, runaway cost and personal-data leakage, and build the guard into it.

### Reports lead with the result and the reason

Every report opens with the result and why, and names a risk only when it changes the action.

A report that opens with caveats buries the answer, and a reader who sees a risk line on every report stops reading them. A save reported before readback is a claim, not a result.

Report a save only after the CLI reads it back, with the commit and path. A read-only agent hands over an `UNSAVED HANDOFF` with the commit it read and the task revision ([HOSTED.md](../HOSTED.md)). The HarsBench common prompt asks for the current state and the next authorized action in two sentences.

## What changed in this update

12 Nov 2026

- `ingest run --attest` takes the approval code from `ingest check --config` instead of the literal `owner-reviewed`. Breaking: update every scheduled run with the code.
- Added [tests/repo.mjs](../tests/repo.mjs). Acceptance tests set their own Git identity. [.github/workflows/test.yml](../.github/workflows/test.yml) runs `node --test tests/*.mjs`.
- [AGENTS.md](../AGENTS.md) gains four rules: board-task handoffs with resolving receipts, commit as the agent, read status live, and one writer per file with learned lessons as proposals.
- Added docs/WHY.md, this page.
