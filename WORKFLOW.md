# Work loop

## Route

The outer agent reads the board and current rules, finds or adds a row, and dispatches the packet from **brief** with the task ID and original ask. Use your task ID in the commands below. A worker boots under its own ID and claims before work.

~~~sh
node hars-mem.mjs board
node hars-mem.mjs brief your-project/first-task
node hars-mem.mjs start your-project/first-task --agent desk-agent
~~~

**Start** fetches main, fast-forwards a clean local main if needed, reopens the updated CLI, and then claims and returns live rules and the task packet. Local divergence or tracked edits that prevent the update stop the launch. Save those edits on a work branch and retry from clean main.

A second claim for the same task fails while the first lease is live. The default lease is 15 minutes. Renew before expiry during long work. A Git checkout keeps its claim token across process restarts. Release or wait for expiry before resuming from another checkout.

## Save and hand off

Create a UTF-8 draft.md with the current working text and save it with a next step.

~~~sh
node hars-mem.mjs heartbeat your-project/first-task --agent desk-agent
node hars-mem.mjs save your-project/first-task --agent desk-agent --detail "Draft saved. Next, compare the wording with the release notes." --file draft.md
node hars-mem.mjs release your-project/first-task --agent desk-agent
~~~

Use **--status blocked** or **--status waiting** with the cause or required decision. Releasing an in-progress task makes it open. A released checkpoint stays visible at its tracked path.

Use **--if-rev** with the last revision you read when resuming delayed work or running parallel tool calls from the same checkout. The write stops if that revision has changed.

On the next machine, boot the receiving agent and run **brief**, then **start** once the task is unclaimed. Read the checkpoint with **git show COMMIT:PATH** using the returned commit and checkpoint path. Check the draft against the source. Save your finished work and pass the resulting SHA and evidence path to the reviewer. Once they accept it, the lease holder runs **finish** with the actual path.

~~~sh
node hars-mem.mjs finish your-project/first-task --agent receiving-agent --receipt checkpoints/your-project/first-task/REPLACE-WITH-ACTUAL-FILE.md
node hars-mem.mjs board
~~~

**Finish**, also available as **settle**, records the receipt and releases the claim in the same commit. Use an existing file, a full commit SHA reachable from main, or a verified HTTPS evidence link. The CLI checks a file or SHA. The agent checks external links. Use **--as cancelled** with evidence of a verified stop.

## Save portable memory

Use the [snapshot format](snapshots/README.md) for craft that another harness needs. Link to sources where facts may change.

~~~sh
node hars-mem.mjs snapshot --agent desk-agent --file my-snapshot.md
~~~

The agent registration points to the snapshot. Git retains its history. After saving, check the lease and board before taking new work.

## Recover a failed write

1. Run **node hars-mem.mjs outbox** for locally preserved inputs. The error prints the recovery path. The JSON holds the attempted operation, note, and exact file bytes in base64. The original source file stays in place.
2. After connectivity returns, run **brief** and **board**. If the last write returned an uncertain commit SHA, check whether origin/main contains it. Compare revision, lease, receipt, and checkpoints before retrying.
3. If another agent owns the task, send the preserved draft and evidence to that agent. If the lease expired, read what changed before taking a new claim.
4. The CLI retries unrelated changes against live main and stops a conflicting update to the same task. For edits to canon or project files, use a separate Git branch and review changes before merging.

Each write uses a commit whose parent is the exact main commit it read. Git accepts it only while main still points at that parent. The CLI reads back the result. Each task record holds its lease and generates the board.

Lease expiry makes a task eligible for takeover. The CLI checks the clock before a push, and a newer accepted claim fences any older task update. Git can accept an in-flight push after expiry if the previous revision still owns main. A readback that crosses expiry returns the accepted commit with **expiry-crossed-at-readback**. Review it before claiming timely completion. Start returns **ready: false** and omits its dispatch packet if its lease is inactive at readback. Strict acceptance-time expiry needs a server or bridge that checks the lease at write time. Lease timestamps use UTC and depend on synchronized clocks. Use the target system's transaction or idempotency protection for irreversible external actions.
