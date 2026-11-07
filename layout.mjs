const keys = ['board', 'holds', 'state', 'projects', 'agents', 'checkpoints', 'snapshots', 'knowledge'];
export const releasePaths = [
  '.gitattributes', '.gitignore', 'ADAPT.md', 'AGENTS.md', 'HOSTED.md', 'ONBOARDING.md',
  'README.md', 'WORKFLOW.md', 'hars-mem.mjs', 'layout.mjs', 'paths.json', 'recall.mjs',
  'setup.mjs', 'skills', 'store.mjs',
];
const reserved = releasePaths.map((entry) => entry.toLowerCase()).concat(
  '.github', '.hars-mem-local', '.hars-mem-store.json', 'package.json', 'package-lock.json', 'tests');
const overlaps = (first, second) => first === second || first.startsWith(second + '/') || second.startsWith(first + '/');

export function validatePaths(paths) {
  for (const key of keys) {
    const path = paths?.[key];
    if (typeof path !== 'string' || !/^[A-Za-z0-9._/-]+$/.test(path) || path.split('/').some(
      (part) => !part || part.endsWith('.') || /^(?:\.git(?:~[0-9]+)?|git~[0-9]+)$/i.test(part),
    )) {
      throw new Error('Set paths.json ' + key + ' to a repository-relative path.');
    }
  }
  const values = keys.map((key) => paths[key].toLowerCase());
  for (const [index, path] of values.entries()) {
    if (reserved.some((entry) => overlaps(path, entry)) || path.split('/').some(
      (part) => /^\.(?:gitignore|gitattributes|gitmodules|env(?:\..*)?)$/.test(part),
    )) {
      throw new Error('paths.json ' + keys[index] + ' overlaps a reserved control path.');
    }
    if (values.slice(0, index).some((other) => overlaps(path, other))) {
      throw new Error('Configured locations must not overlap in paths.json. Check ' + keys[index] + '.');
    }
  }
  return Object.fromEntries(keys.map((key) => [key, paths[key]]));
}
