# Recurring ingestion

Use recurring ingestion when you have a few sources an owner-approved feeder can already read. The feeder hands Hars-Mem a small local JSON file. The runner verifies the private destination, imports only the allowed summaries and pointers, and records what it accepted in the same commit as the source cursor.

## Set up and run once

1. [Set up a private store](ONBOARDING.md#create-the-owners-blank-workspace). Use a standalone checkout on one owner-controlled writer host. The checkout and live main must use the same release.
2. Run `node hars-mem.mjs ingest check` in the checkout. Copy the returned `target` into a local allowlist file. Keep the file, feed files, and any selected raw exports outside Git in directories restricted to the intended readers.
3. Review who can read the store and verify the feeder's copying rights for each specific account, repository, folder, or conversation. Set up the feeder in its existing authorized harness. Test a permitted read and a denied read using that harness.
4. Run once by hand. Check each source's status, its coverage, and the verified commit before enabling a cadence.

~~~sh
node hars-mem.mjs ingest check --config "/private/ingestion.json"
node hars-mem.mjs ingest run --config "/private/ingestion.json" --attest APPROVAL
~~~

`ingest check --config` returns an `approval` code: a hash of the allowlist's exact bytes and the destination. The owner reviews that check output and the run passes the code as `--attest`. Change one byte of the allowlist or point the checkout at another store and the code stops matching, so the scheduled run refuses until the owner reviews again. Put the code in the schedule, never a literal word.

The allowlist is version 1. The `target` is the exact value returned by `ingest check`. List up to twelve sources, each with a unique stable `id`, a `harness`, a `scope` such as `project/field-guide`, and a `type` of `connector`, `selected-chat`, or `manual`. Set `kinds` to the allowed reference kinds, `feed` to an absolute file path, and `maxBatches` to 1 through 8. The reference kinds are `skill`, `prompt`, `decision`, `memory`, `open-work`, and `pointer`. Use the [reviewed onboarding workflow](ONBOARDING.md#preview-and-approve) for authority changes and owner-approved canon.

## Feeder contract

An approved feeder can be a script or a harness operator. Read only the configured source and approved slice using the harness's existing credentials. Inspect the accepted cursor with `ingest check --config ...`, recheck current source permission, and create a complete new feed in a temporary file before replacing the configured feed file. Keep provider pagination tokens and credentials at the source boundary. The runner opens only the selected files in the allowlist.

| Field | Value |
| --- | --- |
| `version`, `source` | `1` and the allowlisted source ID |
| `checkedAt`, `coverage` | UTC instant when access was checked and a short, safe description of the actual slice or gap |
| `status` | `ready` with `batches`, `current` with the accepted `cursor` or `null`, or `denied` / `failed` with neither |
| Each ready batch | `after` cursor or `null`, a new stable `cursor`, a strictly increasing UTC `through` watermark, and the `export` from the [onboarding JSON template](ONBOARDING.md#copy-paste-export-template) |

Use lower-case stable IDs for cursor values and leave provider secrets out. Keep old batch contents stable on replay. Give a genuinely new revision a new item ID, such as `note-42-r2`. A changed item at an existing ID requires owner review. The ready file accepts up to sixteen contiguous batches and 128 KiB of JSON. An eligible batch must begin at the verified cursor. Put a confirmed empty window in a ready batch with one dated coverage observation if you need to advance the watermark. A `current` reply can confirm the existing cursor without changing it. A `ready` or `current` access check expires after 24 hours. Treat unsupported replay and source errors as gaps, and report them explicitly.

For a selected local export or copied web handoff, use the same envelope and a `selected-chat` or `manual` source. Use the [handoff prompt](ONBOARDING.md#copy-paste-export-template) for one visible conversation. An authorized person or harness confirms access and publishes the feed. If the source can only be handled interactively, use the regular preview and apply flow.

### Optional selected raw chat

When the owner also approves keeping one selected original locally, add `raw` to that `selected-chat` source with the exact absolute `file`, an existing private absolute `directory`, and a UTC `expiresAt`. Put the original's SHA-256 in that batch's `rawSha256`. The runner checks the selected file and retains up to 512 KiB under a filename that includes the expiry. Both locations must be outside Git. Review access for the directory and its backups, and remove retained files according to the owner's retention policy. The runner rejects new retention after expiry and leaves cleanup to the owner.

Raw originals stay local. Imported summaries are searchable reference data with dated provenance. The source still owns live facts, projects keep their own work, and the owner approves any update to canon separately.

## Run the synthetic example

Run these commands from the Hars-Mem source checkout using a shell with `mktemp` and `tar`. The example creates a disposable local bare store, one synthetic connector source, and a second source that reports denied access. Add `with-chat` to both feeder commands to exercise a selected chat export and local raw retention.

~~~sh
LAB=$(mktemp -d)
mkdir "$LAB/brain"
git archive HEAD | tar -x -C "$LAB/brain"
git init --bare --initial-branch=main "$LAB/owner.git"
cd "$LAB/brain"
node setup.mjs --local "$LAB/owner.git"
TARGET=$(node hars-mem.mjs ingest check | node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8')).target")
CONFIG="$LAB/feeds/synthetic-config.json"
node examples/ingestion-feed.mjs "$LAB/feeds" "$TARGET" cold
APPROVAL=$(node hars-mem.mjs ingest check --config "$CONFIG" | node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8')).approval")
node hars-mem.mjs ingest run --config "$CONFIG" --attest "$APPROVAL"
node examples/ingestion-feed.mjs "$LAB/feeds" "$TARGET" replay
node hars-mem.mjs ingest run --config "$CONFIG" --attest "$APPROVAL"
node hars-mem.mjs ingest run --config "$CONFIG" --attest "$APPROVAL"
node hars-mem.mjs ingest check --config "$CONFIG"
~~~

The first run accepts sample 1. The replay file contains samples 1 through 4, so the next run accepts 2 and 3 and reports backlog. The following run accepts 4. Replaying the same file again reports a duplicate. The denied source remains visible in every report.

## Schedule, pause, and recover

Once the owner approves a cadence, start with 02:00 in the owner's IANA time zone, such as `Asia/Dubai`. Use one writer. An agent schedule is suitable only when that exact runtime can read the approved source and invoke the runner on its authorized writer host. Use the OS scheduler for a local machine, or cron or a cloud scheduler on an always-on host. Keep provider credentials in the existing harness and use the same allowlist for manual and scheduled runs.

Wake the feeder before the runner. Pass the scheduled UTC instant as `--occurrence 2026-11-07T22:00:00Z` when the scheduler supplies it. A manual run without it records the current UTC instant. A skipped wake can be recovered by feeding from the last verified cursor where the source supports replay. Batches and the guarded Git retry loop are bounded. Continue a backlog on the next wake or by running again. Treat a reported gap as incomplete coverage.

`ingest run` emits JSON with per-source status and a local occurrence report path. Check the JSON `status` for `attention` or `overlap`, including when the command exits successfully after reporting individual source results. Accepted cursor and batch receipts live under the configured knowledge folder at `onboarding/ingestion/<source>/`. `ingest check` reads them from live main. For an uncertain result, check the live cursor and `node hars-mem.mjs outbox`, then recheck source access and replay the same feed. The cursor advances with the accepted private commit. Recover an outbox entry through its sanitized summaries or the feeder's retained input if the source cannot replay.

Pause the scheduler and wait for the current writer to finish. An overlapping invocation returns `overlap`. After a crash, use `ingest check` to locate the local lock. Check the `pid` in that file and confirm the writer stopped before removing the lock. Then check the live cursor and outbox before retrying. Keep the selected inputs until their receipts have been verified.
