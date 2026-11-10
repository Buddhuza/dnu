import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCompletedEdition, storedArticle, storedBody } from './nativeEdition.js';

test('completed edition is read afresh and supplies its stored article body', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dnu-native-'));
  const path = join(directory, 'edition.json');
  const article = { id: 'a', title: 'First', url: 'https://example.com/a', body: 'The full first article body is stored in the completed edition.', publishedAt: '2026-11-10T09:00:00Z' };
  const snapshot = articles => ({ checkedAt: '2026-11-10T10:00:00Z', windowStart: '2026-11-09T10:00:00Z', windowEnd: '2026-11-10T10:00:00Z', articles, sourceOutcomes: [] });
  try {
    writeFileSync(path, JSON.stringify(snapshot([article])));
    assert.equal(readCompletedEdition(path).articles[0].title, 'First');
    writeFileSync(path, JSON.stringify(snapshot([{ ...article, title: 'Second', body: 'A second article body was written after the server started.' }])));
    const fresh = readCompletedEdition(path);
    assert.equal(fresh.articles[0].title, 'Second');
    assert.equal(storedArticle(fresh, article.url).title, 'Second');
    assert.match(storedBody(fresh.articles[0]).body, /written after/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
