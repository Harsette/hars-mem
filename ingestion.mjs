import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { artifact, bundle, changes, id, object, outsideGit, scope, selectedFile, text, utc } from './onboard.mjs';
import { privateOrigin } from './store.mjs';

const json = (value) => JSON.stringify(value, null, 2) + '\n';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const kinds = ['skill', 'prompt', 'decision', 'memory', 'open-work', 'pointer'];
const sourceTypes = ['connector', 'selected-chat', 'manual'];
const rawLimit = 512 * 1024;

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function absolute(path) {
  requireThat(typeof path === 'string' && isAbsolute(path), 'Use an absolute owner-selected local path.');
  return path;
}

function config(value, target) {
  object(value, ['version', 'target', 'sources']);
  requireThat(value.version === 1 && value.target === target.fingerprint, 'Configuration does not match the verified private destination.');
  requireThat(Array.isArray(value.sources) && value.sources.length >= 1 && value.sources.length <= 12,
    'Configure between 1 and 12 explicitly allowed sources.');
  const seen = new Set();
  return value.sources.map((entry) => {
    object(entry, ['id', 'harness', 'scope', 'type', 'kinds', 'feed', 'maxBatches'], ['raw']);
    const source = id(entry.id);
    requireThat(!seen.has(source) && sourceTypes.includes(entry.type), 'Use a unique source ID and supported source type.');
    seen.add(source);
    requireThat(Array.isArray(entry.kinds) && entry.kinds.length && entry.kinds.every((kind) => kinds.includes(kind)),
      'Allow only supported reference kinds for recurring ingestion.');
    requireThat(Number.isInteger(entry.maxBatches) && entry.maxBatches >= 1 && entry.maxBatches <= 8,
      'Use a maxBatches limit from 1 through 8.');
    const result = { source, harness: id(entry.harness), scope: scope(entry.scope), type: entry.type,
      kinds: entry.kinds, feed: absolute(entry.feed), maxBatches: entry.maxBatches };
    if (Object.hasOwn(entry, 'raw')) {
      requireThat(entry.type === 'selected-chat', 'Raw retention applies only to an explicitly selected chat export.');
      object(entry.raw, ['file', 'directory', 'expiresAt']);
      result.raw = { file: absolute(entry.raw.file), directory: absolute(entry.raw.directory), expiresAt: utc(entry.raw.expiresAt) };
    }
    return result;
  });
}

function fresh(checkedAt) {
  const age = Date.now() - Date.parse(checkedAt);
  requireThat(age >= -5 * 60_000 && age <= 24 * 60 * 60_000, 'The source permission check is stale or in the future.');
}

function readFeed(value, source) {
  const status = value?.status;
  requireThat(['ready', 'current', 'denied', 'failed'].includes(status), 'Use a supported feed status.');
  const fields = ['version', 'source', 'status', 'checkedAt', 'coverage'];
  object(value, status === 'ready' ? [...fields, 'batches'] : status === 'current' ? [...fields, 'cursor'] : fields);
  requireThat(value.version === 1 && value.source === source.source, 'Feed does not match the configured source.');
  const checkedAt = utc(value.checkedAt);
  const coverage = text(value.coverage, 480);
  if (status === 'denied' || status === 'failed') return { status, checkedAt, coverage };
  fresh(checkedAt);
  if (status === 'current') return { status, checkedAt, coverage, cursor: value.cursor === null ? null : id(value.cursor) };
  requireThat(Array.isArray(value.batches) && value.batches.length >= 1 && value.batches.length <= 16,
    'Provide between 1 and 16 contiguous feed batches.');
  const seen = new Set();
  let previous;
  const batches = value.batches.map((entry) => {
    object(entry, ['after', 'cursor', 'through', 'export'], ['rawSha256']);
    const after = entry.after === null ? null : id(entry.after);
    const cursor = id(entry.cursor);
    const through = utc(entry.through);
    requireThat(cursor !== after && !seen.has(cursor)
      && (!previous || (after === previous.cursor && through > previous.through))
      && through <= checkedAt, 'Feed batches must form an ordered chain ending at the verified source coverage.');
    seen.add(cursor);
    const data = bundle(entry.export, source);
    requireThat(data.items.every((item) => item.provenance.observedAt <= through), 'An item falls outside its batch coverage.');
    const batch = { after, cursor, through, data };
    if (Object.hasOwn(entry, 'rawSha256')) {
      requireThat(source.raw && typeof entry.rawSha256 === 'string' && /^[a-f0-9]{64}$/.test(entry.rawSha256),
        'Raw bytes need an explicitly selected chat file and verified digest.');
      batch.rawSha256 = entry.rawSha256;
    }
    previous = batch;
    return { ...batch, digest: hash(json(batch)) };
  });
  requireThat(!seen.has(batches[0].after), 'The feed cursor chain must have a distinct starting point.');
  return { status, checkedAt, coverage, batches };
}

function retainRaw(source, batch, dependencies) {
  if (!batch.rawSha256) return false;
  const { file, directory, expiresAt } = source.raw;
  requireThat(Date.parse(expiresAt) > Date.now(), 'The owner-selected raw retention period has expired.');
  const bytes = selectedFile(file, dependencies, rawLimit);
  requireThat(hash(bytes) === batch.rawSha256, 'The selected raw chat file does not match the approved digest.');
  const folder = outsideGit(directory, dependencies);
  requireThat(lstatSync(folder).isDirectory(), 'Choose an existing private directory for raw retention.');
  const path = join(folder, source.source + '--' + batch.cursor + '--' + expiresAt.replaceAll(':', '-') + '.raw');
  try {
    writeFileSync(path, bytes, { flag: 'wx', mode: 0o600 });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    requireThat(lstatSync(path).isFile() && hash(selectedFile(path, dependencies, rawLimit)) === batch.rawSha256,
      'A different local raw file already exists for this cursor.');
  }
  return true;
}

function receiptRoot(base, source, { pathsAt }) {
  return pathsAt(base).knowledge + '/onboarding/ingestion/' + source.source;
}

function cursorAt(base, source, dependencies) {
  const record = dependencies.readJson(base, receiptRoot(base, source, dependencies) + '/latest.json', true);
  if (record === null) return null;
  requireThat(record.version === 1 && record.source === source.source && record.harness === source.harness
    && record.scope === source.scope, 'The existing cursor belongs to another source policy.');
  id(record.cursor);
  utc(record.through);
  requireThat(typeof record.digest === 'string' && /^[a-f0-9]{64}$/.test(record.digest), 'The stored cursor receipt is invalid.');
  return record;
}

function requireSourceOpen(base, source, { readJson, pathsAt }) {
  const project = source.scope.startsWith('project/') ? source.scope.split('/')[1] : null;
  requireThat(!readJson(base, pathsAt(base).holds).holds.some(({ target }) =>
    target === '*' || target === source.scope || (project && target === project + '/*')), 'A hold blocks this source.');
}

function publishBatch(source, batch, occurrence, rawRetained, route, dependencies) {
  const { publishOnboarding, pending, readJson } = dependencies;
  return pending({ action: 'ingest', source: source.source, cursor: batch.cursor, occurrence,
    digest: batch.digest, summaries: batch.data.items }, () =>
    publishOnboarding('Ingest approved source ' + source.source, (base) => {
      const before = cursorAt(base, source, dependencies);
      const root = receiptRoot(base, source, dependencies);
      const path = root + '/receipts/' + batch.cursor + '.json';
      const accepted = readJson(base, path, true);
      if (accepted) {
        requireThat(accepted.digest === batch.digest && accepted.cursor === batch.cursor
          && accepted.source === source.source, 'An existing ingestion receipt conflicts with this batch.');
        return { files: {}, result: { receipt: accepted, path, status: 'duplicate' } };
      }
      requireThat((before?.cursor ?? null) === batch.after && (!before || batch.through > before.through),
        'The live source cursor changed. Check coverage and refresh the feeder before retrying.');
      requireSourceOpen(base, source, dependencies);
      const records = changes(base, batch.data, dependencies);
      requireThat(records.every(({ action }) => action !== 'conflict'), 'A stable item conflicts with an existing record. Owner review is required.');
      const receipt = { version: 1, source: source.source, harness: source.harness, scope: source.scope, occurrence,
        after: batch.after, cursor: batch.cursor, through: batch.through, digest: batch.digest,
        itemCount: batch.data.items.length, rawRetained };
      const files = Object.fromEntries(records.filter(({ action }) => action === 'add')
        .map(({ path: recordPath, record }) => [recordPath, json(record)]));
      files[path] = json(receipt);
      files[root + '/latest.json'] = files[path];
      return { files, result: { receipt, path, status: 'accepted' } };
    }, route));
}

function runSource(source, occurrence, checkConfig, route, dependencies) {
  const { live, verifyRuntime } = dependencies;
  const base = live({ address: route.address });
  verifyRuntime(base);
  requireSourceOpen(base, source, dependencies);
  const initial = cursorAt(base, source, dependencies);
  let cursor = initial?.cursor ?? null;
  const feedArtifact = artifact(source.feed, dependencies);
  const feed = readFeed(feedArtifact.value, source);
  const report = { source: source.source, cursor, through: initial?.through ?? null, status: feed.status,
    checkedAt: feed.checkedAt, coverage: feed.coverage, receipts: [] };
  if (feed.status === 'denied' || feed.status === 'failed') return report;
  if (feed.status === 'current') return { ...report, status: feed.cursor === cursor ? 'current' : 'gap' };
  const duplicate = feed.batches.find((batch) => batch.cursor === cursor);
  if (duplicate) requireThat(duplicate.digest === initial.digest, 'The feeder changed a previously accepted cursor.');
  const start = feed.batches.findIndex((batch) => batch.after === cursor);
  if (start === -1) {
    return { ...report, status: duplicate && feed.batches.at(-1) === duplicate ? 'duplicate' : 'gap' };
  }
  const checkSource = () => {
    checkConfig();
    fresh(feed.checkedAt);
    requireThat(artifact(source.feed, dependencies).fingerprint === feedArtifact.fingerprint,
      'The approved source feed changed. Recheck permissions and prepare a fresh feed.');
  };
  const selected = feed.batches.slice(start, start + source.maxBatches);
  for (const batch of selected) {
    try {
      checkSource();
      route.checkTarget();
      const rawRetained = retainRaw(source, batch, dependencies);
      const result = publishBatch(source, batch, occurrence, rawRetained, { ...route, checkSource }, dependencies);
      cursor = result.receipt.cursor;
      report.through = result.receipt.through;
      report.receipts.push({ cursor, commit: result.commit, path: result.path, status: result.status });
    } catch (error) {
      return { ...report, cursor, status: error.message.startsWith('Write outcome unknown') ? 'uncertain' : 'failed', reason: error.message };
    }
  }
  const remaining = feed.batches.length - start - selected.length;
  return { ...report, cursor, status: remaining ? 'backlog' : 'accepted', remaining };
}

export function ingestion(action, options, dependencies) {
  const { git, live, verifyRuntime, localPath, writeLocal } = dependencies;
  const allowed = action === 'check' ? ['config'] : ['config', 'occurrence', 'attest'];
  requireThat(['check', 'run'].includes(action) && Object.keys(options).every((key) => allowed.includes(key)),
    'Use ingest check or ingest run. See INGESTION.md.');
  if (action === 'run') requireThat(options.config && options.attest, 'An owner-reviewed source allowlist is required: run ingest check --config and pass its approval code as --attest.');
  const target = privateOrigin(git);
  const route = { address: target.address, checkTarget: () => {
    const current = privateOrigin(git);
    requireThat(current.fingerprint === target.fingerprint && current.address === target.address,
      'The approved ingestion destination changed.');
  } };
  const configPath = options.config ? absolute(options.config) : null;
  const selected = configPath ? artifact(configPath, dependencies) : null;
  const sources = selected ? config(selected.value, target) : [];
  // The approval binds the owner's review to these exact allowlist bytes and this destination, so a literal flag cannot
  // stand in for a review and a changed allowlist needs a new one.
  const approval = selected ? hash(JSON.stringify({ target: target.fingerprint, config: selected.fingerprint })) : null;
  if (action === 'run') requireThat(options.attest === approval,
    'The approval code does not match this allowlist and destination. Run ingest check --config, review the sources, and pass its approval code as --attest.');
  const lock = join(git(['rev-parse', '--path-format=absolute', '--git-common-dir']), 'hars-mem', 'ingestion.lock');
  if (action === 'check') {
    const commit = live({ address: target.address });
    verifyRuntime(commit);
    return { target: target.fingerprint, commit, locked: existsSync(lock), lock, ...(approval ? { approval } : {}),
      sources: sources.map((source) => {
        try { return { source: source.source, cursor: cursorAt(commit, source, dependencies) }; }
        catch { return { source: source.source, status: 'invalid-cursor' }; }
      }) };
  }
  const occurrence = utc(options.occurrence ?? new Date().toISOString());
  requireThat(Date.parse(occurrence) <= Date.now() + 5 * 60_000, 'Use a scheduled occurrence at or before the present.');
  const checkConfig = () => requireThat(artifact(configPath, dependencies).fingerprint === selected.fingerprint,
    'The source allowlist changed. Start a new owner-reviewed run.');
  try {
    writeLocal(lock, { pid: process.pid, occurrence });
  } catch (error) {
    if (error.code === 'EEXIST') return { occurrence, status: 'overlap', lock };
    throw error;
  }
  try {
    const reports = sources.map((source) => {
      try {
        checkConfig();
        route.checkTarget();
        return runSource(source, occurrence, checkConfig, route, dependencies);
      } catch (error) {
        return { source: source.source, status: 'failed', reason: error.message, receipts: [] };
      }
    });
    const report = { occurrence, target: target.fingerprint,
      status: reports.every(({ status }) => ['accepted', 'current', 'duplicate'].includes(status)) ? 'ok' : 'attention',
      sources: reports };
    const path = localPath('ingestion', 'occurrences', occurrence.replaceAll(':', '-') + '-' + randomUUID() + '.json');
    writeLocal(path, report);
    return { ...report, path };
  } finally {
    unlinkSync(lock);
  }
}
