import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliPath = path.join(projectRoot, 'hars-mem.mjs');
const taskId = 'field-guide/review';
const taskGoal = 'Review the field guide.';
const taskDoneWhen = 'The revised guide is checked against the source and saved.';

function git(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed in ${cwd}:\n${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

function runProcess(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', (chunk) => { stdout += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal, stdout, stderr }));
  });
}

async function runCli(cwd, ...args) {
  const result = await runProcess(process.execPath, [path.join(cwd, 'hars-mem.mjs'), ...args], cwd);
  assert.equal(
    result.code,
    0,
    `hars-mem ${args.join(' ')} failed (exit ${result.code}):\n${result.stderr || result.stdout}`,
  );
  try {
    return JSON.parse(result.stdout.trim());
  } catch (error) {
    throw new Error(`hars-mem ${args.join(' ')} did not return JSON on stdout:\n${result.stdout}`, { cause: error });
  }
}

async function runCliExpectFailure(cwd, ...args) {
  const result = await runProcess(process.execPath, [path.join(cwd, 'hars-mem.mjs'), ...args], cwd);
  assert.notEqual(
    result.code,
    0,
    `hars-mem ${args.join(' ')} unexpectedly succeeded:\n${result.stdout}`,
  );
  return result;
}

async function copyRelease(destination) {
  await mkdir(destination, { recursive: true });
  const tracked = git(projectRoot, ['ls-files', '-z']).split('\0');
  for (const file of tracked.filter((name) => name && !name.startsWith('tests/'))) {
    const target = repoPath(destination, file);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(repoPath(projectRoot, file), target);
  }
}

async function createProject(workspace, projects = 'projects') {
  const project = path.join(workspace, projects, 'field-guide');
  await mkdir(project, { recursive: true });
  await writeFile(path.join(workspace, 'field-notes.md'), 'File each field observation under its survey date.\n');
  await writeFile(path.join(project, 'SOURCES.json'), JSON.stringify([
    { id: 'field-notes', kind: 'repo', path: 'field-notes.md', owner: 'guide owner', use: 'Verify the filing rule.' },
    { id: 'survey', kind: 'live', url: 'https://example.invalid/survey', owner: 'survey owner', use: 'Verify current survey details.' },
  ]));
  await writeFile(path.join(project, 'SYNTHESIS.md'), '# Field guide\n\nUse the survey date to file an observation.\n');
  git(workspace, ['add', '--', projects + '/field-guide', 'field-notes.md']);
  git(workspace, ['-c', 'user.name=Acceptance Owner', '-c', 'user.email=owner@example.invalid',
    'commit', '-m', 'Create the first project']);
  git(workspace, ['push', 'origin', 'main']);
}

async function createTask(workspace, agent) {
  return runCli(workspace, 'add', taskId, '--agent', agent, '--goal', taskGoal, '--done-when', taskDoneWhen,
    '--files', 'field-notes.md', '--excluded', 'Publishing the guide', '--proof', 'Saved review checkpoint.');
}

function repoPath(workspace, relativePath) {
  assert.equal(typeof relativePath, 'string', 'CLI should return a repository-relative path');
  const absolute = path.resolve(workspace, relativePath);
  const relative = path.relative(workspace, absolute);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `unsafe repo path: ${relativePath}`);
  return absolute;
}

function assertTaskEnvelope(result, operation) {
  assert.ok(result && typeof result === 'object', `${operation} should return a JSON object`);
  assert.ok(result.task && typeof result.task === 'object', `${operation} should return task state`);
  return result.task;
}

async function readLiveTask(workspace) {
  const result = await runCli(workspace, 'brief', taskId);
  return { result, task: assertTaskEnvelope(result, 'brief') };
}

test('cold acceptance: Git-backed canon, claims, checkpoints, recovery, and board readback', {
  timeout: 240_000,
}, async () => {
  assert.ok(await readFile(cliPath, 'utf8').catch(() => null), 'hars-mem.mjs must exist before acceptance runs');

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hars-mem-cold-acceptance-'));
  const tempRelative = path.relative(os.tmpdir(), tempRoot);
  assert.ok(
    tempRelative && !tempRelative.startsWith('..') && !path.isAbsolute(tempRelative)
      && path.basename(tempRoot).startsWith('hars-mem-cold-acceptance-'),
    'test cleanup must stay inside its own temporary directory',
  );

  const origin = path.join(tempRoot, 'origin.git');
  const offlineOrigin = path.join(tempRoot, 'origin.offline');
  const seed = path.join(tempRoot, 'seed');
  const cloneA = path.join(tempRoot, 'clone-a');
  const cloneB = path.join(tempRoot, 'clone-b');

  try {
    const cliSource = await readFile(cliPath, 'utf8');
    assert.ok(cliSource.length > 0, 'hars-mem.mjs should contain the CLI');
    await copyRelease(seed);

    git(tempRoot, ['init', '--bare', '--initial-branch=main', origin]);
    const setupArgs = [path.join(seed, 'setup.mjs'), '--local', origin];
    const setup = await runProcess(process.execPath, setupArgs, seed);
    assert.equal(setup.code, 0, setup.stderr);
    assert.match(setup.stdout, /Verified main at [0-9a-f]{40}/);
    assert.equal((await runProcess(process.execPath, setupArgs, seed)).stdout, setup.stdout);
    git(tempRoot, ['clone', '--branch', 'main', origin, cloneA]);
    git(tempRoot, ['clone', '--branch', 'main', origin, cloneB]);

    for (const workspace of [cloneA, cloneB]) {
      git(workspace, ['config', 'user.name', 'Acceptance Test']);
      git(workspace, ['config', 'user.email', 'acceptance@example.invalid']);
    }

    const seedCheck = await runCli(cloneA, 'check');
    assert.equal(seedCheck.board, 'current', 'checked-in seed board should match the task records');
    const seedBoard = await runCli(cloneA, 'board');
    assert.equal(seedBoard.commit, seedCheck.commit);
    assert.deepEqual(seedBoard.tasks, []);
    assert.deepEqual(JSON.parse(git(cloneA, ['show', 'HEAD:holds.json'])), { holds: [] });
    assert.deepEqual(git(cloneA, ['ls-tree', '-r', '--name-only', 'HEAD', '--', 'projects', 'state']).split('\n'),
      ['projects/.gitkeep', 'state/.gitkeep']);

    // Each CLI call is a new Node process, so no process memory carries between steps.
    const staleMemoryPath = path.join(tempRoot, 'stale-harness-memory.txt');
    const staleMemory = 'Harness memory says: use the retired offline archive as canon.\nCraft: keep examples short.';
    await writeFile(staleMemoryPath, staleMemory, 'utf8');
    const agentA = 'cold-acceptance-a';
    const agentB = 'cold-acceptance-b';
    const bootArgsA = [
      'boot', '--agent', agentA, '--role', 'outer', '--scope', 'all',
      '--capabilities', 'shell,git-write', '--memory', staleMemoryPath,
    ];
    const bootA = await runCli(cloneA, ...bootArgsA);
    assert.equal(bootA.task, null);
    const canonText = typeof bootA.canon === 'string' ? bootA.canon : JSON.stringify(bootA.canon);
    assert.match(canonText, /# Hars-Mem operating rules/);
    assert.doesNotMatch(canonText, /retired offline archive/);
    assert.equal(bootA.memory?.reviewRequired, true, 'supplied native memory should be reviewed');
    assert.match(bootA.memory.instruction, /keep unrelated harness craft/i);
    assert.ok(!Object.hasOwn(bootA.memory, 'conflict'), 'the CLI should not claim semantic conflict detection');
    assert.equal(await readFile(staleMemoryPath, 'utf8'), staleMemory, 'boot must not rewrite harness memory');

    const bootAAgain = await runCli(cloneA, ...bootArgsA);
    assert.equal(bootAAgain.commit, bootA.commit, 're-registering the same agent should not create another commit');
    assert.deepEqual(bootAAgain.registration, bootA.registration, 'registration should be stable across restart');

    await runCli(cloneA, 'sync');
    await createProject(cloneA);
    const added = await createTask(cloneA, agentA);
    assert.equal(added.task.id, taskId);
    assert.equal(added.task.status, 'open');

    const bootB = await runCli(
      cloneB,
      'boot', '--agent', agentB, '--role', 'worker', '--scope', 'field-guide',
      '--capabilities', 'shell,git-write',
    );
    assert.equal(bootB.task.id, taskId);
    const freshCanonText = typeof bootB.canon === 'string' ? bootB.canon : JSON.stringify(bootB.canon);
    assert.match(freshCanonText, /# Hars-Mem operating rules/);

    // Two distinct agent snapshots are written concurrently from independent clones.
    const snapshotAInput = path.join(tempRoot, 'snapshot-a.txt');
    const snapshotBInput = path.join(tempRoot, 'snapshot-b.txt');
    const snapshotAContent = 'Fictional acceptance snapshot from worker A.';
    const snapshotBContent = 'Fictional acceptance snapshot from worker B.';
    await writeFile(snapshotAInput, snapshotAContent, 'utf8');
    await writeFile(snapshotBInput, snapshotBContent, 'utf8');
    const [snapshotA, snapshotB] = await Promise.all([
      runCli(cloneA, 'snapshot', '--agent', agentA, '--file', snapshotAInput),
      runCli(cloneB, 'snapshot', '--agent', agentB, '--file', snapshotBInput),
    ]);
    assert.ok(snapshotA.path && snapshotB.path, 'both snapshot writes should return their saved paths');
    assert.notEqual(snapshotA.path, snapshotB.path, 'independent agents should write independent snapshot paths');
    git(cloneA, ['fetch', 'origin']);
    const liveSnapshotA = git(cloneA, ['show', `origin/main:${snapshotA.path}`]);
    const liveSnapshotB = git(cloneA, ['show', `origin/main:${snapshotB.path}`]);
    assert.ok(liveSnapshotA.includes(snapshotAContent), 'worker A snapshot must survive concurrent writes');
    assert.ok(liveSnapshotB.includes(snapshotBContent), 'worker B snapshot must survive concurrent writes');

    // A stale clone must fail a live read while its only origin is unavailable.
    await rename(origin, offlineOrigin);
    try {
      await runCliExpectFailure(cloneA, 'board');
    } finally {
      await rename(offlineOrigin, origin);
    }

    // Both processes race for one task. Exactly one lease may become active.
    const claimArgs = (agent) => ['start', taskId, '--agent', agent, '--ttl', '900'];
    const claimResults = await Promise.all([
      runProcess(process.execPath, [path.join(cloneA, 'hars-mem.mjs'), ...claimArgs(agentA)], cloneA),
      runProcess(process.execPath, [path.join(cloneB, 'hars-mem.mjs'), ...claimArgs(agentB)], cloneB),
    ]);
    const winners = claimResults.map((result, index) => ({ result, agent: index === 0 ? agentA : agentB }))
      .filter(({ result }) => result.code === 0);
    assert.equal(
      winners.length,
      1,
      `exclusive claim race must have exactly one winner; outcomes: ${claimResults.map((x) => `${x.code}: ${x.stderr || x.stdout}`).join('\n')}`,
    );
    const winner = winners[0];
    const winnerWorkspace = winner.agent === agentA ? cloneA : cloneB;
    const handoffWorkspace = winner.agent === agentA ? cloneB : cloneA;
    const handoffAgent = winner.agent === agentA ? agentB : agentA;
    const winnerClaim = JSON.parse(winner.result.stdout.trim());
    const claimedTask = assertTaskEnvelope(winnerClaim, 'claim');
    assert.equal(claimedTask.lease?.agent, winner.agent);
    assert.equal(claimedTask.lease?.active, true);
    assert.match(winnerClaim.canon, /# Hars-Mem operating rules/);
    assert.match(winnerClaim.canonCommit, /^[0-9a-f]{40}$/i);
    assert.equal(winnerClaim.packet.goal, taskGoal);
    assert.equal(winnerClaim.packet.doneWhen, taskDoneWhen);
    assert.deepEqual(winnerClaim.packet.files, ['field-notes.md']);
    assert.equal(winnerClaim.packet.synthesis, 'projects/field-guide/SYNTHESIS.md');
    assert.equal(winnerClaim.packet.sources[0].content, 'File each field observation under its survey date.\n');
    assert.equal(winnerClaim.packet.sources[0].commit, winnerClaim.canonCommit);
    assert.equal(winnerClaim.packet.sources[1].verified, false);

    const progressDetail = 'Completed the first fictional handoff milestone.';
    const progressText = 'Checkpoint content: the example task is ready for review.';
    const progressInput = path.join(winnerWorkspace, 'acceptance-progress.txt');
    await writeFile(progressInput, progressText, 'utf8');
    const saved = await runCli(
      winnerWorkspace,
      'save', taskId, '--agent', winner.agent, '--detail', progressDetail, '--file', progressInput,
    );
    const savedTask = assertTaskEnvelope(saved, 'save');
    assert.equal(savedTask.detail, progressDetail);
    assert.ok(Array.isArray(savedTask.checkpoints) && savedTask.checkpoints.length > 0);
    const checkpoint = savedTask.checkpoints.find((item) => item.agent === winner.agent) ?? savedTask.checkpoints.at(-1);
    repoPath(winnerWorkspace, checkpoint.path);
    git(winnerWorkspace, ['fetch', 'origin']);
    assert.equal(
      git(winnerWorkspace, ['show', `origin/main:${checkpoint.path}`]),
      progressText,
      'checkpoint content must be saved on the live Git origin',
    );

    const released = await runCli(winnerWorkspace, 'release', taskId, '--agent', winner.agent);
    const releasedTask = assertTaskEnvelope(released, 'release');
    assert.equal(releasedTask.status, 'open', 'release should reopen the task for handoff');
    assert.equal(releasedTask.lease, null, 'release should clear the active lease');

    const coldBrief = await runCli(handoffWorkspace, 'brief', taskId);
    const coldTask = assertTaskEnvelope(coldBrief, 'brief after restart');
    assert.equal(coldTask.detail, progressDetail, 'a fresh process in the other clone should read saved progress');
    assert.ok(coldTask.checkpoints.some((item) => item.path === checkpoint.path));
    const packetText = JSON.stringify(coldBrief.packet);
    for (const field of ['goal', 'doneWhen', 'files', 'holds', 'excluded', 'proof']) {
      assert.ok(Object.hasOwn(coldBrief.packet, field), `handoff packet should expose ${field}`);
    }
    assert.ok(packetText.length > 0, 'handoff packet should be readable by the next worker');
    const minimal = await runCli(handoffWorkspace, 'brief', taskId, '--packet', 'minimal');
    assert.equal(minimal.packet.taskId, taskId);
    assert.equal(minimal.packet.revision, coldTask.rev);
    assert.equal(minimal.packet.checkpoints[0].path, checkpoint.path);
    assert.deepEqual(minimal.packet.sources[0], { id: 'field-notes', kind: 'repo', owner: 'guide owner',
      use: 'Verify the filing rule.', path: 'field-notes.md', commit: minimal.commit });
    const rejoined = await runCli(cloneA, ...bootArgsA);
    assert.equal(rejoined.memory.snapshot.content, snapshotAContent);
    assert.equal(rejoined.memory.snapshot.commit, snapshotA.commit);
    const scopedRecall = await runCli(cloneA, 'recall', 'acceptance snapshot', '--agent', agentA, '--backend', 'git');
    assert.deepEqual(scopedRecall.results.map(({ path: found }) => found), [snapshotA.path]);

    const handedOffClaim = await runCli(handoffWorkspace, ...claimArgs(handoffAgent));
    assert.equal(assertTaskEnvelope(handedOffClaim, 'handoff claim').lease?.agent, handoffAgent);
    const handoffRelease = await runCli(handoffWorkspace, 'release', taskId, '--agent', handoffAgent);
    assert.equal(assertTaskEnvelope(handoffRelease, 'handoff release').lease, null);

    // Expire an old lease, let the other agent take over, then prove the old input survives rejection.
    const staleOwner = agentA;
    const currentOwner = agentB;
    const shortClaim = await runCli(cloneA, 'start', taskId, '--agent', staleOwner, '--ttl', '15');
    const remaining = Date.parse(shortClaim.task.lease.expiresAt) - Date.now();
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, remaining) + 100));
    const expiredBoard = await runCli(cloneB, 'board');
    assert.equal(expiredBoard.tasks.find((task) => task.id === taskId).lease.active, false);
    const takeover = await runCli(cloneB, ...claimArgs(currentOwner));
    assert.equal(assertTaskEnvelope(takeover, 'expired lease takeover').lease?.agent, currentOwner);

    const current = await readLiveTask(cloneB);
    assert.equal(current.task.lease?.agent, currentOwner, 'the revision check must run while this lease is valid');
    assert.equal(current.task.lease?.active, true);
    const revisionInput = path.join(cloneB, 'acceptance-revision-input.txt');
    const revisionContent = 'Preserve this fictional stale-revision input.';
    await writeFile(revisionInput, revisionContent, 'utf8');
    const staleRevisionFailure = await runCliExpectFailure(
      cloneB,
      'save', taskId, '--agent', currentOwner,
      '--detail', 'This stale revision must fail.', '--file', revisionInput,
      '--if-rev', String(current.task.rev - 1),
    );
    assert.match(staleRevisionFailure.stderr, /revision/i, 'a valid lease with an old revision should hit the revision guard');
    assert.equal(await readFile(revisionInput, 'utf8'), revisionContent, 'failed revision check must preserve its input');

    const staleInput = path.join(cloneA, 'acceptance-stale-input.txt');
    const staleInputContent = 'Do not discard this fictional stale-lease input.';
    await writeFile(staleInput, staleInputContent, 'utf8');
    await runCliExpectFailure(
      cloneA,
      'save', taskId, '--agent', staleOwner,
      '--detail', 'This stale update must fail.', '--file', staleInput,
    );
    assert.equal(await readFile(staleInput, 'utf8'), staleInputContent, 'failed stale save must preserve the caller input');
    const staleOutboxPath = path.join(cloneA, '.git', 'hars-mem', 'outbox');
    const staleQueued = await readdir(staleOutboxPath).catch(() => []);
    assert.ok(staleQueued.length > 0, 'failed stale save should keep its queued input for recovery');
    const staleOutboxText = (await Promise.all(
      staleQueued.map((name) => readFile(path.join(staleOutboxPath, name), 'utf8')),
    )).join('\n');
    assert.ok(staleOutboxText.includes(Buffer.from(staleInputContent, 'utf8').toString('base64')));

    const revisionOutboxPath = path.join(cloneB, '.git', 'hars-mem', 'outbox');
    const revisionQueued = await readdir(revisionOutboxPath).catch(() => []);
    assert.ok(revisionQueued.length > 0, 'failed revision-guard save should keep its queued input');
    const revisionOutboxText = (await Promise.all(
      revisionQueued.map((name) => readFile(path.join(revisionOutboxPath, name), 'utf8')),
    )).join('\n');
    assert.ok(revisionOutboxText.includes(Buffer.from(revisionContent, 'utf8').toString('base64')));

    const stillOwned = await readLiveTask(cloneB);
    assert.equal(stillOwned.task.lease?.agent, currentOwner, 'stale save must not disturb the valid owner lease');

    const settled = await runCli(
      cloneB,
      'finish', taskId, '--agent', currentOwner, '--receipt', checkpoint.path,
    );
    const settledTask = assertTaskEnvelope(settled, 'settle');
    assert.equal(settledTask.status, 'done');
    assert.equal(settledTask.lease, null);
    assert.equal(settledTask.receipt?.value, checkpoint.path);

    const board = await runCli(cloneA, 'board');
    assert.equal(board.commit, settled.commit, 'board should read back the latest live Git commit');
    assert.match(board.markdown, /field-guide\/review/);
    assert.match(board.markdown, /done/i);
    assert.ok(board.markdown.includes(checkpoint.path), 'live board should include the completion receipt');

    // Publish new canon and CLI bytes from a separate checkout, then boot the old clone.
    git(seed, ['pull', '--ff-only', 'origin', 'main']);
    const changeMarker = '\nRuntime update proof for the next clean boot.\n';
    const runtimeMarker = '\n// Runtime update proof.\n';
    const canonPath = path.join(seed, 'AGENTS.md');
    const runtimePath = path.join(seed, 'hars-mem.mjs');
    await writeFile(canonPath, (await readFile(canonPath, 'utf8')) + changeMarker);
    await writeFile(runtimePath, (await readFile(runtimePath, 'utf8')) + runtimeMarker);
    git(seed, ['add', '--', 'AGENTS.md', 'hars-mem.mjs']);
    git(seed, ['commit', '-m', 'Update canon and running CLI']);
    git(seed, ['push', 'origin', 'main']);
    const publishedRuntime = git(seed, ['rev-parse', 'HEAD']);
    const reboot = await runCli(cloneA, ...bootArgsA);
    assert.equal(reboot.canonCommit, publishedRuntime);
    assert.ok(reboot.canon.includes(changeMarker));
    assert.ok((await readFile(path.join(cloneA, 'hars-mem.mjs'), 'utf8')).includes(runtimeMarker));

    const dirtyPath = path.join(cloneB, 'AGENTS.md');
    const originalCanon = await readFile(dirtyPath, 'utf8');
    await writeFile(dirtyPath, originalCanon + '\nKeep this local edit.\n');
    const dirtyBoot = await runCliExpectFailure(cloneB, ...bootArgsA);
    assert.match(dirtyBoot.stderr, /tracked changes preserved/i);
    assert.ok((await readFile(dirtyPath, 'utf8')).includes('Keep this local edit.'));

    git(cloneA, ['fetch', 'origin']);
    assert.ok(git(cloneA, ['show', `origin/main:${snapshotA.path}`]).includes(snapshotAContent));
    assert.ok(git(cloneA, ['show', `origin/main:${snapshotB.path}`]).includes(snapshotBContent));
  } finally {
    const relative = path.relative(os.tmpdir(), tempRoot);
    assert.ok(
      relative && !relative.startsWith('..') && !path.isAbsolute(relative)
        && path.basename(tempRoot).startsWith('hars-mem-cold-acceptance-'),
      'refusing to clean a path outside this acceptance test temporary directory',
    );
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('custom folders and local search use one live Git source', { timeout: 240_000 }, async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hars-mem-layout-'));
  const relative = path.relative(os.tmpdir(), tempRoot);
  assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    && path.basename(tempRoot).startsWith('hars-mem-layout-'), 'unsafe temporary cleanup path');
  const seed = path.join(tempRoot, 'seed');
  const origin = path.join(tempRoot, 'origin.git');
  const clone = path.join(tempRoot, 'clone');
  try {
    await copyRelease(seed);
    await mkdir(path.join(seed, 'notes', 'knowledge'), { recursive: true });
    await mkdir(path.join(seed, 'crew'));
    const paths = {
      board: 'notes/board.md', holds: 'notes/holds.json', state: 'notes/tasks', projects: 'notes/projects',
      agents: 'crew/agents', checkpoints: 'notes/checkpoints', snapshots: 'crew/snapshots', knowledge: 'notes/knowledge',
    };
    for (const [key, from] of Object.entries({
      board: 'BOARD.md', holds: 'holds.json', state: 'state', projects: 'projects', snapshots: 'snapshots',
    })) await rename(path.join(seed, from), path.join(seed, paths[key]));
    await writeFile(path.join(seed, 'paths.json'), JSON.stringify(paths));
    await writeFile(path.join(seed, paths.knowledge, 'method.md'), 'Use a local field guide for the field guide project.');
    git(tempRoot, ['init', '--bare', '--initial-branch=main', origin]);
    git(tempRoot, ['init', '--initial-branch=main', seed]);
    git(seed, ['add', '-A']);
    git(seed, ['-c', 'user.name=Acceptance Test', '-c', 'user.email=acceptance@example.invalid', 'commit', '-m', 'Seed custom layout']);
    git(seed, ['push', origin, 'main']);
    git(tempRoot, ['clone', '--branch', 'main', origin, clone]);

    const agent = 'layout-test';
    const boot = await runCli(clone, 'boot', '--agent', agent, '--role', 'outer', '--scope', 'field-guide',
      '--capabilities', 'shell,git-write');
    assert.equal(boot.registrationPath, 'crew/agents/layout-test.json');
    assert.equal(boot.registration.snapshot, 'crew/snapshots/layout-test/LATEST.md');
    assert.equal(boot.task, null);
    await runCli(clone, 'rebuild', '--agent', agent);
    assert.deepEqual((await runCli(clone, 'board')).tasks, []);
    await runCli(clone, 'sync');
    await createProject(clone, paths.projects);
    await createTask(clone, agent);
    assert.equal((await runCli(clone, 'check')).board, 'current');
    const board = await runCli(clone, 'board');
    assert.equal(board.path, paths.board);
    assert.ok(board.markdown.includes('(tasks/field-guide/review.json)'));
    const brief = await runCli(clone, 'brief', taskId);
    assert.equal(brief.packet.synthesis, 'notes/projects/field-guide/SYNTHESIS.md');
    assert.equal(brief.packet.sources[0].path, 'field-notes.md');

    const gitRecall = await runCli(clone, 'recall', 'local field guide', '--backend', 'git');
    assert.equal(gitRecall.backend, 'git');
    assert.equal(gitRecall.commit, board.commit);
    assert.equal(gitRecall.results[0].path, 'notes/knowledge/method.md');
    const sourceRecall = await runCli(clone, 'recall', 'file each field observation', '--backend', 'git');
    assert.equal(sourceRecall.results[0].path, 'field-notes.md');
    const sqliteSupported = await import('node:sqlite').then(() => true, () => false);
    const backend = sqliteSupported ? 'sqlite' : 'auto';
    const localRecall = await runCli(clone, 'recall', 'local field guide', '--backend', backend);
    assert.equal(localRecall.backend, sqliteSupported ? 'sqlite' : 'git');
    assert.deepEqual(localRecall.results, gitRecall.results);
    const brokenIndex = path.join(clone, '.git', 'hars-mem', 'index-' + agent + '.sqlite');
    await writeFile(brokenIndex, 'Unavailable SQLite cache.');
    const fallbackRecall = await runCli(clone, 'recall', 'local field guide', '--agent', agent);
    assert.equal(fallbackRecall.backend, 'git');
    assert.equal(fallbackRecall.commit, localRecall.commit);
    assert.deepEqual(fallbackRecall.results, gitRecall.results);
    await rm(brokenIndex);

    const draft = path.join(tempRoot, 'working.md');
    await writeFile(draft, 'Portable field guide recipe with repeatable steps.');
    await runCli(clone, 'start', taskId, '--agent', agent);
    const saved = await runCli(clone, 'save', taskId, '--agent', agent, '--file', draft);
    assert.match(saved.task.checkpoints[0].path, /^notes\/checkpoints\/field-guide\/review\//);
    await runCli(clone, 'finish', taskId, '--agent', agent, '--receipt', saved.task.checkpoints[0].path);
    const snapshot = await runCli(clone, 'snapshot', '--agent', agent, '--file', draft);
    const refreshed = await runCli(clone, 'recall', 'repeatable steps', '--backend', backend);
    assert.equal(refreshed.commit, snapshot.commit);
    assert.equal(refreshed.results[0].path, boot.registration.snapshot);

    // A Git receiver can accept a write after a short lease crosses its wall-clock expiry.
    const delayed = 'field-guide/slow-receiver';
    const delayedStart = 'field-guide/slow-start';
    await runCli(clone, 'add', delayed, '--agent', agent, '--goal', 'Test readback timing',
      '--done-when', 'Late confirmation reports its timing');
    await runCli(clone, 'add', delayedStart, '--agent', agent, '--goal', 'Test slow claim',
      '--done-when', 'No worker is dispatched on an expired claim');
    await runCli(clone, 'start', delayed, '--agent', agent, '--ttl', '15');
    const hook = path.join(origin, 'hooks', 'pre-receive');
    const node = process.execPath.replaceAll('\\', '/').replaceAll("'", "'\"'\"'");
    const delay = '#!/bin/sh\nexec \'' + node + '\' -e \'setTimeout(() => {}, 18000)\'\n';
    await writeFile(hook, delay, { mode: 0o755 });
    const late = await runCli(clone, 'finish', delayed, '--agent', agent, '--receipt', 'field-notes.md');
    assert.equal(late.leaseTiming.status, 'expiry-crossed-at-readback');
    assert.match(late.leaseTiming.warning, /review/i);
    assert.ok(Date.parse(late.leaseTiming.verifiedAt) >= Date.parse(late.leaseTiming.expiresAt));
    const confirmed = await runCli(clone, 'brief', delayed);
    assert.equal(confirmed.commit, late.commit);
    const expired = await runCli(clone, 'start', delayedStart, '--agent', agent, '--ttl', '15');
    assert.equal(expired.leaseTiming.status, 'expiry-crossed-at-readback');
    assert.equal(expired.task.lease.active, false);
    assert.equal(expired.ready, false);
    assert.ok(!Object.hasOwn(expired, 'packet'));
    await rm(hook);
    const restarted = await runCli(clone, 'start', delayedStart, '--agent', agent, '--ttl', '15');
    assert.equal(restarted.ready, true);
    await writeFile(hook, delay, { mode: 0o755 });
    const lateSave = await runCli(clone, 'save', delayedStart, '--agent', agent, '--file', draft);
    assert.equal(lateSave.leaseTiming.status, 'expiry-crossed-at-readback');
    assert.equal(lateSave.task.lease.active, false);
    assert.ok(lateSave.task.checkpoints[0].path);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
});

test('a store cutover keeps Git history and fences stale checkouts through a failed activation and retry', {
  timeout: 120_000,
}, async () => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hars-mem-cutover-'));
  const seed = path.join(tempRoot, 'seed');
  const peer = path.join(tempRoot, 'old-checkout');
  const fresh = path.join(tempRoot, 'fresh-checkout');
  const source = path.join(tempRoot, 'source.git');
  const destination = path.join(tempRoot, 'target with space.git');
  const occupied = path.join(tempRoot, 'occupied.git');
  const offline = source + '.offline';
  const agent = 'cutover-owner';
  try {
    await copyRelease(seed);
    for (const remote of [source, destination, occupied]) {
      git(tempRoot, ['init', '--bare', '--initial-branch=main', remote]);
    }
    const setup = await runProcess(process.execPath, [path.join(seed, 'setup.mjs'), '--local', source], seed);
    assert.equal(setup.code, 0, setup.stderr);
    const empty = await runCli(seed, 'store', 'check');
    assert.equal(empty.store, 'local-bare-git');
    assert.equal(empty.readable, true);
    assert.equal(empty.pushNegotiation, 'accepted-dry-run');
    assert.deepEqual((await runCli(seed, 'board')).tasks, []);

    await runCli(seed, 'boot', '--agent', agent, '--role', 'outer', '--scope', 'all',
      '--capabilities', 'shell,git-read,git-write');
    await createTask(seed, agent);
    await runCli(seed, 'start', taskId, '--agent', agent);
    const draft = path.join(tempRoot, 'draft.md');
    await writeFile(draft, 'A draft that must survive storage migration.\n');
    const saved = await runCli(seed, 'save', taskId, '--agent', agent, '--file', draft);
    const checkpoint = saved.task.checkpoints[0].path;
    const snapshot = await runCli(seed, 'snapshot', '--agent', agent, '--file', draft);
    const from = snapshot.commit;
    git(tempRoot, ['clone', '--branch', 'main', source, peer]);
    git(seed, ['push', occupied, from + ':refs/heads/main']);

    const migrate = (target, sha = from) => ['store', 'migrate', '--to', target, '--from', sha];
    assert.match((await runCliExpectFailure(seed, ...migrate(destination, empty.commit))).stderr, /source advanced/i);
    assert.match((await runCliExpectFailure(seed, ...migrate(occupied))).stderr, /already has Git refs/i);
    assert.equal((await runCli(seed, 'store', 'check')).commit, from);

    const hook = path.join(destination, 'hooks', 'pre-receive');
    await writeFile(hook, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    assert.match((await runCliExpectFailure(seed, ...migrate(destination))).stderr, /destination activation/i);
    assert.equal(git(destination, ['ls-remote', '--refs', destination]), '');
    const frozen = await runCli(peer, 'store', 'check');
    assert.equal(frozen.state, 'frozen');
    assert.match((await runCliExpectFailure(seed, ...migrate(occupied))).stderr, /original destination/i);
    assert.match((await runCliExpectFailure(peer, 'board')).stderr, /frozen for migration/i);

    await rename(source, offline);
    try {
      assert.match((await runCliExpectFailure(peer, 'brief', taskId)).stderr, /state is unknown/i);
      const historical = await runCli(peer, 'brief', taskId, '--as-of', from);
      assert.equal(historical.provenance.mode, 'as-of');
      assert.equal(historical.task.lease.active, null);
      assert.equal(historical.task.checkpoints[0].path, checkpoint);
      assert.equal((await runCli(peer, 'check', '--as-of', from)).board, 'matches-as-of');
      const oldRecall = await runCli(peer, 'recall', 'survive storage migration', '--as-of', from, '--backend', 'git');
      assert.equal(oldRecall.provenance.current, false);
      assert.equal(oldRecall.results[0].path, snapshot.path);
      assert.match((await runCliExpectFailure(peer, 'start', taskId, '--agent', agent, '--as-of', from)).stderr, /historical reads/i);
    } finally {
      await rename(offline, source);
    }

    await rm(hook);
    const switched = await runCli(seed, ...migrate(destination));
    assert.equal(switched.frozen, frozen.commit);
    assert.equal(switched.from, from);
    assert.equal(switched.switched, true);
    assert.equal(git(seed, ['rev-parse', switched.commit + '^^']), from);
    assert.equal(git(seed, ['diff', '--name-only', from, switched.commit]), '.hars-mem-store.json');
    assert.equal((await runCli(seed, ...migrate(destination))).commit, switched.commit);
    assert.equal((await runCli(seed, 'board')).tasks[0].lease.active, true);
    assert.match((await runCliExpectFailure(peer, 'add', 'field-guide/stale', '--agent', agent, '--goal', 'Stale',
      '--done-when', 'Refuse this write')).stderr, /frozen for migration/i);
    assert.equal(git(peer, ['ls-remote', source, 'refs/heads/main']).split('\t')[0], frozen.commit);

    const finished = await runCli(seed, 'finish', taskId, '--agent', agent, '--if-rev', String(saved.task.rev), '--receipt', checkpoint);
    git(tempRoot, ['clone', '--branch', 'main', destination, fresh]);
    const brief = await runCli(fresh, 'brief', taskId);
    assert.equal(brief.commit, finished.commit);
    assert.equal(brief.task.receipt.value, checkpoint);
    assert.equal(git(fresh, ['show', `${brief.commit}:${checkpoint}`]), 'A draft that must survive storage migration.');
    assert.equal((await runCli(fresh, 'store', 'check')).state, 'active');
  } finally {
    assert.equal(path.dirname(tempRoot), os.tmpdir());
    assert.ok(path.basename(tempRoot).startsWith('hars-mem-cutover-'));
    await rm(tempRoot, { recursive: true, force: true });
  }
});
