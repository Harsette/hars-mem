import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';

const [directory, target, phase, chat] = process.argv.slice(2);
if (!directory || !isAbsolute(directory) || !target || !['cold', 'replay'].includes(phase)
  || (chat && chat !== 'with-chat')) {
  throw new Error('Use an absolute disposable directory, the ingest check target, and cold or replay, optionally with-chat.');
}

mkdirSync(directory, { recursive: true });
const configPath = join(directory, 'synthetic-config.json');
const checkedAt = new Date().toISOString();
const scope = 'project/field-guide';
const makeSource = (id, harness, type) => ({
  id, harness, scope, type, kinds: ['memory'], feed: join(directory, id + '.json'), maxBatches: 2,
});
const connector = makeSource('synthetic-connector', 'example-connector', 'connector');
const restricted = makeSource('synthetic-denied', 'example-connector', 'connector');
const sources = [connector, restricted];
function write(file, value) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    renameSync(temporary, file);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}
const through = (number) => '2020-01-0' + number + 'T00:00:00Z';
function batch(source, number, summary) {
  const cursor = 'sample-' + number;
  return { after: number === 1 ? null : 'sample-' + (number - 1), cursor, through: through(number), export: {
    version: 1, source: { id: source.id, harness: source.harness, scope, revision: cursor,
      coverage: 'One synthetic sample at ' + cursor, exportedAt: through(number) },
    items: [{ id: cursor, kind: 'memory', title: 'Synthetic source observation', summary, observedAt: through(number),
      author: 'Example operator', sourceRef: cursor, certainty: 'stated', pointer: 'https://example.invalid/field-guide/' + cursor }],
  } };
}

const count = phase === 'cold' ? 1 : 4;
write(connector.feed, { version: 1, source: connector.id, status: 'ready', checkedAt,
  coverage: 'Synthetic connector returned samples 1 through ' + count,
  batches: Array.from({ length: count }, (_, index) =>
    batch(connector, index + 1, 'The synthetic station observed sample ' + (index + 1) + '.')) });
write(restricted.feed, { version: 1, source: restricted.id, status: 'denied', checkedAt,
  coverage: 'The selected restricted fixture denied read access.' });

if (chat === 'with-chat') {
  const selected = makeSource('synthetic-chat', 'selected-export', 'selected-chat');
  const raw = Buffer.from('Synthetic chat transcript fixture. Keep these raw bytes local.\n');
  selected.raw = { file: join(directory, 'selected-chat.txt'), directory: join(directory, 'retained'),
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString() };
  mkdirSync(selected.raw.directory, { recursive: true });
  writeFileSync(selected.raw.file, raw);
  write(selected.feed, { version: 1, source: selected.id, status: 'ready', checkedAt,
    coverage: 'One owner-selected synthetic chat export.',
    batches: [{ ...batch(selected, 1, 'The selected synthetic chat recorded a field-guide follow-up.'),
      rawSha256: createHash('sha256').update(raw).digest('hex') }] });
  sources.push(selected);
}
if (!existsSync(configPath)) write(configPath, { version: 1, target, sources });
process.stdout.write(configPath + '\n');
