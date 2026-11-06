# Read and hand off from hosted clients

Use an authorized GitHub connector or browser to read the private repository. Open `AGENTS.md` and `BOARD.md` at the same main commit. For a specific task, open its task record and the project's `SOURCES.json` and `SYNTHESIS.md` if those files exist. Use [the folder map](paths.json) for their actual paths. Record the commit SHA and verify each link against it.

The board shows the lease recorded in Git. Check whether it is still live with `node hars-mem.mjs board` from a connected shell before acting on a task.

## A shell with write access

Run [the onboarding](ONBOARDING.md) and [work loop](WORKFLOW.md) in a checkout that has Git, Node.js, and authorized access to write to main. Report the saved commit and checkpoint path after the CLI verifies the write.

## A read-only connector

Pass the draft to an authorized shell or the agent currently holding the lease. Use this handoff format.

~~~text
UNSAVED HANDOFF
Repository and commit read
Task ID and revision
Source links checked
Draft text or attachment
Next step and evidence needed
~~~

The receiving agent reads the live brief and checks changes since the handoff. It claims the task before saving or routes the draft to the existing lease holder. Confirm the saved checkpoint from the repository after the write.
