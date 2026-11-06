import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

function keyOf(document) {
  return (document.path + '\n' + document.body).toLowerCase();
}

function withExcerpt(document, query) {
  const start = Math.max(0, document.body.toLowerCase().indexOf(query) - 60);
  return { path: document.path, excerpt: document.body.slice(start, start + 260).trim() };
}

async function searchSqlite({ path, commit, load, query }) {
  const { DatabaseSync } = await import('node:sqlite');
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  try {
    db.exec('PRAGMA busy_timeout=3000; CREATE TABLE IF NOT EXISTS index_head (sha TEXT PRIMARY KEY);'
      + ' CREATE TABLE IF NOT EXISTS documents (path TEXT PRIMARY KEY, body TEXT, search TEXT);');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (db.prepare('SELECT sha FROM index_head').get()?.sha !== commit) {
        db.exec('DELETE FROM documents; DELETE FROM index_head;');
        const add = db.prepare('INSERT INTO documents VALUES (?, ?, ?)');
        for (const document of load()) add.run(document.path, document.body, keyOf(document));
        db.prepare('INSERT INTO index_head VALUES (?)').run(commit);
      }
      const results = db.prepare('SELECT path, body FROM documents WHERE instr(search, ?) > 0 ORDER BY path LIMIT 20').all(query);
      db.exec('COMMIT');
      return results;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  } finally {
    db.close();
  }
}

export async function recall({ path, commit, load, query, backend = 'auto' }) {
  const needle = query.toLowerCase();
  if (backend !== 'git') {
    try {
      const records = await searchSqlite({ path, commit, load, query: needle });
      return { commit, backend: 'sqlite', results: records.map((row) => withExcerpt(row, needle)) };
    } catch (error) {
      if (backend === 'sqlite') throw error;
    }
  }
  const records = load().filter((row) => keyOf(row).includes(needle)).slice(0, 20);
  return { commit, backend: 'git', results: records.map((row) => withExcerpt(row, needle)) };
}
