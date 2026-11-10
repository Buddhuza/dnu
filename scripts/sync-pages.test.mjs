import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncPagesBuild } from './sync-pages.mjs';

test('Pages sync keeps hashed modules required by open browser sessions', () => {
  const root = mkdtempSync(join(tmpdir(), 'dnu-pages-sync-'));
  try {
    const build = join(root, 'dist'), pages = join(root, 'pages');
    mkdirSync(join(build, 'assets'), { recursive: true });
    mkdirSync(join(pages, 'assets'), { recursive: true });
    writeFileSync(join(build, 'index.html'), 'new page');
    writeFileSync(join(build, 'article-bodies.json'), '{}');
    writeFileSync(join(build, 'assets', 'importClient-new.js'), 'new module');
    writeFileSync(join(pages, '.git'), 'gitdir: elsewhere');
    writeFileSync(join(pages, 'assets', 'importClient-old.js'), 'old module');
    syncPagesBuild(build, pages);
    assert.equal(readFileSync(join(pages, 'index.html'), 'utf8'), 'new page');
    assert.equal(readFileSync(join(pages, 'assets', 'importClient-new.js'), 'utf8'), 'new module');
    assert.equal(readFileSync(join(pages, 'assets', 'importClient-old.js'), 'utf8'), 'old module');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('Pages sync retains earlier public article bodies while adding the new edition', () => {
  const root = mkdtempSync(join(tmpdir(), 'dnu-pages-bodies-'));
  try {
    const build = join(root, 'dist'), pages = join(root, 'pages');
    mkdirSync(build); mkdirSync(pages);
    writeFileSync(join(build, 'index.html'), 'new page');
    writeFileSync(join(build, 'article-bodies.json'), JSON.stringify({ editionCheckedAt: 'new', articles: { new: { body: 'new body' } } }));
    writeFileSync(join(pages, '.git'), 'gitdir: elsewhere');
    writeFileSync(join(pages, 'article-bodies.json'), JSON.stringify({ editionCheckedAt: 'old', articles: { old: { body: 'old body' } } }));
    syncPagesBuild(build, pages);
    const snapshot = JSON.parse(readFileSync(join(pages, 'article-bodies.json'), 'utf8'));
    assert.equal(snapshot.editionCheckedAt, 'new');
    assert.deepEqual(Object.keys(snapshot.articles).sort(), ['new', 'old']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
