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

From a full source checkout with Git and Node.js 20 or newer, run `node --test tests/acceptance.mjs`. The tests use disposable repositories.
