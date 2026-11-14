#!/usr/bin/env node
// Skill check: scores every skill that carries evals.md against the scripted checks of
// skills/skill-creator/compounding.md. Model-free and read-only.
//   node skill-check.mjs [SKILL ...] [--all] [--json] [--root DIR]
// Exit 0 when every named skill passes C1 to C6, 1 when any fails, 2 when a named skill cannot be read.
// C7 (the latest proof ran against today's SKILL.md) is reported and never fails the run.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const rootAt = args.indexOf('--root');
const root = rootAt >= 0 ? args[rootAt + 1] : dirname(fileURLToPath(import.meta.url));
const named = args.filter((arg, i) => !arg.startsWith('--') && args[i - 1] !== '--root');

const section = (text, heading) => {
  const start = text.search(new RegExp(`^## ${heading}\\s*$`, 'm'));
  if (start < 0) return null;
  const rest = text.slice(start).split('\n').slice(1).join('\n');
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
};
const tableRows = (body) => (body || '').split('\n')
  .filter((line) => /^\|/.test(line.trim()) && !/^\|\s*-/.test(line.trim()))
  .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));

export function checkSkill(dir) {
  const name = dir.split(/[\\/]/).pop();
  const skillFile = join(dir, 'SKILL.md');
  const evalsFile = join(dir, 'evals.md');
  if (!existsSync(skillFile)) return { skill: name, error: 'no SKILL.md' };
  const skill = readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n');
  const evals = existsSync(evalsFile) ? readFileSync(evalsFile, 'utf8').replace(/\r\n/g, '\n') : null;
  const r = {}; const why = [];

  // C1 trigger
  const front = skill.match(/^---\n([\s\S]*?)\n---\n/);
  const field = (key) => { const m = front && front[1].match(new RegExp(`^${key}:\\s*(.*)$`, 'm')); return m ? m[1].replace(/^(["'])(.*)\1$/, '$2') : ''; };
  r.C1 = field('name') === name && field('description').length > 0 && field('description').length <= 300;
  if (!r.C1) why.push(`C1: name must equal "${name}" and description must be 1 to 300 characters (got ${field('description').length})`);

  // C2 learning loop
  const loop = section(skill, 'Learning loop');
  const loopNeeds = [['evals.md', /evals\.md/], ['Regressions', /Regressions/i], ['fresh session or chat', /fresh (session|chat)/i], ['the standard', /compounding\.md/]];
  const loopMissing = loop ? loopNeeds.filter(([, re]) => !re.test(loop)).map(([label]) => label) : ['the section'];
  r.C2 = loopMissing.length === 0;
  if (!r.C2) why.push(`C2: Learning loop is missing ${loopMissing.join(', ')}`);

  if (!evals) return { skill: name, onStandard: false, checks: r, why };

  // C3 regressions
  const reg = tableRows(section(evals, 'Regressions')).slice(1);
  const regBad = reg.filter((cells) => {
    const status = (cells[cells.length - 1] || '').toLowerCase();
    return !/^\d{4}-\d{2}-\d{2}$/.test(cells[0] || '') || !cells.some((c) => /^Yes if/.test(c)) || !['open', 'locked'].includes(status);
  });
  r.C3 = reg.length >= 3 && regBad.length === 0;
  if (!r.C3) why.push(`C3: ${reg.length} Regressions rows (need 3), ${regBad.length} missing a date, a "Yes if" check or an open/locked status`);

  // C4 checklist
  const items = [...(section(evals, 'Checklist') || '').matchAll(/^(\d+)\.\s+(.*)$/gm)];
  const itemNums = new Set(items.filter((m) => /^Yes if/.test(m[2])).map((m) => m[1]));
  r.C4 = itemNums.size >= 8 && itemNums.size === items.length;
  if (!r.C4) why.push(`C4: ${itemNums.size} distinct "Yes if" checklist items of ${items.length} numbered (need 8, all "Yes if")`);

  // C5 tasks
  const taskTable = tableRows(section(evals, 'Tasks'));
  const head = (taskTable[0] || []).map((h) => h.toLowerCase());
  const iKind = head.indexOf('kind'); const iKey = head.indexOf('key'); const iApplies = head.indexOf('applies');
  const tasks = taskTable.slice(1);
  const badTasks = tasks.filter((cells) => {
    if (iKey < 0 || iApplies < 0 || !/^Yes if/.test(cells[iKey] || '')) return true;
    const applies = cells[iApplies] || '';
    if (applies.trim() === 'all') return false;
    const nums = applies.match(/\d+/g) || [];
    return nums.length === 0 || nums.some((n) => !itemNums.has(n));
  });
  const kinds = tasks.map((cells) => (cells[iKind] || '').toLowerCase());
  r.C5 = tasks.length >= 4 && badTasks.length === 0 && kinds.includes('hard-fail') && kinds.includes('replay');
  if (!r.C5) why.push(`C5: ${tasks.length} tasks (need 4, one hard-fail, one replay), ${badTasks.length} without a "Yes if" key or an Applies list of existing checklist items${iApplies < 0 ? ', no Applies column' : ''}`);

  // C6 hygiene
  const dash = /[—·]/;
  const stale = /\[superseded\]|\(superseded\)|^\s*superseded:|kept as history/im;
  r.C6 = !dash.test(skill) && !dash.test(evals) && !stale.test(skill);
  if (!r.C6) why.push('C6: an em dash or middle dot, or text marked superseded or kept as history');

  // C7 proof is current (reported, never blocks)
  const results = tableRows(section(evals, 'Results')).slice(1).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''));
  let blob = '';
  try { blob = execFileSync('git', ['hash-object', skillFile], { encoding: 'utf8' }).trim(); } catch { blob = ''; }
  // Newest is the last row of the latest date: rows are appended, so a later run on the same day sits lower.
  const latest = results.reduce((max, cells) => (cells[0] > max ? cells[0] : max), '');
  const newest = results.filter((cells) => cells[0] === latest).pop();
  r.C7 = Boolean(newest && blob && newest.join(' ').includes(blob) && newest[2] && newest[3] && newest[2] !== newest[3]);
  if (!r.C7) why.push(newest ? 'C7: the newest result did not run against today\'s SKILL.md, or names no separate grader' : 'C7: no dated result yet');

  return { skill: name, onStandard: true, checks: r, why };
}

const required = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6'];
export const passes = (result) => !result.error && result.onStandard && required.every((k) => result.checks[k]);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const skillsDir = join(root, 'skills');
  const names = flag('--all') || named.length === 0
    ? readdirSync(skillsDir).filter((d) => existsSync(join(skillsDir, d, 'SKILL.md')))
    : named;
  const results = names.map((n) => existsSync(join(skillsDir, n)) ? checkSkill(join(skillsDir, n)) : { skill: n, error: 'no such skill' });
  if (flag('--json')) console.log(JSON.stringify(results, null, 1));
  else for (const res of results) {
    if (res.error) { console.log(`${res.skill}: ${res.error}`); continue; }
    if (!res.onStandard) { console.log(`${res.skill}: not on the standard yet (no evals.md)`); continue; }
    const passed = required.filter((k) => res.checks[k]).length;
    console.log(`${res.skill}: ${passed}/${required.length} required checks pass, proof ${res.checks.C7 ? 'current' : 'not current'}`);
    for (const line of res.why) console.log(`  - ${line}`);
  }
  if (results.some((res) => res.error)) process.exit(2);
  process.exit(results.filter((res) => res.onStandard).every(passes) ? 0 : 1);
}
