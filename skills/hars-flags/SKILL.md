---
name: hars-flags
description: Record verified mistakes and owner corrections as existing board tasks, then reproduce, fix, and close with evidence.
---

# Hars Flags

Participating agents watch for explicit owner corrections, verified defects they find themselves, measured regressions, and repeated verified failures during assigned work or authorized upkeep. Keep a suspected issue or an unverified opinion as a proposal until there is a reproducible observation or an explicit owner correction.

Record one `project/flag-<stable-id>` on the existing board. Look up the ID before adding it. Record the exact date, the evidence path or receipt, the observed impact, and the next safe action. On a repeat, give the new receipt to the current holder so it can be saved to the same open task. If the flag is closed, link the new evidence to it in the owning project and route the recurrence to the owner.

If an issue affects a customer, permissions, spend, or an urgent live result, stop the affected action and escalate within existing authority. A flag records evidence and does not grant permission.

## File and close a synthetic flag

Run this in a disposable owner store with Git and Node.js. The example verifies a synthetic cursor readback and attaches that proof to the board task.

~~~sh
node hars-mem.mjs boot --agent quality-owner --role outer --scope field-guide --capabilities shell,git-read,git-write
node hars-mem.mjs add field-guide/flag-stale-cursor --agent quality-owner --goal "Investigate a stale cursor reported at 2020-01-21T09:00:00Z in the synthetic field guide" --done-when "Read back the verified sample-2 cursor and save the evidence"
node hars-mem.mjs brief field-guide/flag-stale-cursor --packet minimal
node hars-mem.mjs start field-guide/flag-stale-cursor --agent quality-owner --packet minimal
LAB=$(mktemp -d)
printf 'sample-2\n' > "$LAB/cursor.txt"
grep -qx 'sample-2' "$LAB/cursor.txt" &&
  printf 'Synthetic readback at 2020-01-21T09:15:00Z returned sample-2.\n' > "$LAB/verified-fix.md"
RECEIPT=$(node hars-mem.mjs save field-guide/flag-stale-cursor --agent quality-owner --detail "2020-01-21T09:00:00Z synthetic fixture reported sample-1 after sample-2. It would replay finished work. The verified readback supports closure." --file "$LAB/verified-fix.md" |
  node -p "JSON.parse(require('node:fs').readFileSync(0, 'utf8')).task.checkpoints.at(-1).path")
node hars-mem.mjs finish field-guide/flag-stale-cursor --agent quality-owner --receipt "$RECEIPT"
node hars-mem.mjs brief field-guide/flag-stale-cursor --packet minimal
~~~

## Review the queue

Use a manual board review or a weekly cadence the owner selects. Group repeats and reproduce the failure in the relevant setup. Put the smallest fix at the source of the problem. Use [Skill Creator](../skill-creator/SKILL.md) for a process change and [HarsBench](../harsbench/SKILL.md) for a material judgment or routing change. Rerun the original failure and close with the verified receipt. If it does not reproduce, preserve that outcome and let the owner decide whether it needs further work.
