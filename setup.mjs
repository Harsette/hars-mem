import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { validatePaths } from './layout.mjs';

const [first, local] = process.argv.slice(2);
const url = first === '--local' ? local : first;
const isGitHub = /^(?:https:\/\/github\.com\/|git@github\.com:)[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(url ?? '');
const usage = 'Run node setup.mjs https://github.com/YOUR-ACCOUNT/YOUR-REPO.git from the Hars-Mem folder.';
const branch = 'refs/heads/main';
const releasePaths = [
  '.gitattributes', '.gitignore', 'ADAPT.md', 'AGENTS.md', 'HOSTED.md', 'ONBOARDING.md',
  'README.md', 'WORKFLOW.md', 'hars-mem.mjs', 'layout.mjs', 'paths.json', 'recall.mjs',
  'setup.mjs', 'skills',
];

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args, optional = false) {
  const result = spawnSync('git', args, { encoding: 'utf8', windowsHide: true, timeout: 30000,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never' } });
  if (result.status === 0) return result.stdout.trim();
  if (optional && !result.error) return null;
  throw new Error(result.error?.message ?? (result.stderr.trim() || 'Git command failed.'));
}

try {
  requireThat(isGitHub || (first === '--local' && url && isAbsolute(url)), usage);
  requireThat(releasePaths.every((path) => existsSync(path)), 'Open a terminal in the Hars-Mem folder.');
  const paths = validatePaths(JSON.parse(readFileSync('paths.json', 'utf8')));
  if (!existsSync('.git')) git(['init', '-b', 'main']);
  requireThat(git(['symbolic-ref', '--short', 'HEAD'], true) === 'main', 'Setup needs local main.');
  const origin = git(['remote', 'get-url', 'origin'], true);
  requireThat(!origin || origin === url, 'This folder already has a different origin. Extract a fresh copy.');
  if (!git(['rev-parse', '--verify', 'HEAD'], true)) {
    const data = ['tests', ...Object.values(paths)].filter((path) => existsSync(path));
    git(['add', '--', ...releasePaths, ...data]);
    git(['-c', 'user.name=Hars-Mem', '-c', 'user.email=hars-mem@users.noreply.example',
      'commit', '-m', 'Initialize Hars-Mem']);
  }
  requireThat(!git(['status', '--porcelain', '--untracked-files=no']), 'Commit the Hars-Mem changes before setup.');
  const head = git(['rev-parse', 'HEAD']);
  const expected = head + '\t' + branch;
  const refs = git(['ls-remote', url]);
  requireThat(!refs || refs.split('\n').includes(expected), 'The destination already has content. Choose a new empty private repository.');
  if (!refs) git(['push', '--force-with-lease=' + branch + ':', url, head + ':' + branch]);
  requireThat(git(['ls-remote', url, branch]) === expected, 'Readback did not match. Inspect destination main.');
  if (!origin) git(['remote', 'add', 'origin', url]);
  git(['fetch', '--no-tags', 'origin', branch + ':refs/remotes/origin/main']);
  git(['branch', '--set-upstream-to=origin/main', 'main']);
  process.stdout.write('Verified main at ' + head + '. Give agents the repository URL and "Read ONBOARDING.md".\n');
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
