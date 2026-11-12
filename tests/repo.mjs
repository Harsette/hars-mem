// Repo hygiene that runs in seconds: every skill parses, every relative link resolves, and nothing personal or
// secret sits in the public tree. These are the checks whose absence let a brain drift without anyone noticing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);

test('every skill has frontmatter a strict YAML parser accepts, named after its folder', () => {
  for (const dir of readdirSync(join(root, 'skills'))) {
    const file = join(root, 'skills', dir, 'SKILL.md');
    if (!existsSync(file)) continue;
    const match = readFileSync(file, 'utf8').match(/^---\n([\s\S]*?)\n---\n/);
    assert.ok(match, `${dir}: no frontmatter block`);
    const fields = {};
    for (const line of match[1].split('\n')) {
      const pair = line.match(/^([a-z_-]+):\s*(.*)$/);
      assert.ok(pair, `${dir}: unparseable frontmatter line "${line}"`);
      const value = pair[2];
      const quoted = /^(["']).*\1$/.test(value);
      // Unquoted values that YAML reads as something else: a second "key: value", a comment, or a flow/anchor marker.
      assert.ok(quoted || !/(:\s|\s#)|^[\[{&*!|>%@`]/.test(value), `${dir}: quote the ${pair[1]} value`);
      fields[pair[1]] = value.replace(/^(["'])(.*)\1$/, '$2');
    }
    assert.equal(fields.name, dir, `${dir}: name must match the folder`);
    assert.ok(fields.description && fields.description.length <= 300, `${dir}: description missing or over 300 characters`);
  }
});

test('every relative link in the docs points at a file that exists', () => {
  for (const file of tracked.filter((path) => path.endsWith('.md'))) {
    const text = readFileSync(join(root, file), 'utf8').replace(/~~~[\s\S]*?~~~|```[\s\S]*?```/g, '');
    for (const [, target] of text.matchAll(/\]\(([^)\s]+)\)/g)) {
      if (/^(https?:|mailto:|#)/.test(target)) continue;
      const path = decodeURIComponent(target.split('#')[0]);
      assert.ok(existsSync(join(root, dirname(file), path)), `${file}: dead link ${target}`);
    }
  }
});

test('the public tree carries no personal email, key or token', () => {
  const allowedMail = /(@example\.(com|org|net)|\.(example|invalid|test)|@users\.noreply\.github\.com)$/i;  // reserved names only
  const secrets = [/gh[pousr]_[A-Za-z0-9]{30,}/, /sk-[A-Za-z0-9_-]{20,}/, /AKIA[0-9A-Z]{16}/, /xox[abprs]-[A-Za-z0-9-]{10,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{35}/];
  for (const file of tracked) {
    const text = readFileSync(join(root, file), 'utf8');
    for (const [mail] of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g)) {
      assert.ok(allowedMail.test(mail), `${file}: personal email ${mail}`);
    }
    for (const shape of secrets) assert.ok(!shape.test(text), `${file}: matches a secret shape ${shape}`);
  }
});
