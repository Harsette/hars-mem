import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePaths } from './layout.mjs';
import { recall } from './recall.mjs';
import { mainRef as main, pushMain, requireActive, storeCommand, storeGit, storeMarker, writeOrigin } from './store.mjs';

const remoteMain = 'refs/remotes/origin/main';
const jsonText = (value) => JSON.stringify(value, null, 2) + '\n';
const timestamp = (time = Date.now()) => new Date(time).toISOString();
const hash = (value) => createHash('sha256').update(value).digest('hex');
const endings = ['done', 'cancelled'];
const inFlight = ['doing', 'blocked', 'waiting'];
const runtimeFiles = ['hars-mem.mjs', 'layout.mjs', 'recall.mjs', 'store.mjs'];
const runtimeAtLaunch = new Map(runtimeFiles.map((file) => [
  file, readFileSync(new URL(file, import.meta.url), 'utf8').replace(/\r\n/g, '\n'),
]));

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function git(args, { input, extraEnv, optional, raw } = {}) {
  const result = spawnSync('git', args, {
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', ...extraEnv },
    input, encoding: raw ? undefined : 'utf8', maxBuffer: 8 * 1024 * 1024,
    timeout: 30000, windowsHide: true,
  });
  if (result.status === 0) return raw ? result.stdout : result.stdout.trim();
  if (optional && !result.error) return null;
  const message = result.error?.message ?? String(result.stderr ?? '').trim();
  throw new Error(message.replace(/(https?:\/\/)[^\s/@]+@/gi, '$1[redacted]@') || 'Git command failed.');
}

function live({ allowFrozen = false, address } = {}) {
  let commit;
  try {
    const refspec = '+' + main + ':' + remoteMain;
    if (address) storeGit(git, address, 'fetch', ['--no-tags'], [refspec]);
    else git(['fetch', '--no-tags', 'origin', refspec]);
    commit = git(['rev-parse', remoteMain]);
  } catch (error) {
    throw new Error('Live origin/main unavailable. State is unknown. ' + error.message);
  }
  if (!allowFrozen) requireActive(readJson, commit);
  return commit;
}

function read(commit, path, optional = false) {
  const result = git(['show', commit + ':' + path], { optional, raw: true });
  return result === null ? null : result.toString('utf8');
}

function readJson(commit, path, optional = false) {
  const result = read(commit, path, optional);
  return result === null ? null : JSON.parse(result);
}

function readSource(options) {
  const commit = options['as-of'];
  if (commit === undefined) return { commit: live(), provenance: { mode: 'live', ref: main, verifiedAt: timestamp() } };
  requireThat(/^[0-9a-f]{40}$/.test(commit), 'Use --as-of with the full SHA of a locally available main commit.');
  const observed = git(['rev-parse', '--verify', remoteMain], { optional: true });
  requireThat(observed && git(['cat-file', '-t', commit], { optional: true }) === 'commit' && ancestor(commit, observed),
    'Commit is unavailable in the local observed origin/main history. Fetch the source first.');
  return { commit, provenance: { mode: 'as-of', ref: main, current: false } };
}

function taskId(id) {
  requireThat(/^[a-z][a-z0-9-]{0,47}\/[a-z][a-z0-9-]{0,63}$/.test(id ?? ''), 'Use a task ID in project/task form.');
  return id;
}

function agentId(id) {
  requireThat(/^[a-z][a-z0-9-]{0,47}$/.test(id ?? ''), 'Use --agent with a stable lowercase ID.');
  return id;
}

function required(value, message) {
  requireThat(value?.trim(), message);
  return value.trim();
}

const layouts = new Map();
function pathsAt(commit) {
  if (!layouts.has(commit)) layouts.set(commit, validatePaths(readJson(commit, 'paths.json')));
  return layouts.get(commit);
}

const taskPath = (paths, id) => paths.state + '/' + taskId(id) + '.json';
const agentPath = (paths, id) => paths.agents + '/' + agentId(id) + '.json';
const active = (lease, now = Date.now()) => Boolean(lease && Date.parse(lease.expiresAt) > now);
const projectOf = (task) => task.id.split('/')[0];

function taskAt(commit, id) {
  const task = readJson(commit, taskPath(pathsAt(commit), id), true);
  requireThat(task, 'Unknown task ' + id + '. Run board to find a task or add to record one.');
  return task;
}

function tasksAt(commit) {
  const prefix = pathsAt(commit).state + '/';
  return git(['ls-tree', '-r', '--name-only', commit, '--', prefix]).split('\n')
    .filter((path) => path.startsWith(prefix) && /^[^/]+\/[^/]+\.json$/.test(path.slice(prefix.length)))
    .map((path) => readJson(commit, path));
}

function publicTask(task, now) {
  if (!task?.lease) return task;
  const { agent, claimedAt, expiresAt } = task.lease;
  return { ...task, lease: { agent, claimedAt, expiresAt, active: now === null ? null : active(task.lease, now) } };
}

function holdsAt(commit, task) {
  return readJson(commit, pathsAt(commit).holds).holds.filter(
    (hold) => [task.id, projectOf(task) + '/*', '*'].includes(hold.target),
  );
}

function blockersAt(commit, task) {
  return task.dependsOn.filter((id) => taskAt(commit, id).status !== 'done');
}

function packetAt(commit, task, options) {
  const minimal = options.packet === 'minimal';
  requireThat(options.packet === undefined || minimal, 'Use --packet minimal for a handoff with source pointers.');
  const project = pathsAt(commit).projects + '/' + projectOf(task);
  const sourceList = readJson(commit, project + '/SOURCES.json', true) ?? [];
  const synthesis = project + '/SYNTHESIS.md';
  return {
    taskId: task.id, revision: task.rev, detail: task.detail, checkpoints: task.checkpoints,
    goal: task.goal, doneWhen: task.doneWhen, files: task.files, excluded: task.excluded, proof: task.proof,
    holds: holdsAt(commit, task), blockedBy: blockersAt(commit, task),
    synthesis: read(commit, synthesis, true) === null ? null : synthesis,
    sources: sourceList.map((source) => {
      if (!minimal) return source.kind === 'repo'
        ? { ...source, commit, content: read(commit, source.path) }
        : { ...source, verified: false };
      const { id, kind, owner, use, path, url } = source;
      return kind === 'repo' ? { id, kind, owner, use, path, commit } : { id, kind, owner, use, url, verified: false };
    }),
  };
}

function boardFor(tasks, paths) {
  const relative = (path) => posix.relative(posix.dirname(paths.board), path) || '.';
  const lines = [
    '# Task board', '',
    'Generated from [task records](' + relative(paths.state) + '/). Compare recorded lease expiry with current UTC. The CLI board command reports whether each lease is live.', '',
  ];
  const cell = (value) => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  for (const status of [...inFlight, 'open', ...endings]) {
    const group = tasks.filter((task) => task.status === status);
    if (!group.length) continue;
    lines.push('## ' + status[0].toUpperCase() + status.slice(1), '',
      '| Task | Goal | Latest detail | Lease expires (UTC) | Receipt |', '| --- | --- | --- | --- | --- |');
    for (const task of group) {
      const lease = task.lease ? task.lease.agent + ' through ' + task.lease.expiresAt : '';
      lines.push('| [' + task.id + '](' + relative(taskPath(paths, task.id)) + ') | ' + cell(task.goal) + ' | '
        + cell(task.detail) + ' | ' + cell(lease) + ' | ' + cell(task.receipt?.value) + ' |');
    }
    lines.push('');
  }
  return lines.join('\n');
}

function taskChange(commit, task) {
  const paths = pathsAt(commit);
  const tasks = tasksAt(commit).filter((item) => item.id !== task.id).concat(task);
  tasks.sort((a, b) => a.id < b.id ? -1 : Number(a.id > b.id));
  return { [taskPath(paths, task.id)]: jsonText(task), [paths.board]: boardFor(tasks, paths) };
}

const localPath = (...parts) => join(git(['rev-parse', '--absolute-git-dir']), 'hars-mem', ...parts);

function writeLocal(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, jsonText(value), { flag: 'wx', mode: 0o600 });
}

function makeCommit(base, files, message) {
  const index = localPath('index-' + randomUUID());
  mkdirSync(dirname(index), { recursive: true });
  const extraEnv = { GIT_INDEX_FILE: index };
  try {
    git(['read-tree', base], { extraEnv });
    for (const [path, content] of Object.entries(files)) {
      const blob = git(['hash-object', '-w', '--stdin'], { input: content });
      git(['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + path], { extraEnv });
    }
    const tree = git(['write-tree'], { extraEnv });
    if (tree === git(['rev-parse', base + '^{tree}'])) return null;
    return git(['-c', 'user.name=Hars-Mem', '-c', 'user.email=hars-mem@users.noreply.example',
      'commit-tree', tree, '-p', base, '-m', message]);
  } finally {
    if (existsSync(index)) unlinkSync(index);
  }
}

const ancestor = (first, second) => git(['merge-base', '--is-ancestor', first, second], { optional: true }) !== null;

function verifyRuntime(commit) {
  for (const [file, actual] of runtimeAtLaunch) {
    requireThat(actual === read(commit, file), 'The running CLI differs from origin/main. Save local edits and run sync from clean main.');
  }
  pathsAt(commit);
}

function fastForward(commit) {
  requireThat(git(['symbolic-ref', '--short', 'HEAD'], { optional: true }) === 'main', 'Sync needs a local main checkout.');
  const head = git(['rev-parse', 'HEAD']);
  requireThat(ancestor(head, commit), 'Local main diverged. Preserve local commits on a work branch and reconcile.');
  requireThat(!git(['status', '--porcelain', '--untracked-files=no']), 'Local tracked changes preserved. Save them on a work branch before sync.');
  if (head !== commit) git(['merge', '--ff-only', commit]);
  requireThat(git(['rev-parse', 'HEAD']) === commit, 'Could not align local main with the verified commit.');
}

function sessionStart(command, args) {
  const commit = live();
  if (!process.env.HARS_MEM_START_REEXEC && git(['rev-parse', 'HEAD']) !== commit) {
    fastForward(commit);
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), command, ...args], {
      env: { ...process.env, HARS_MEM_START_REEXEC: commit }, stdio: 'inherit', windowsHide: true,
    });
    if (child.error) throw child.error;
    process.exit(child.status ?? 1);
  }
  verifyRuntime(commit);
}

function writeResult(commit, result, deadline, head = commit, leaseKey) {
  let leaseCurrent = true;
  if (head !== commit && leaseKey) {
    try {
      leaseCurrent = storeMarker(readJson, head)?.state !== 'frozen' && taskAt(head, result.task.id).lease?.key === leaseKey;
    } catch {
      leaseCurrent = false;
    }
  }
  const now = Date.now();
  if (result.task) result = { ...result, task: publicTask(result.task, now) };
  if (!leaseCurrent && result.task?.lease) {
    result.task.lease.active = false;
    result.task.lease.current = false;
  }
  if (deadline === undefined) return { commit, ...result };
  const crossed = now >= deadline;
  return {
    commit, ...result,
    leaseTiming: {
      expiresAt: timestamp(deadline), verifiedAt: timestamp(now),
      status: crossed ? 'expiry-crossed-at-readback' : 'verified-before-expiry',
      ...(crossed ? { warning: 'Git accepted this write. Readback crossed lease expiry. Review before claiming timely completion.' } : {}),
    },
  };
}

function writeStartResult(commit, result, deadline, head, leaseKey, options) {
  let liveTask;
  let leaseKnown = false;
  let context;
  if (head) {
    try {
      if (storeMarker(readJson, head)?.state !== 'frozen') {
        const task = taskAt(head, result.task.id);
        if (task.lease?.key === leaseKey && task.lease.agent === result.task.lease.agent) liveTask = task;
      }
      leaseKnown = true;
    } catch {
      // The accepted claim is still a receipt when current lease state is unknown.
    }
    if (liveTask?.status === 'doing' && active(liveTask.lease)) {
      try {
        if (head !== commit) verifyRuntime(head);
        ready(head, liveTask);
        context = { canonCommit: head, canon: read(head, 'AGENTS.md'), packet: packetAt(head, liveTask, options) };
      } catch {
        // Keep the confirmed lease so the holder can release it or inspect the live task.
      }
    }
  }
  const receipt = writeResult(commit, { task: liveTask ?? result.task }, deadline);
  if (!liveTask) {
    receipt.task.lease.active = leaseKnown ? false : null;
    receipt.task.lease.current = leaseKnown ? false : null;
  }
  if (!head) receipt.leaseTiming = { expiresAt: timestamp(deadline), status: 'readback-unavailable' };
  const canDispatch = Boolean(context && receipt.task.lease.active);
  return { ...receipt, observedCommit: head, ready: canDispatch, ...(canDispatch ? context : {}) };
}

function publish(message, change, startOptions) {
  const address = writeOrigin(git);
  let base = live({ address });
  for (let attempt = 0; attempt < 5; attempt++) {
    verifyRuntime(base);
    const { files, result, deadline, leaseKey } = change(base);
    const commit = makeCommit(base, files, message);
    if (!commit) return writeResult(base, result, deadline);
    let pushError;
    writeOrigin(git, address);
    requireThat(deadline === undefined || Date.now() < deadline, 'Lease expired before push. Read the live task before retrying.');
    try {
      // The new commit is a direct child of base. The lease requires the remote to still equal base.
      pushMain(git, address, commit, base);
    } catch (error) {
      pushError = error;
    }
    let head;
    try {
      // A cutover may have frozen main just after our successful push. Read it
      // back for the write receipt, then enforce the fence before any retry.
      head = live({ allowFrozen: true, address });
    } catch (error) {
      if (startOptions && !pushError) return writeStartResult(commit, result, deadline, null, leaseKey, startOptions);
      throw new Error('Write outcome unknown for commit ' + commit + '. Read origin/main before retrying. ' + error.message);
    }
    if (ancestor(commit, head)) {
      return startOptions ? writeStartResult(commit, result, deadline, head, leaseKey, startOptions)
        : writeResult(commit, result, deadline, head, leaseKey);
    }
    requireThat(pushError, 'Published commit ' + commit + ' disappeared. Inspect remote history.');
    requireThat(head !== base, 'Write refused by origin. ' + pushError.message);
    requireThat(ancestor(base, head), 'Origin history changed. Inspect both commits before retrying.');
    requireActive(readJson, head);
    base = head;
  }
  throw new Error('Origin kept advancing. Read the live task and retry.');
}

function registered(commit, agent) {
  requireThat(readJson(commit, agentPath(pathsAt(commit), agent), true), 'Agent ' + agent + ' must boot and register first.');
}

function boot(options) {
  const agent = agentId(options.agent);
  requireThat(['outer', 'worker'].includes(options.role), 'Use --role outer or --role worker.');
  const scope = required(options.scope, 'Provide --scope (your project or all).');
  const capabilities = [...new Set(required(options.capabilities, 'List your actual --capabilities.')
    .split(',').map((item) => item.trim()))].sort();
  requireThat(capabilities.every((item) => ['shell', 'git-read', 'git-write', 'browser'].includes(item)),
    'Unknown capability. Use shell,git-read,git-write,browser.');
  const memory = options.memory ? readFileSync(options.memory, 'utf8').trim() : '';
  return publish('Register ' + agent, (base) => {
    const paths = pathsAt(base);
    const canon = read(base, 'AGENTS.md');
    const task = tasksAt(base).find((item) => scope === 'all' || projectOf(item) === scope) ?? null;
    const registration = {
      agent, role: options.role, scope, capabilities,
      snapshot: paths.snapshots + '/' + agent + '/LATEST.md', canonBlob: git(['rev-parse', base + ':AGENTS.md']),
    };
    const snapshotCommit = git(['log', '-1', '--format=%H', base, '--', registration.snapshot]);
    const snapshotScope = snapshotCommit ? readJson(snapshotCommit, agentPath(pathsAt(snapshotCommit), agent), true)?.scope : null;
    const portable = snapshotScope === scope ? read(base, registration.snapshot, true) : null;
    return {
      files: { [agentPath(paths, agent)]: jsonText(registration) },
      result: { canonCommit: base, canon, task: publicTask(task), registration, registrationPath: agentPath(paths, agent),
        memory: {
          reviewRequired: Boolean(memory),
          instruction: memory ? 'Check shared claims against live canon and keep unrelated harness craft.' : null,
          snapshot: portable === null ? null : { path: registration.snapshot, commit: snapshotCommit, content: portable },
        } },
    };
  });
}

function ttl(value) {
  const seconds = Number(value ?? 900);
  requireThat(Number.isInteger(seconds) && seconds >= 1 && seconds <= 14400, 'TTL must be between 1 and 14400 seconds.');
  return seconds * 1000;
}

function ready(base, task) {
  const hold = holdsAt(base, task)[0];
  requireThat(!hold, 'Task held. ' + hold?.reason);
  requireThat(!endings.includes(task.status), 'Task is already ' + task.status + '.');
  const blockers = blockersAt(base, task);
  requireThat(!blockers.length, 'Task blocked by ' + blockers.join(', ') + '.');
}

function claimPath(id, agent, key) {
  const [project, slug] = taskId(id).split('/');
  requireThat(/^[a-f0-9]{64}$/.test(key ?? ''), 'Lease key missing or invalid.');
  return localPath('claims', project, slug, agentId(agent) + '-' + key + '.json');
}

function claim(id, agent, options, withPacket = false) {
  requireThat(!withPacket || options.packet === undefined || options.packet === 'minimal',
    'Use --packet minimal for a handoff with source pointers.');
  const token = randomUUID();
  const key = hash(token);
  const lifetime = ttl(options.ttl);
  const local = claimPath(id, agent, key);
  try {
    return publish('Claim ' + id + ' for ' + agent, (base) => {
      registered(base, agent);
      const task = taskAt(base, id);
      ready(base, task);
      requireThat(!active(task.lease), 'Live lease held by ' + task.lease?.agent + ' through ' + task.lease?.expiresAt + '.');
      const now = Date.now();
      const updated = { ...task, rev: task.rev + 1, status: 'doing', updatedAt: timestamp(now),
        lease: { agent, key, claimedAt: timestamp(now), expiresAt: timestamp(now + lifetime) } };
      if (!existsSync(local)) writeLocal(local, { token });
      return {
        files: taskChange(base, updated), result: { task: publicTask(updated) },
        deadline: now + lifetime, leaseKey: key,
      };
    }, withPacket ? options : undefined);
  } catch (error) {
    if (!error.message.startsWith('Write outcome unknown') && existsSync(local)) unlinkSync(local);
    throw error;
  }
}

function mutate(id, agent, verb, edit, expected) {
  const parsedRevision = expected === undefined ? undefined : Number(expected);
  requireThat(parsedRevision === undefined || (Number.isSafeInteger(parsedRevision) && parsedRevision > 0),
    'Use --if-rev with the task revision from brief or your last write.');
  let startingRevision = parsedRevision;
  let local;
  const result = publish(verb + ' ' + id + ' by ' + agent, (base) => {
    const task = taskAt(base, id);
    requireThat(active(task.lease) && task.lease.agent === agent,
      'Lease expired or changed. Read the live task before resuming.');
    local = claimPath(id, agent, task.lease.key);
    requireThat(existsSync(local), 'No local claim token for the current lease. Read the live task before resuming.');
    requireThat(hash(JSON.parse(readFileSync(local, 'utf8')).token) === task.lease.key, 'Local lease token is invalid.');
    startingRevision ??= task.rev;
    requireThat(task.rev === startingRevision, 'Task changed while you were writing. Read the live revision and reconcile.');
    if (verb !== 'Release') ready(base, task);
    const { updated, files } = edit(base, { ...task, rev: task.rev + 1, updatedAt: timestamp() });
    return {
      files: { ...files, ...taskChange(base, updated) }, result: { task: publicTask(updated) },
      deadline: Date.parse(task.lease.expiresAt), leaseKey: updated.lease?.key,
    };
  });
  if (!result.task.lease && existsSync(local)) unlinkSync(local);
  return result;
}

function filePayload(path) {
  const bytes = readFileSync(path);
  requireThat(bytes.length && bytes.length <= 512 * 1024, 'Use a nonempty UTF-8 file no larger than 512 KiB.');
  new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const name = basename(path).replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 80);
  return { name, bytes: bytes.toString('base64') };
}

function pending(record, action) {
  const path = localPath('outbox', randomUUID() + '.json');
  writeLocal(path, { ...record, queuedAt: timestamp() });
  let result;
  try {
    result = action();
  } catch (error) {
    throw new Error(error.message + ' Input preserved in ' + path + '.');
  }
  unlinkSync(path);
  return result;
}

function save(id, agent, options) {
  const detail = options.detail?.trim();
  const file = options.file ? filePayload(options.file) : null;
  const status = options.status;
  requireThat(detail || file, 'Provide --detail or --file.');
  requireThat(!status || inFlight.includes(status), 'Use --status doing, blocked, or waiting.');
  return pending({ action: 'save', id, agent, detail, file, status }, () =>
    mutate(id, agent, 'Save', (base, task) => {
      const path = file ? pathsAt(base).checkpoints + '/' + id + '/r' + task.rev + '-' + file.name : null;
      const checkpoint = path ? { path, agent, at: task.updatedAt } : null;
      return {
        updated: { ...task, status: status ?? task.status, detail: detail ?? task.detail,
          checkpoints: checkpoint ? [...task.checkpoints, checkpoint] : task.checkpoints },
        files: path ? { [path]: Buffer.from(file.bytes, 'base64') } : {},
      };
    }, options['if-rev']));
}

function receiptAt(base, value) {
  if (/^[0-9a-f]{40}$/.test(value)) {
    requireThat(ancestor(value, base), 'Use a full commit SHA reachable from origin/main.');
    return { kind: 'commit', value };
  }
  if (/^https:\/\/\S+$/i.test(value)) {
    const url = new URL(value);
    requireThat(!url.username && !url.password, 'Receipt URL must be credential-free.');
    return { kind: 'url', value };
  }
  requireThat(/^[A-Za-z0-9._/-]+$/.test(value) && !value.split('/').some((part) => ['', '..', '.'].includes(part)),
    'Use a tracked path, full commit SHA, or HTTPS evidence URL.');
  requireThat(git(['cat-file', '-t', base + ':' + value], { optional: true }) === 'blob',
    'Receipt file must exist on origin/main.');
  return { kind: 'path', value };
}

function settle(id, agent, options) {
  const value = required(options.receipt, 'Settle requires --receipt with an existing path, full SHA, or verified HTTPS URL.');
  const status = options.as ?? 'done';
  requireThat(endings.includes(status), 'Use --as done or cancelled.');
  return pending({ action: 'settle', id, agent, value, status }, () =>
    mutate(id, agent, 'Settle', (base, task) => ({
      updated: { ...task, status, lease: null, receipt: { ...receiptAt(base, value), agent, at: task.updatedAt } },
    }), options['if-rev']));
}

function snapshot(agent, options) {
  const file = filePayload(required(options.file, 'Provide --file with your portable snapshot.'));
  let previous;
  return pending({ action: 'snapshot', agent, file }, () => publish('Snapshot ' + agent, (base) => {
    registered(base, agent);
    const path = pathsAt(base).snapshots + '/' + agent + '/LATEST.md';
    const current = git(['rev-parse', '--verify', base + ':' + path], { optional: true });
    if (previous === undefined) previous = current;
    requireThat(current === previous, 'Snapshot changed during this write. Reconcile with the latest version.');
    return { files: { [path]: Buffer.from(file.bytes, 'base64') }, result: { path } };
  }));
}

function add(id, agent, options) {
  const list = (value) => value ? value.split(',').map((item) => item.trim()).filter(Boolean) : [];
  const task = {
    id, rev: 1, goal: required(options.goal, 'Provide --goal.'),
    doneWhen: required(options['done-when'], 'Provide --done-when.'),
    files: list(options.files), excluded: list(options.excluded),
    proof: options.proof ?? 'Tracked evidence path, full commit SHA, or verified HTTPS link.',
    dependsOn: list(options['depends-on']).map(taskId), status: 'open', detail: '',
    lease: null, checkpoints: [], receipt: null, updatedAt: timestamp(),
  };
  return pending({ action: 'add', agent, task }, () => publish('Add ' + id, (base) => {
    registered(base, agent);
    requireThat(!readJson(base, taskPath(pathsAt(base), id), true), 'Task ID already exists.');
    for (const dependency of task.dependsOn) taskAt(base, dependency);
    return { files: taskChange(base, task), result: { task } };
  }));
}

function parse(args) {
  const options = Object.create(null);
  let id;
  for (let index = 0; index < args.length; index++) {
    const word = args[index];
    if (!word.startsWith('--')) {
      requireThat(!id, 'Use one task ID. Quote multi-word values.');
      id = word;
      continue;
    }
    const name = word.slice(2);
    const value = args[++index];
    requireThat(name && value && !value.startsWith('--') && !Object.hasOwn(options, name), 'Provide one value for ' + word + '.');
    options[name] = value;
  }
  return { id, options };
}

function searchFiles(commit, agent) {
  const paths = pathsAt(commit);
  const roots = ['AGENTS.md', 'ONBOARDING.md', 'WORKFLOW.md', 'skills', paths.board,
    paths.holds, paths.projects, paths.state, agent ? paths.snapshots + '/' + agent : paths.snapshots, paths.knowledge];
  const tracked = git(['ls-tree', '-rz', '--name-only', commit, '--', ...roots]).split('\0');
  const documents = new Set(tracked);
  for (const path of tracked) {
    if (!path.startsWith(paths.projects + '/') || !path.endsWith('/SOURCES.json')) continue;
    for (const source of readJson(commit, path)) {
      if (source.kind === 'repo' && typeof source.path === 'string') documents.add(source.path);
    }
  }
  return [...documents].sort()
    .filter((path) => !agent || !path.startsWith(paths.snapshots + '/') || path.startsWith(paths.snapshots + '/' + agent + '/'))
    .filter((path) => /\.(md|json|txt)$/i.test(path))
    .map((path) => ({ path, body: read(commit, path, true) }))
    .filter((document) => document.body !== null);
}

const commands = {
  help: () => ({ read: ['boot', 'brief', 'board', 'check', 'recall', 'sync', 'outbox'], store: ['check', 'migrate'],
    work: ['add', 'start', 'claim', 'heartbeat', 'save', 'release', 'finish', 'settle', 'snapshot', 'rebuild'], guide: 'ONBOARDING.md' }),
  boot: (_, options) => boot(options),
  store: (action, options) => storeCommand(action, options, { git, readJson, verifyRuntime, makeCommit, live }),
  brief: (id, options) => {
    const source = readSource(options);
    const task = taskAt(source.commit, id);
    return { ...source, task: publicTask(task, source.provenance.mode === 'as-of' ? null : undefined),
      packet: packetAt(source.commit, task, options) };
  },
  board: (_, options) => {
    const source = readSource(options);
    const { commit, provenance } = source;
    const path = pathsAt(commit).board;
    return { ...source, path, markdown: read(commit, path),
      tasks: tasksAt(commit).map((task) => publicTask(task, provenance.mode === 'as-of' ? null : undefined)) };
  },
  check: (_, options) => {
    const source = readSource(options);
    const { commit } = source;
    const paths = pathsAt(commit);
    const historical = source.provenance.mode === 'as-of';
    requireThat(read(commit, paths.board) === boardFor(tasksAt(commit), paths),
      historical ? 'Board differs from the task records at this commit.' : 'Board is stale. Run rebuild.');
    return { ...source, board: historical ? 'matches-as-of' : 'current' };
  },
  recall: async (query, options) => {
    const text = required(query, 'Provide a search phrase.');
    const backend = options.backend ?? 'auto';
    requireThat(['auto', 'sqlite', 'git'].includes(backend), 'Use --backend auto, sqlite, or git.');
    const agent = options.agent === undefined ? null : agentId(options.agent);
    const { commit, provenance } = readSource(options);
    const result = await recall({ path: localPath(agent ? 'index-' + agent + '.sqlite' : 'index.sqlite'), commit,
      load: () => searchFiles(commit, agent), query: text, backend });
    return { ...result, provenance, snapshotScope: agent ?? 'repository' };
  },
  rebuild: (_, options) => {
    const agent = agentId(options.agent);
    return publish('Rebuild task board', (base) => {
      registered(base, agent);
      const paths = pathsAt(base);
      return { files: { [paths.board]: boardFor(tasksAt(base), paths) }, result: { path: paths.board } };
    });
  },
  sync: () => {
    const commit = live();
    fastForward(commit);
    return { commit };
  },
  outbox: () => {
    const path = localPath('outbox');
    return { path, pending: existsSync(path) ? readdirSync(path).filter((name) => name.endsWith('.json')) : [] };
  },
  add: (id, options) => add(taskId(id), agentId(options.agent), options),
  start: (id, options) => claim(taskId(id), agentId(options.agent), options, true),
  claim: (id, options) => claim(taskId(id), agentId(options.agent), options),
  heartbeat: (id, options) => mutate(taskId(id), agentId(options.agent), 'Heartbeat', (_, task) => ({
    updated: { ...task, lease: { ...task.lease, expiresAt: timestamp(Date.now() + ttl(options.ttl)) } },
  }), options['if-rev']),
  save: (id, options) => save(taskId(id), agentId(options.agent), options),
  release: (id, options) => mutate(taskId(id), agentId(options.agent), 'Release', (_, task) => ({
    updated: { ...task, status: task.status === 'doing' ? 'open' : task.status, lease: null },
  }), options['if-rev']),
  settle: (id, options) => settle(taskId(id), agentId(options.agent), options),
  finish: (id, options) => settle(taskId(id), agentId(options.agent), options),
  snapshot: (_, options) => snapshot(agentId(options.agent), options),
};

try {
  const [command = 'help', ...args] = process.argv.slice(2);
  requireThat(Object.hasOwn(commands, command), 'Unknown command. Run node hars-mem.mjs help.');
  const { id, options } = parse(args);
  requireThat(options['as-of'] === undefined || ['board', 'brief', 'check', 'recall'].includes(command),
    'Historical reads cannot act on tasks. Use --as-of only with board, brief, check, or recall.');
  if (command === 'boot' || command === 'start') sessionStart(command, args);
  process.stdout.write(jsonText(await commands[command](id, options)));
} catch (error) {
  process.stderr.write(error.message + '\n');
  process.exitCode = 1;
}
