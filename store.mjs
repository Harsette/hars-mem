import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

export const mainRef = 'refs/heads/main';
export const storePath = '.hars-mem-store.json';
const trackingRef = 'refs/remotes/origin/main';
const shaPattern = /^[0-9a-f]{40}$/;

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

export function endpoint(git, address) {
  const github = /^(?:https:\/\/github\.com\/|git@github\.com:)([a-z0-9_.-]+\/[a-z0-9_.-]+)$/i.exec(address ?? '');
  if (github) return { address, type: 'github', identity: 'github:' + github[1].replace(/\.git$/i, '').toLowerCase() };
  requireThat(address && isAbsolute(address), 'Use a GitHub HTTPS/SSH URL or an absolute path to an existing bare Git repository.');
  requireThat(git(['--git-dir', address, 'rev-parse', '--is-bare-repository'], { optional: true }) === 'true',
    'The local store must already be a bare Git repository.');
  const canonical = realpathSync(address).replaceAll('\\', '/');
  return { address: canonical, type: 'local-bare-git', identity: 'local:' + (process.platform === 'win32' ? canonical.toLowerCase() : canonical) };
}

function fingerprint(store) {
  return createHash('sha256').update(store.identity).digest('hex');
}

export function storeMarker(readJson, commit) {
  const marker = readJson(commit, storePath, true);
  if (marker === null) return null;
  requireThat(marker.version === 1 && ['frozen', 'active'].includes(marker.state)
    && shaPattern.test(marker.from ?? '') && /^[0-9a-f]{64}$/.test(marker.to ?? '')
    && (marker.state === 'frozen' || shaPattern.test(marker.frozen ?? '')),
  'Unrecognized store marker. Inspect ' + storePath + ' before using this source.');
  return marker;
}

export function requireActive(readJson, commit) {
  requireThat(storeMarker(readJson, commit)?.state !== 'frozen',
    'This source is frozen for migration. Use store check, a verified destination checkout, or an explicit --as-of read.');
}

function refs(git, address) {
  return new Map(storeGit(git, address, 'ls-remote', ['--refs']).split('\n').filter(Boolean).map((line) => {
    const [commit, ref] = line.trim().split('\t');
    return [ref, commit];
  }));
}

function fetchMain(git, address) {
  storeGit(git, address, 'fetch', ['--no-tags'], [mainRef]);
}

function ancestor(git, commit, head) {
  return git(['merge-base', '--is-ancestor', commit, head], { optional: true }) !== null;
}

export function originRoute(git) {
  const fetchAddress = git(['remote', 'get-url', '--all', 'origin'], { optional: true });
  const pushAddress = git(['remote', 'get-url', '--push', '--all', 'origin'], { optional: true });
  return { address: fetchAddress?.split('\n')[0].trim(),
    samePush: Boolean(fetchAddress && !fetchAddress.includes('\n') && fetchAddress === pushAddress) };
}

export function writeOrigin(git, expected) {
  const { address, samePush } = originRoute(git);
  requireThat(samePush && (expected === undefined || address === expected),
    'Use one matching fetch and push endpoint for origin. Recheck the intended store before retrying.');
  return address;
}

export function requireDirectAddress(git, store) {
  const rules = git(['config', '--null', '--get-regexp', '^url\\..*\\.(insteadof|pushinsteadof)$'], { optional: true });
  const prefixes = (rules ?? '').split('\0').filter(Boolean).map((rule) => rule.slice(rule.indexOf('\n') + 1));
  requireThat(!prefixes.some((prefix) => store.address.startsWith(prefix)),
    'Use a store address without a Git fetch or push URL rewrite.');
}

export function privateStore(git, store) {
  requireDirectAddress(git, store);
  if (store.type === 'local-bare-git') {
    requireThat(!store.address.startsWith('//'), 'Use a local bare Git store on an owner-controlled filesystem.');
    const stat = statSync(store.address, { bigint: true });
    return [store.identity, stat.dev, stat.ino, stat.birthtimeNs].join(':');
  }
  const slug = store.identity.slice('github:'.length);
  requireThat(slug !== 'harsette/hars-mem', 'The public starter cannot be the private store.');
  requireThat(/^https:\/\/github\.com\//i.test(store.address),
    'Use a direct GitHub HTTPS URL for private setup, onboarding, or migration.');
  const response = spawnSync('gh', ['api', '--hostname', 'github.com', '--method', 'GET',
    '--header', 'Accept: application/vnd.github+json', 'repos/' + slug], {
    encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1024 * 1024,
    env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_DEBUG: '' },
  });
  let repo;
  if (response.status === 0) {
    try { repo = JSON.parse(response.stdout); } catch { /* Treat malformed metadata as unverified. */ }
  }
  requireThat(typeof repo?.full_name === 'string' && repo.full_name.toLowerCase() === slug
    && Number.isSafeInteger(repo.id) && repo.id > 0,
    'GitHub could not verify this repository. Use an already authorized GitHub CLI session or choose local bare Git.');
  requireThat(repo.private === true && repo.visibility === 'private', 'Choose a private GitHub repository.');
  return store.identity + ':' + repo.id;
}

export function privateOrigin(git) {
  const address = git(['config', '--get-all', 'remote.origin.url'], { optional: true });
  requireThat(address && !address.includes('\n')
    && git(['config', '--get-all', 'remote.origin.pushurl'], { optional: true }) === null,
  'Onboarding needs one origin URL and no separate push URL.');
  writeOrigin(git, address);
  const store = endpoint(git, address);
  requireDirectAddress(git, { address });
  return { address: store.address, identity: store.identity, fingerprint: privateStore(git, store) };
}

export function storeGit(git, address, command, flags = [], refspecs = []) {
  requireThat(address && !/[\r\n]/.test(address) && (!address.includes('=') || isAbsolute(address)),
    'Use a Git store address that can be pinned safely.');
  const url = address.includes('=') ? pathToFileURL(address).href.replaceAll('=', '%3D') : address;
  const route = './.hars-mem-route-' + randomUUID();
  // The unique full match pins this process to the resolved address. Git applies URL rewrites once.
  return git(['-c', 'http.followRedirects=false', '-c', 'url.' + url + '.insteadOf=' + route,
    '-c', 'url.' + url + '.pushInsteadOf=' + route,
    command, ...flags, '--', route, ...refspecs]);
}

export function pushMain(git, address, commit, expected, dryRun = false) {
  storeGit(git, address, 'push', [...(dryRun ? ['--dry-run'] : []), '--no-follow-tags', '--recurse-submodules=no',
    '--force-with-lease=' + mainRef + ':' + expected], [commit + ':' + mainRef]);
}

function setMain(git, address, commit, expected, phase) {
  let pushError;
  try {
    pushMain(git, address, commit, expected);
  } catch (error) {
    pushError = error;
  }
  let head;
  try {
    head = refs(git, address).get(mainRef);
  } catch (error) {
    throw new Error(phase + ' outcome unknown for ' + commit + '. Read the store before retrying. ' + error.message);
  }
  if (head !== commit && head) fetchMain(git, address);
  requireThat(head && ancestor(git, commit, head), phase + ' did not reach main. ' + (pushError?.message ?? 'Inspect the remote history.'));
  return head;
}

function check({ git, readJson, live }) {
  const { address, samePush } = originRoute(git);
  const store = endpoint(git, address);
  const commit = live({ allowFrozen: true, address });
  const marker = storeMarker(readJson, commit);
  let pushNegotiation = 'skipped';
  if (samePush && marker?.state !== 'frozen') {
    try {
      pushMain(git, writeOrigin(git, address), commit, commit, true);
      pushNegotiation = 'accepted-dry-run';
    } catch {
      pushNegotiation = 'failed-dry-run';
    }
  }
  return { commit, store: store.type, state: marker?.state ?? 'active', readable: true, samePush,
    pushNegotiation, mainWrite: 'requires-verified-write' };
}

function migrate(options, { git, readJson, verifyRuntime, makeCommit, live }) {
  const origin = writeOrigin(git);
  const source = endpoint(git, origin);
  const target = endpoint(git, options.to);
  const from = options.from;
  requireThat(shaPattern.test(from ?? ''), 'Use --from with the full live main SHA from store check.');
  requireThat(git(['config', '--get-all', 'remote.origin.pushurl'], { optional: true }) === null,
    'Use a checkout with a single origin URL and no separate push URL.');
  requireDirectAddress(git, source);
  const targetIdentity = privateStore(git, target);
  requireThat(git(['rev-parse', '--is-inside-work-tree']) === 'true', 'Use a regular checkout for migration.');
  requireThat(git(['rev-parse', '--is-shallow-repository']) === 'false', 'Use a full clone for migration.');
  requireThat(git(['worktree', 'list', '--porcelain']).split('\n').filter((line) => line.startsWith('worktree ')).length === 1,
    'Use a standalone clone for migration. Linked worktrees share their origin setting.');

  const to = fingerprint(target);
  const head = live({ allowFrozen: true, address: source.address });
  verifyRuntime(head);
  const marker = storeMarker(readJson, head);
  if (source.identity === target.identity) {
    requireThat(marker?.state === 'active' && marker.from === from && marker.to === to
      && ancestor(git, marker.frozen, head), 'Choose a different destination store.');
    return { from, frozen: marker.frozen, commit: head, store: target.type, switched: true };
  }

  const targetRefs = refs(git, target.address);
  const targetHead = targetRefs.get(mainRef);
  if (marker?.state === 'frozen') {
    requireThat(marker.from === from && marker.to === to && git(['rev-parse', head + '^']) === from,
      'Source is frozen for another migration. Resume it with the original destination and --from SHA.');
  } else {
    requireThat(head === from, 'Source advanced. Run store check and verify the new SHA before migrating.');
    requireThat(!targetRefs.size, 'Destination already has Git refs. Use an empty private repository.');
    pushMain(git, target.address, from, '', true);
  }
  requireThat(targetHead || !targetRefs.size, 'Destination already has Git refs. Use the original empty destination.');

  const frozen = marker?.state === 'frozen' ? head : makeCommit(from, {
    [storePath]: JSON.stringify({ version: 1, state: 'frozen', from, to }, null, 2) + '\n',
  }, 'Freeze Hars-Mem source for migration');
  if (frozen !== head) {
    requireThat(privateStore(git, target) === targetIdentity, 'Destination changed before the migration freeze.');
    writeOrigin(git, origin);
    requireThat(setMain(git, source.address, frozen, from, 'Source freeze') === frozen,
      'The frozen source advanced. Inspect both stores before retrying.');
  }

  let commit = targetHead;
  if (!commit) {
    requireThat(privateStore(git, target) === targetIdentity, 'Destination changed before activation. Keep the original recovery route.');
    const activation = makeCommit(frozen, {
      [storePath]: JSON.stringify({ version: 1, state: 'active', from, to, frozen }, null, 2) + '\n',
    }, 'Activate migrated Hars-Mem source');
    commit = setMain(git, target.address, activation, '', 'Destination activation');
  } else {
    fetchMain(git, target.address);
  }
  const activated = storeMarker(readJson, commit);
  requireThat(activated?.state === 'active' && activated.from === from && activated.to === to
    && activated.frozen === frozen && ancestor(git, frozen, commit), 'Destination does not contain the verified migration.');
  requireThat(refs(git, source.address).get(mainRef) === frozen, 'Frozen source moved. Inspect both stores before reconnecting.');
  writeOrigin(git, origin);
  requireThat(git(['config', '--get-all', 'remote.origin.pushurl'], { optional: true }) === null,
    'Remove the separate push URL before reconnecting the verified destination.');
  git(['remote', 'set-url', 'origin', target.address]);
  writeOrigin(git, target.address);
  storeGit(git, target.address, 'fetch', ['--no-tags'], ['+' + mainRef + ':' + trackingRef]);
  const verified = git(['rev-parse', trackingRef]);
  requireThat(ancestor(git, commit, verified), 'Destination main changed during local reconnection. Inspect origin before using it.');
  requireActive(readJson, verified);
  return { from, frozen, commit: verified, store: target.type, switched: true };
}

export function storeCommand(action, options, dependencies) {
  if (action === 'check') return check(dependencies);
  requireThat(action === 'migrate', 'Use store check or store migrate --to DESTINATION --from MAIN_SHA.');
  return migrate(options, dependencies);
}
