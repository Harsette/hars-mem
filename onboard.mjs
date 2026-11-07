import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fstatSync, openSync, readFileSync, readdirSync, readSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative } from 'node:path';
import { privateOrigin } from './store.mjs';

const sections = {
  skills: 'Which skills and workflows should carry over?',
  prompts: 'Which prompts are worth keeping, and who maintains them?',
  threads: 'Which conversations contain decisions, useful memory, or open work?',
  tools: 'Which tools and connectors are in use, and who approves their access?',
  data: 'Where does the data live, and what may this workspace read or retain?',
  authority: 'For each domain, which owner and system settle conflicting claims?',
};
const kinds = ['skill', 'prompt', 'decision', 'memory', 'open-work', 'pointer', 'authority'];
const idPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const maxBytes = 128 * 1024;
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const digest = (value) => hash(json(value));

function requireThat(condition, message) {
  if (!condition) throw new Error(message);
}

function object(value, required, optional = []) {
  requireThat(value && typeof value === 'object' && !Array.isArray(value)
    && required.every((key) => Object.hasOwn(value, key))
    && Object.keys(value).every((key) => required.includes(key) || optional.includes(key)),
  'The selected file does not match the onboarding JSON template.');
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { throw new Error('Use one valid JSON document from the onboarding template.'); }
}

function redact(text) {
  return text
    .replace(/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z0-9 ]*PRIVATE KEY-----/gi, '[REDACTED]')
    .replace(/\b(?:Bearer|Basic)\s+[A-Za-z0-9+/_.=~%-]{8,}/gi, '[REDACTED]')
    .replace(/\b(?:gh[pousr]_[a-z0-9]{12,}|github_pat_[a-z0-9_]{12,}|glpat-[a-z0-9_-]{12,}|sk[-_][a-z0-9_-]{12,}|xox[a-z]-[a-z0-9-]{12,}|(?:AKIA|ASIA)[A-Z0-9]{16}|AIza[a-z0-9_-]{20,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi, '[REDACTED]')
    .replace(/\b(?:api[ _-]?key|access[ _-]?token|refresh[ _-]?token|secret|password|passwd|token)\s*[:=]\s*(?:"[^"\n]*"|'[^'\n]*'|[^\s,;]+)/gi, '[REDACTED]')
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s/<>"']+@[^\s<>"']+/gi, '[REDACTED]')
    .replace(/\bhttps?:\/\/[^\s<>"']*[?#][^\s<>"']*/gi, '[REDACTED]');
}

function text(value, limit) {
  requireThat(typeof value === 'string' && value.trim() && value.length <= limit
    && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufffd\p{Surrogate}]/u.test(value),
  'Use concise plain-text fields without control characters.');
  const clean = redact(value.trim().replace(/\r\n?/g, '\n'));
  requireThat(!/PRIVATE KEY-----/i.test(clean), 'Remove incomplete key material before previewing.');
  requireThat(!/<\/?(?:system|developer)>|(?:^|\n)\s*(?:(?:system|developer) (?:message|prompt|instructions)|private platform instructions)\s*:/i.test(clean),
    'Remove private platform instructions before previewing.');
  return clean;
}

function id(value) {
  requireThat(typeof value === 'string' && idPattern.test(value) && value === redact(value)
    && !/^(?:con|prn|aux|nul|com[0-9]|lpt[0-9])$/.test(value),
    'Use a stable lowercase ID of up to 64 letters, digits, and dashes.');
  return value;
}

function utc(value) {
  requireThat(typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value)), 'Use valid UTC timestamps such as 2026-01-20T09:00:00Z.');
  const canonical = new Date(value).toISOString();
  requireThat(canonical === value.replace(/(?<!\.\d{3})Z$/, '.000Z'), 'Use a valid calendar date and UTC time.');
  return canonical;
}

function pointer(value) {
  requireThat(typeof value === 'string' && value.length <= 512 && /^https:\/\/[\x21-\x7e]+$/.test(value),
    'Use a credential-free HTTPS pointer without a query or fragment.');
  let url;
  try { url = new URL(value); } catch { /* Report the same error without echoing the input. */ }
  const decoded = decodePointer(value);
  requireThat(url?.protocol === 'https:' && url.hostname && !url.username && !url.password
    && !/[?#\\]/.test(value) && value === redact(value) && decoded === redact(decoded),
  'Use a credential-free HTTPS pointer without a query or fragment.');
  return url.href;
}

function decodePointer(value) {
  try { return decodeURIComponent(value); } catch { throw new Error('Use a valid HTTPS pointer.'); }
}

function contains(parent, child) {
  const path = relative(parent, child);
  return !isAbsolute(path) && !/^\.\.(?:[\\/]|$)/.test(path);
}

function outsideGit(file, { git }) {
  requireThat(file, 'Select one local file or folder.');
  let path;
  try { path = realpathSync(file); } catch { throw new Error('Choose an existing local JSON file.'); }
  requireThat(!/[\\/]\.git(?:[\\/]|$)/i.test(path) && !/^(?:\\\\|\/\/)/.test(path)
    && !contains(realpathSync(git(['rev-parse', '--show-toplevel'])), path)
    && git(['-C', statSync(path).isDirectory() ? path : dirname(path), 'rev-parse', '--git-dir'], { optional: true }) === null,
  'Keep the selected artifact in an owner-controlled local folder outside Git.');
  return path;
}

function selectedFile(file, dependencies, limit) {
  const path = outsideGit(file, dependencies);
  let fd;
  try {
    requireThat(statSync(path).isFile(), 'Use a regular local file.');
    fd = openSync(path, 'r');
    const stat = fstatSync(fd);
    requireThat(stat.isFile() && stat.size > 0 && stat.size <= limit, 'Use a small regular file.');
    const bytes = Buffer.alloc(limit + 1);
    let size = 0;
    for (let count; (count = readSync(fd, bytes, size, bytes.length - size, null)) > 0;) size += count;
    requireThat(size === stat.size, 'The selected file changed while it was read.');
    return bytes.subarray(0, size);
  } catch {
    throw new Error('Use a readable regular file within the size limit in an owner-controlled local folder.');
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function artifact(file, dependencies) {
  const bytes = selectedFile(file, dependencies, maxBytes);
  let body;
  try { body = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('Use a UTF-8 JSON file.'); }
  const fingerprint = hash(bytes);
  return { fingerprint, value: parseJson(body) };
}

function bundle(value, authorization) {
  object(value, ['version', 'source', 'items']);
  object(value.source, ['id', 'harness', 'scope', 'revision', 'coverage', 'exportedAt']);
  const source = value.source;
  const exportedAt = utc(source.exportedAt);
  const revision = text(source.revision, 160);
  const coverage = text(source.coverage, 480);
  requireThat(source.id === authorization.source && source.harness === authorization.harness
    && source.scope === authorization.scope, 'The selected export does not match the authorized source, harness, and scope.');
  requireThat(value.version === 1 && Array.isArray(value.items) && value.items.length > 0 && value.items.length <= 50,
    'Use version 1 and between 1 and 50 scoped items.');
  const seen = new Set();
  const domains = new Set();
  const items = value.items.map((item) => {
    object(item, ['id', 'kind', 'title', 'summary', 'observedAt', 'author', 'sourceRef', 'certainty'], ['pointer', 'authority']);
    const itemId = id(item.id);
    requireThat(!seen.has(itemId) && authorization.kinds.includes(item.kind), 'Use unique item IDs and only authorized kinds.');
    seen.add(itemId);
    const observedAt = utc(item.observedAt);
    requireThat(observedAt <= exportedAt, 'An item observation must be at or before the export timestamp.');
    requireThat(['stated', 'inferred', 'unknown'].includes(item.certainty), 'Use stated, inferred, or unknown for certainty.');
    const record = {
      version: 1, sourceId: source.id, itemId, kind: item.kind,
      treatment: 'reference-data', title: text(item.title, 160), summary: text(item.summary, 2400),
      provenance: { harness: source.harness, scope: source.scope, revision, coverage, observedAt, exportedAt,
        author: text(item.author, 160), sourceRef: text(item.sourceRef, 240), certainty: item.certainty },
    };
    if (Object.hasOwn(item, 'pointer')) record.pointer = pointer(item.pointer);
    requireThat(item.kind !== 'pointer' || record.pointer, 'A pointer item needs a safe HTTPS URL.');
    if (item.kind === 'authority') {
      object(item.authority, ['domain', 'system', 'owner']);
      requireThat(item.certainty === 'stated', 'Authority choices need a stated owner decision.');
      const domain = id(item.authority.domain);
      requireThat(!domains.has(domain), 'Choose one authority per domain in this preview.');
      domains.add(domain);
      record.authority = { domain, system: text(item.authority.system, 160), owner: text(item.authority.owner, 160) };
    } else {
      requireThat(!Object.hasOwn(item, 'authority'), 'An authority field belongs on an authority item.');
    }
    return record;
  });
  return { source: { version: 1, id: source.id, harness: source.harness, scope: source.scope }, items };
}

function comparable(record) {
  if (!record?.provenance) return record;
  const { exportedAt, ...provenance } = record.provenance;
  return { ...record, provenance };
}

function changes(base, data, { git, pathsAt, read }) {
  const root = pathsAt(base).knowledge + '/onboarding';
  const source = data.source.id;
  const records = [[root + '/sources/' + source + '.json', data.source]];
  for (const item of data.items) {
    const path = root + '/items/' + source + '/' + item.itemId + '.json';
    records.push([path, item]);
    if (item.authority) records.push([root + '/authority/' + item.authority.domain + '.json', {
      version: 1, sourceId: source, itemId: item.itemId, path,
    }]);
  }
  const directories = new Map();
  return records.map(([path, record]) => {
    for (let parent = dirname(path).replaceAll('\\', '/'); parent !== '.'; parent = dirname(parent).replaceAll('\\', '/')) {
      if (!directories.has(parent)) directories.set(parent, git(['ls-tree', base, '--', parent]).split(' ')[0]);
      if (directories.get(parent) && directories.get(parent) !== '040000') return { path, action: 'conflict', record };
    }
    const mode = git(['ls-tree', base, '--', path]).split(' ')[0];
    if (!mode) return { path, action: 'add', record };
    let existing;
    if (mode === '100644') {
      try { existing = JSON.parse(read(base, path)); } catch { /* Keep an invalid existing record as a conflict. */ }
    }
    const action = existing && digest(comparable(record)) === digest(comparable(existing)) ? 'duplicate' : 'conflict';
    return { path, action, record };
  });
}

function scope(value) {
  requireThat(typeof value === 'string' && value.length <= 120 && value.split('/').length <= 3,
    'Use a scoped identifier such as project/field-guide.');
  return value.split('/').map(id).join('/');
}

function localJson(path) {
  requireThat(existsSync(path), 'The local onboarding session or preview was not found in this checkout.');
  return parseJson(readFileSync(path, 'utf8'));
}

function list(path) {
  return existsSync(path) ? readdirSync(path).filter((name) => name.endsWith('.json')).map((name) => name.slice(0, -5)) : [];
}

export function onboarding(action, options, dependencies) {
  const { git, live, verifyRuntime, localPath, writeLocal, publishOnboarding, pending, ancestor, pathsAt, readJson } = dependencies;
  const allowed = {
    start: ['attest'],
    status: ['session'],
    inventory: ['session', 'section', 'file', 'skip'],
    preview: ['session', 'authorize', 'harness', 'scope', 'kinds', 'file', 'attest'],
    apply: ['session', 'approve', 'file', 'attest'],
  };
  requireThat(Object.hasOwn(allowed, action) && Object.keys(options).every((key) => allowed[action].includes(key)),
    'Use onboard start, status, inventory, preview, or apply. See ONBOARDING.md.');
  if (['start', 'preview', 'apply'].includes(action)) {
    requireThat(options.attest === 'owner-reviewed',
      'Current owner review is required. Check destination readers and source rights as described in ONBOARDING.md.');
  }
  const target = privateOrigin(git);
  if (action === 'start') {
    const base = live({ address: target.address });
    verifyRuntime(base);
    const session = randomUUID();
    writeLocal(localPath('onboarding', session, 'session.json'), { target });
    return { session, target: target.identity, base, sections };
  }
  const session = options.session;
  requireThat(uuidPattern.test(session ?? ''), 'Use --session with the ID returned by onboard start.');
  const home = (...parts) => localPath('onboarding', session, ...parts);
  const saved = localJson(home('session.json'));
  const matchTarget = (current) => {
    requireThat(digest(current) === digest(saved.target), 'The target changed. Start again in the verified private destination.');
  };
  matchTarget(target);
  if (action === 'status') {
    const answers = list(home('inventory'));
    return { session, target: target.identity, inventory: Object.fromEntries(Object.entries(sections)
      .map(([section, question]) => [section, { question, answer: answers.includes(section)
        ? localJson(home('inventory', section + '.json')).answer : null }])),
    previews: list(home('previews')) };
  }
  if (action === 'inventory') {
    const { section } = options;
    requireThat(Object.hasOwn(sections, section) && Boolean(options.file) !== (options.skip === 'yes')
      && (!options.skip || options.skip === 'yes'), 'Choose a section and provide either --file or --skip yes.');
    const value = options.file ? artifact(options.file, dependencies).value : 'skipped';
    requireThat(!options.file || Array.isArray(value) && value.length > 0 && value.length <= 25,
      'Inventory answers are JSON arrays of up to 25 concise strings.');
    const answer = options.file ? value.map((line) => text(line, 480)) : value;
    const path = home('inventory', section + '.json');
    if (!existsSync(path)) writeLocal(path, { answer });
    requireThat(digest(localJson(path).answer) === digest(answer), 'This section is already recorded. Start a new session to replace it.');
    return { session, section, answer };
  }
  if (action === 'preview') {
    const authorization = {
      source: id(options.authorize), harness: id(options.harness), scope: scope(options.scope),
      kinds: [...new Set((options.kinds ?? '').split(','))].sort(),
    };
    requireThat(authorization.kinds.every((kind) => kinds.includes(kind)), 'Choose authorized kinds from ONBOARDING.md.');
    const base = live({ address: target.address });
    verifyRuntime(base);
    const { value, fingerprint } = artifact(options.file, dependencies);
    const data = bundle(value, authorization);
    const plan = { session, target, base, authorization, fingerprint, records: changes(base, data, dependencies) };
    const approval = digest(plan);
    const path = home('previews', approval + '.json');
    if (!existsSync(path)) writeLocal(path, plan);
    return { approval, ...plan, canApply: plan.records.every(({ action }) => action !== 'conflict') };
  }
  const approval = options.approve;
  requireThat(digestPattern.test(approval ?? ''), 'Use --approve with the exact owner-reviewed preview code.');
  const plan = localJson(home('previews', approval + '.json'));
  requireThat(digest(plan) === approval && plan.session === session, 'The preview changed. Prepare and review it again.');
  matchTarget(plan.target);
  requireThat(plan.records.every(({ action }) => action !== 'conflict'), 'Resolve preview conflicts before approving.');
  const checkSource = () => {
    const selected = artifact(options.file, dependencies);
    requireThat(selected.fingerprint === plan.fingerprint, 'The source artifact changed. Prepare and review a new preview.');
    return selected.value;
  };
  const data = bundle(checkSource(), plan.authorization);
  const route = { address: target.address, checkSource, checkTarget: () => matchTarget(privateOrigin(git)) };
  return pending({ action: 'onboard-apply', session, approval, target: target.identity }, () =>
    publishOnboarding('Import approved onboarding records', (base) => {
      requireThat(ancestor(plan.base, base), 'The store history changed. Prepare and review a new preview.');
      const current = changes(base, data, dependencies);
      const paths = current.map(({ path }) => path);
      requireThat(digest(paths) === digest(plan.records.map(({ path }) => path)), 'The storage layout changed. Prepare a new preview.');
      if (current.every(({ action }) => action === 'duplicate')) {
        return { files: {}, result: { approval, paths, status: 'already-imported' } };
      }
      requireThat(base === plan.base && digest(current) === digest(plan.records),
        'Main changed after preview. Prepare and review a new preview.');
      requireThat(!readJson(base, pathsAt(base).holds).holds.some(({ target }) => target === '*'),
        'A workspace-wide hold blocks onboarding writes.');
      const files = Object.fromEntries(current.filter(({ action }) => action === 'add').map(({ path, record }) => [path, json(record)]));
      return { files, result: { approval, paths, status: 'imported' } };
    }, route));
}

export { artifact, bundle, changes, id, object, outsideGit, scope, selectedFile, text, utc };
