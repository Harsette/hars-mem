# Agent snapshots

One latest file lives at snapshots/<agent>/LATEST.md. Keep it portable and link to sources for facts that change.

~~~md
# Agent snapshot

- Role and scope
- Reusable working method and style
- Skills and routines with paths
- Connector names and capabilities
- Last handoff with task ID, checkpoint path, and commit
- Export gaps
~~~

Run **snapshot** at a handoff, at the end of a session with reusable work, or after changing a method. Keep credentials, private platform instructions, and project status out of the snapshot. The agent registration points here and Git retains previous versions.
