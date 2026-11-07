---
name: skill-creator
description: Turn a repeatable workflow with evidence into one portable skill, or improve a skill after a verified failure.
---

# Create or revise a skill

1. Start from a real run. Record the owner's desired result, the exact failure or success, and a dated receipt. Inspect the relevant trace and check current sources for anything that can change.
2. Look for a skill with the same trigger. Update it if it already owns the job. Keep one narrow trigger, the steps that change the outcome, one working example, and a pointer to the current source.
3. Keep approved raw evidence with its source owner, with bytes or a digest and source permissions. Keep dated claims in cards, current conclusions in a project synthesis, work status in task records, and reusable method in the skill. Link these with stable IDs. Share only the pointers the next agent needs.
4. Check exact answers first. Verify unique IDs, parseable dates and front matter, source paths and revisions, and hashes where available. Use the smallest suitable model only for an ambiguous comparison. Give it the specific claims and sources. The domain owner resolves authority and approves changes to canon.
5. Compare the skill against the same task without it. Include a held-out case and a case that should stop or route elsewhere. Save commands, outcomes, and failures. Revise or retire a skill that adds steps without improving the result.

Use [HarsBench](../harsbench/SKILL.md) for a blind comparison. File verified failures through [Hars Flags](../hars-flags/SKILL.md).

## Portable card convention

This is a Markdown convention for the configured knowledge folder. Validate it in your own workflow. Hars-Mem's built-in `check` compares the board with task records.

~~~yaml
---
id: inventory/stock-count-cutoff
kind: observation
scope: inventory
observed_at: 2026-01-20T09:00:00Z
authority: source-owner
source: evidence/stock-count-20260120.json
source_revision: FULL_GIT_SHA_OR_PROVIDER_REVISION
supersedes: null
---
~~~

A correction states which claim it supersedes, who authorized it, and which synthesis or skill relies on it. Update the dependent pointers. When policy calls for forgetting, remove or restrict access through the source owner's authorized process, rebuild affected summaries and search, and retain only permitted audit metadata.

**Example.** A fresh worker used an old stock cutoff. Save the dated observation and its replacement, then revise the existing inventory skill to read the current cutoff. Test both cutoffs, attach the readback as the receipt, and leave the raw export with its owner.
