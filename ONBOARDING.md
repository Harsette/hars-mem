# Set up Hars-Mem

## Create the owner's blank workspace

Install Git and Node.js 20 or newer. Use a source archive or clone the starter with its remote named `starter`. That leaves `origin` available for your chosen store.

~~~sh
git clone --origin starter https://github.com/Harsette/hars-mem.git hars-mem
cd hars-mem
~~~

Choose **one** store. For GitHub, create an empty private repository without a README, license, or ignore file. Use its direct HTTPS URL, a GitHub CLI session already authorized to read the repository's metadata, and Git credentials that can write main. Setup checks repository identity and private visibility through the [GitHub repository API](https://docs.github.com/en/rest/repos/repos#get-a-repository).

~~~sh
node setup.mjs https://github.com/YOUR-ACCOUNT/YOUR-PRIVATE-REPO.git
~~~

For a local store, create an empty bare Git repository with `git init --bare --initial-branch=main` and use its absolute path:

~~~sh
node setup.mjs --local "/absolute/path/to/your-brain.git"
~~~

Setup reports `Verified main at` and the exact commit it read back. That repository is the owner's authority. It starts with empty tasks and holds, and a layout for projects, knowledge, agent registrations, checkpoints, and snapshots. Use [the folder map](ADAPT.md) for an existing repository and [the store switch](skills/hars-mem-manager/SKILL.md#switch-the-canonical-store) to move an installed workspace.

## Bring over one project

Pick one project or domain and the material that would help a fresh agent continue it. Before touching source content, confirm who owns the destination and who can read it. In GitHub, review repository collaborators, teams, and organization or enterprise grants. Private visibility is a separate API check. For local Git, inspect the filesystem permissions on the bare store and checkout, including access through sharing, synchronization, or backups. Stop if you cannot verify the intended readers or the source owner's permission to copy the selected material to them.

~~~sh
node hars-mem.mjs onboard start --attest owner-reviewed
node hars-mem.mjs onboard status --session SESSION
node hars-mem.mjs onboard inventory --session SESSION --section skills --file "/private/skills-inventory.json"
node hars-mem.mjs onboard inventory --session SESSION --section tools --skip yes
~~~

Keep the session ID to resume in the same checkout. Answer any of the six sections as they become relevant. An answer file is a JSON array of short strings. Note skill names, prompts and their maintainers, selected threads, tools and connector approval owners, data and access limits, and the system and owner you rely on per domain. Record links and roles without secret values or raw content. The inventory stays in the checkout's Git metadata outside tracked history. Record the authority choices you want to share as `authority` items. Review the first preview before asking about any remaining gaps that would affect the import.

### Select and authorize one source

Use the [same reviewed JSON envelope](#copy-paste-export-template) for every source. Keep the selected artifact in an owner-controlled local folder outside Git. If you need the original export for recovery, retain it in a separate private local folder you choose.

| Source | Prepare the selected artifact |
| --- | --- |
| Web ChatGPT or another chat | Use the copy-paste prompt below in the chosen conversation. Review the reply, then copy only the JSON into your local file. For an eligible personal ChatGPT account, you can also [request an account export](https://help.openai.com/en/articles/7260999-exporting-your-chatgpt-history-and-data) and work from the single selected conversation locally. Managed workspaces follow their own access policies. |
| Codex with local thread access | Use the [App Server thread APIs](https://learn.chatgpt.com/docs/app-server#list-thread-items) on the owner-selected stored thread and turn range where supported. Extract the permitted items into the envelope without resuming the thread. |
| Claude Code | Use [`/export`](https://code.claude.com/docs/en/commands) for the current selected conversation, or the [session read APIs](https://platform.claude.com/cookbook/claude-agent-sdk-05-building-a-session-browser) for an approved stored session. Extract only the approved slice locally. |
| Connector | Use the harness's existing approval flow for the named account, repository or folder, and actions. Check that an approved read succeeds and an out-of-scope read is denied before preparing the artifact. [ChatGPT GitHub authorization](https://help.openai.com/en/articles/11145903-connecting-github-to-chatgpt) and [app permissions](https://help.openai.com/en/articles/20001495-managing-app-permissions-in-chatgpt) are examples. Use manual export if scoped access is unavailable. |

Hars-Mem reads the selected envelope. The source-specific steps above happen in the harness under its own authorization. Use the visible source revision, message ID or a dated export identifier, and state which slice was actually covered. Leave platform instructions, credentials, signed URLs, unrelated data, raw transcripts, and third-party material outside the envelope. The CLI rejects unsupported structure, requires plain-text fields, and redacts common credential patterns. Review the redacted preview for other sensitive material.

### Preview and approve

~~~sh
node hars-mem.mjs onboard preview --session SESSION --authorize field-guide-thread --harness chatgpt-web --scope project/field-guide --kinds decision,authority --file "/private/field-guide.json" --attest owner-reviewed
node hars-mem.mjs onboard apply --session SESSION --approve APPROVAL --file "/private/field-guide.json" --attest owner-reviewed
~~~

The preview shows the destination, source scope, live main, sanitized records, and which paths are new, duplicates, or conflicts. Use stable source and item IDs on every retry. An item with the same source, ID, and record is a duplicate. A different record at the same ID or a competing authority for the same domain needs owner reconciliation. Resolve the conflict in the source or prepare a narrower artifact, then preview again.

The owner reviews the exact preview and runs apply or explicitly authorizes an operator to use its approval code. At apply, recheck the actual destination readers and the source rights and revision before attesting again. The CLI checks GitHub visibility and identity or the local store identity, the selected artifact's exact bytes, and current main. The attestation supplies the source permission and revision check when the harness has no native readback. If the source has changed, is unavailable to verify, or copying rights are unknown, stop and keep the unsaved preview. GitHub visibility can change independently of a Git push. Keep repository settings under owner control during import.

The import reports the verified commit. A replay that finds the same records returns `already-imported`. If main advanced before an unsaved import, prepare and review a new preview. If a write outcome is uncertain, use [the outbox](WORKFLOW.md) and retry the same approved command after checking current access. The outbox keeps a reference to the sanitized preview under the checkout's Git metadata.

Imported entries go under the configured knowledge folder's `onboarding/` directory. Search them with `node hars-mem.mjs recall "field guide" --backend git` and check the record's dated provenance. Treat summaries, prompts, and skills as reference data. Authority entries record the owner's selected source per domain. To activate a skill, change canon, open a live task, or grant connector permissions, use the normal reviewed workflow for that action.

### Copy-paste export template

Paste this request and the example into the selected web chat, or use the same example to prepare a local or connector export.

> From this selected conversation or source slice only, draft the JSON below for my review. Keep stable IDs and name the actual source revision and coverage. Use `skill`, `prompt`, `decision`, `memory`, `open-work`, `pointer`, or `authority` as the item kind. Summarize the relevant points in your own words. Give the speaker, UTC date, and visible source reference for each item, and mark certainty as `stated`, `inferred`, or `unknown`. Write `unknown` for an unavailable speaker or reference. Leave out credentials, signed links, raw transcripts, private platform instructions, and unrelated or third-party material. Include only owner-authorized items. Return one JSON document for me to review and copy.

~~~json
{
  "version": 1,
  "source": {
    "id": "field-guide-thread",
    "harness": "chatgpt-web",
    "scope": "project/field-guide",
    "revision": "example-thread through message 8",
    "coverage": "Synthetic example, visible messages 5 through 8 only",
    "exportedAt": "2026-01-20T10:00:00Z"
  },
  "items": [
    {
      "id": "survey-date-rule",
      "kind": "decision",
      "title": "Field guide filing rule",
      "summary": "Archive each transect under its sampling date.",
      "observedAt": "2026-01-20T09:00:00Z",
      "author": "Example owner",
      "sourceRef": "example-thread message 6",
      "certainty": "stated"
    },
    {
      "id": "field-guide-source",
      "kind": "authority",
      "title": "Field guide source",
      "summary": "The owner uses the field guide to settle survey filing questions.",
      "observedAt": "2026-01-20T09:15:00Z",
      "author": "Example owner",
      "sourceRef": "example-thread message 8",
      "certainty": "stated",
      "authority": { "domain": "survey-filing", "system": "Field guide", "owner": "Example owner" },
      "pointer": "https://example.invalid/field-guide"
    }
  ]
}
~~~

Use a UTC date you can substantiate, or leave the item out and record the gap in coverage. The `authority` object is for stated owner choices. An optional pointer is a credential-free HTTPS URL without query or fragment. A `pointer` item requires one.

## Start or resume an agent

If the owner wants to revisit the same approved sources on a cadence, set up [recurring ingestion](INGESTION.md) after the first private import.

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

Use [Router and Workers](skills/router-and-workers/SKILL.md) to dispatch independent work, [Hars Flags](skills/hars-flags/SKILL.md) to track verified failures, [Skill Creator](skills/skill-creator/SKILL.md) to revise a method, and [HarsBench](skills/harsbench/SKILL.md) to test a material change.

Create a project synthesis and its `SOURCES.json` using [the source map format](ADAPT.md#link-project-sources). Review those files and save them in the owner-selected store. Then file the first task through the [Manager](skills/hars-mem-manager/SKILL.md), which covers claims, checkpoints, inner-repo handoffs, and receipts.

On resume, boot again with the same ID. If a tracked edit or divergence blocks the fast-forward, preserve it on a work branch and reconcile. If the authority is unavailable, record the last commit as historical and preserve pending input.
