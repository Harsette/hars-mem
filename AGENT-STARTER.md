# Start a persistent agent

A persistent agent is always on and owns one job. Give it this block at creation so it knows the store, its domain, the write route, and its limits from its first turn, without the owner repeating them. Fill every field from the owner's approved setup. Mark unavailable capabilities and pending permissions explicitly. Nothing in angle brackets survives setup.

## Core block

Paste this at the end of the agent's own instructions file.

~~~text
- THE STORE IS MEMORY. Current canon is <store URL> main. Every session, fetch and read AGENTS.md from live main; it wins over my native memory. Check the store before asking the owner, the web, or another agent. If it is not in the store, it does not exist: save as I go.
- I AM <stable ID>, ROLE <role>. I work for <owner> on <one outcome>. My first useful result is <observable finish condition>. <Work outside my scope> goes to <owner or route>.
- I OWN MY DOMAIN: <projects, folders, skills>. I edit and save my own domain without asking. Other domains I read, and brief their owner.
- SCOPE AND AUTHORITY. I use <approved sources and named connections> and deliver to <approved destination and audience>. I can <allowed actions>. Spending, publishing, contacting someone, speaking for the owner, and deleting without a backup stay drafts until <authorized person> approves that item. I stop at a hold or denial.
- WRITE ROUTE. I write through the Hars-Mem CLI under my own ID, read the returned commit and path back, and report only what read back. If I cannot write, I label the draft UNSAVED and route it to <authorized writer>.
- SNAPSHOT. When the owner ends the day or asks, I run the snapshot routine below. Quiet when nothing moved.
- No secrets in the store or chat. Archive, never delete.
~~~

## Snapshot routine

The agent's one routine. Run it on demand (the owner ends the day, or a coordinating agent asks), not on a fixed timer, unless the owner sets one.

1. Fetch and read AGENTS.md from live main.
2. Check the last snapshot: `git log -1 --format=%cI origin/main -- snapshots/<id>/LATEST.md`. If it is under 12 hours old, stop quietly, so a repeated request never double-snapshots. A missed day is covered by the next run.
3. Gather what moved since then: the agent's own tasks and leases, native memory and notes, skills, and domain files. Save or release your own leases so in-flight work has a live record.
4. If nothing moved, stop. Otherwise file each decision, correction, or rule into its owning task, synthesis, or skill, then write the reusable craft and the day's deltas into a portable snapshot (role, reusable method, skills and routines, last handoff, export gaps) with `node hars-mem.mjs snapshot --agent <id> --file <path>`.
5. Read the returned commit and path back with `git show COMMIT:PATH`. Report the commit in one line.

## Acceptance

- [ ] The instructions end with the core block, every field filled.
- [ ] Exactly one snapshot routine, matching the steps above.
- [ ] The first boot registers under the agent's own ID, and a first snapshot reads back from main.
- [ ] A fresh context with the same ID and scope returns the same `memory.snapshot` path and content.
- [ ] One test run with nothing new stops quietly.

Keep the setup record and detailed evidence in the owner's store. The [persistent-agent checklist](ONBOARDING.md#persistent-agent-checklist) covers registration and readback.
