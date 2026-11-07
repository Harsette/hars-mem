const keys = ['board', 'holds', 'state', 'projects', 'agents', 'checkpoints', 'snapshots', 'knowledge'];
const reserved = ['adapt.md', 'agents.md', 'onboarding.md', 'readme.md', 'hosted.md', 'workflow.md',
  'hars-mem.mjs', 'layout.mjs', 'recall.mjs', 'setup.mjs', 'store.mjs', '.hars-mem-store.json', 'paths.json', 'skills', 'tests'];

export function validatePaths(paths) {
  for (const key of keys) {
    const path = paths?.[key];
    if (typeof path !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(path) || path.split('/').some(
      (part) => ['', '.', '..', '.git'].includes(part.toLowerCase()),
    )) {
      throw new Error('Set paths.json ' + key + ' to a repository-relative path.');
    }
  }
  const values = keys.map((key) => paths[key].toLowerCase());
  if (new Set(values).size !== values.length) throw new Error('Use distinct paths in paths.json.');
  for (const path of values) {
    if (reserved.some((entry) => path === entry || path.startsWith(entry + '/'))) {
      throw new Error('Keep Hars-Mem instructions, skills, and runtime files separate from configured data.');
    }
  }
  return Object.fromEntries(keys.map((key) => [key, paths[key]]));
}
