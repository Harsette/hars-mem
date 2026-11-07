# Hars-Mem

Give your agents one place to pick up where the last one stopped.

Hars-Mem is a blank, Git-backed second brain for an owner's rules, project knowledge, tasks, and handoffs. A persistent agent and a fresh chat both start from the current rules and board. Give either agent the repository URL and ask it to read [ONBOARDING.md](ONBOARDING.md).

**[Start with a blank workspace](ONBOARDING.md)**

Your first boot returns the canonical commit, the agent registration path, and `task: null`. The board returns `tasks: []`.

~~~mermaid
flowchart TD
  A["Persistent agent or fresh chat"] --> B["One owner-selected Git store"]
  B --> C["Read current rules, board, and task"]
  C --> D["Claim and work in scope"]
  D --> E["Return a checkpoint or verified receipt"]
  E --> B
~~~

| Layer | Where to look |
| --- | --- |
| Canon | [AGENTS.md](AGENTS.md) and owner-approved decisions |
| Records | Task records, checkpoints, receipts, and repo-local work logs |
| Process | The [Manager skill](skills/hars-mem-manager/SKILL.md) and project skills |
| Situation | The current brief, live claim, and applicable [holds](holds.json) |
| Memory | Scoped [portable snapshots](snapshots/) with reusable craft and retrieval pointers |
| Project knowledge | Syntheses and [source maps](ADAPT.md#link-project-sources) that point to the records and live systems behind a fact |

Use a private GitHub repo or a local bare Git repo as the active store. The [Manager](skills/hars-mem-manager/SKILL.md) covers switching stores, routing work into an inner repo, and recovering from interruptions. [Hosted access](HOSTED.md) covers read-only clients. [Folder mapping and recall](ADAPT.md) covers adapting an existing repo and searching it with Git or a rebuildable SQLite cache.

## Choose your setup

~~~sh
git clone --origin starter https://github.com/Harsette/hars-mem.git hars-mem
cd hars-mem
~~~

Run [setup](ONBOARDING.md#create-the-owners-blank-workspace) once against an empty store you control. Give the agent that store's URL or path and ask it to read [onboarding](ONBOARDING.md#start-or-resume-an-agent).

| Agent | Where it starts |
| --- | --- |
| Persistent agent | Reuse its stable ID, keep native craft private, and read current rules plus its scoped portable snapshot. |
| Fresh chat | Start with the store address and onboarding. Read the live board and task brief, then resume from the saved checkpoint. |

## Stores and read paths

| Route | Capability and evidence |
| --- | --- |
| Private GitHub | Default canonical store. The initial [setup commit](https://github.com/Harsette/hars-mem/commit/f798e0abe3edab18ba0282044dfd960435dcb6bb) was written and read back on GitHub. The current [store preflight](store.mjs) was checked against GitHub with an authenticated read and dry-run push negotiation. |
| Local bare Git | Alternate canonical store. A real [cutover](skills/hars-mem-manager/SKILL.md#switch-the-canonical-store) between two local bare Git stores preserved the task and checkpoint, fenced clients still pointed at the old store, and let a fresh worker resume the same task. |
| Hosted connector or browser | [Read-only handoff](HOSTED.md). Read a pinned revision and send an unsaved draft to an authorized shell or current lease holder for write and readback. |
| Git or SQLite recall | Direct Git reads the selected revision. SQLite is an optional, rebuildable local cache of that same revision. [Recall and folder mapping](ADAPT.md#find-written-knowledge) |
| Non-Git adapters | Future examples include PostgreSQL, S3-compatible object storage, and SharePoint. The [adapter contract](skills/hars-mem-manager/SKILL.md#switch-the-canonical-store) defines the required revision, conditional write, and cutover behavior. |

## Release checks

At [8e71048](https://github.com/Harsette/hars-mem/commit/8e710484908258a1e0b914a15e09e6b63449a977), `node --test tests/acceptance.mjs` passed all four [acceptance tests](https://github.com/Harsette/hars-mem/blob/8e710484908258a1e0b914a15e09e6b63449a977/tests/acceptance.mjs) on Node 24.20.0. The suite uses disposable Git stores to test first boot and handoff, direct and cached recall, cutover and retry, and dispatch when a hold arrives during claim readback.

A separate local replay on the tree at [5b67719](https://github.com/Harsette/hars-mem/commit/5b67719cf4f6f1cf63959d06dfa89d6fd1c17889) verified blank setup, a persistent-to-fresh handoff, and a [minimal inner-repo handoff](skills/hars-mem-manager/SKILL.md#hand-off-to-an-inner-repo) that settled the central task with independently checked evidence. The GitHub store preflight and the local cutover are separate checks.
