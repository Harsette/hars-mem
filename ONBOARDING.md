# Set up Hars-Mem

## Create the owner's blank workspace

Install Git and Node.js 20 or newer. Use a source archive or clone the starter with its remote named `starter`. That leaves `origin` available for your chosen store.

~~~sh
git clone --origin starter https://github.com/Harsette/hars-mem.git hars-mem
cd hars-mem
~~~

Choose **one** store. For GitHub, create an empty private repository without a README, license, or ignore file. Sign in as a user with write access and run:

~~~sh
node setup.mjs https://github.com/YOUR-ACCOUNT/YOUR-PRIVATE-REPO.git
~~~

For a local store, create an empty bare Git repository with `git init --bare --initial-branch=main` and use its absolute path:

~~~sh
node setup.mjs --local "/absolute/path/to/your-brain.git"
~~~

Setup reports `Verified main at` and the exact commit it read back. That repository is the owner's authority. It starts with empty tasks and holds, and a layout for projects, knowledge, agent registrations, checkpoints, and snapshots. Use [the folder map](ADAPT.md) for an existing repository and [the store switch](skills/hars-mem-manager/SKILL.md#switch-the-canonical-store) to move an installed workspace.

## Start or resume an agent

Give the agent the **owner's repository URL or path** and say “Read ONBOARDING.md.” A shell agent with write access clones that repository. Run these commands from the checkout. Choose the agent ID, role, scope, and capabilities that match the runtime.

~~~sh
node hars-mem.mjs store check
node hars-mem.mjs boot --agent desk-agent --role outer --scope all --capabilities shell,git-read,git-write
node hars-mem.mjs board
~~~

`store check` identifies the authority and reports the result of the push negotiation. A successful negotiation is a preflight; a saved registration or task write with readback proves write access. Boot fetches current main, uses the current rules, and returns `canonCommit`, `registrationPath`, and the first task in scope, if one exists. An empty workspace returns `task: null` and `tasks: []`.

- **Persistent agent.** Reuse a stable ID and scope. Read current canon on start, resume, and any owner-authorized cadence. Keep native preferences and private memory in your harness. Reconcile shared claims against current canon yourself. If you pass `--memory PATH`, use a temporary, scoped text file; the CLI flags it for review. Boot reads your prior portable snapshot for the same scope when one exists. Save reusable craft and source pointers through `snapshot`; save task progress through `save`. Checkpoint and release before handing off.
- **Fresh chat.** Start from the selected repository and this page. Use the existing stable ID if the owner assigned the same role, or a new ID for a different role. Read the live board and the relevant brief, then resume from the written checkpoint. A chat talking to the owner takes the outer role; a dispatched agent takes the worker role. The task and receipt come from the store.

If the client only has a GitHub connector or browser, follow [the hosted handoff](HOSTED.md). Read the exact main commit, rules, and scoped task. If `.hars-mem-store.json` marks that commit frozen, treat it as historical and ask for the verified active store. Hand an unsaved draft to the authorized writer and check their readback before reporting it saved.

## Open the first project

Create a project synthesis and its `SOURCES.json` using [the source map format](ADAPT.md#link-project-sources). Review those files and save them in the owner-selected store. Then file the first task through the [Manager](skills/hars-mem-manager/SKILL.md), which covers claims, checkpoints, inner-repo handoffs, and receipts.

On resume, boot again with the same ID. If a tracked edit or divergence blocks the fast-forward, preserve it on a work branch and reconcile. If the authority is unavailable, record the last commit as historical and preserve pending input.
