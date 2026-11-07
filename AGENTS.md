# Hars-Mem operating rules

The owner's selected Git store holds current canon. Start and resume from its live main and report the commit you read. Use a historical commit for recovery and live main for claims. [Onboarding](ONBOARDING.md) and the [Manager](skills/hars-mem-manager/SKILL.md) cover setup and store changes.

## Start an agent

- Boot with the owner-assigned ID, role, scope, and capabilities. Check the returned canon commit and registration. Reuse the same ID and scope for a persistent agent and keep private native state in its harness. A reviewed portable snapshot carries reusable craft and source pointers. [Persistent-agent checklist](ONBOARDING.md#persistent-agent-checklist)
- A fresh chat talking to the owner takes the outer role. A dispatched agent takes the worker role and boots under its own ID. Use the task packet for the approved project, scope, and proof. [Router and Workers](skills/router-and-workers/SKILL.md)

## Work and hand off

- Read the live board, task brief, [holds](holds.json), and relevant project sources. Verify current facts in the system that owns them. Apply the latest authenticated owner decision and keep holds in force until authorized release. Get owner approval before spending, publishing, contacting someone, or speaking on their behalf.
- A worker runs `start --packet minimal`, checks `ready` and the live lease, and follows the project repo's instructions. Renew the lease with `heartbeat` during long work, use `save` to checkpoint, and release when pausing. The holder finishes with verified evidence. [Work loop](WORKFLOW.md)
- Report a saved result after readback from the active store. A read-only agent passes an **UNSAVED** draft and its source revision to the authorized writer. [Hosted handoff](HOSTED.md#a-read-only-connector)

## Keep evidence in scope

Keep raw material under its approved source permissions and retention rules. Keep credentials and restricted material out of Git. Put scoped synthesis and source links in knowledge, live status and verified receipts in task records, and project work in the repo that owns it. Use the [folder map](paths.json) and follow the owner's authorized cadence for [recurring ingestion](INGESTION.md).

File verified failures through [Hars Flags](skills/hars-flags/SKILL.md). Use [Skill Creator](skills/skill-creator/SKILL.md) to revise a method and [HarsBench](skills/harsbench/SKILL.md) to compare it blind.
