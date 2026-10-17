import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArticleCache } from '../server/articleCache.js';

test('article pages and extracted stories survive a new collection process', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dnu-article-cache-'));
  try {
    const path = join(directory, 'articles.jsonl');
    const first = createArticleCache(path);
    const url = 'https://example.com/article?utm_source=listing';
    const page = { data: { markdown: 'An original article', json: { title: 'Security talks' } } };
    const article = { url, title: 'Security talks', publishedAt: '2026-10-17T12:00:00Z' };
    first.putPage(url, page.data);
    first.putArticle(url, article);
    const second = createArticleCache(path);
    assert.deepEqual(second.get('https://example.com/article').page, page.data);
    assert.deepEqual(second.get(url).article, article);
    assert.equal(second.get(url).failedAt, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('failed page attempts wait before they can be retried', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dnu-article-cache-'));
  try {
    const path = join(directory, 'articles.jsonl');
    createArticleCache(path).putFailure('https://example.com/missing');
    const entry = createArticleCache(path).get('https://example.com/missing');
    assert.ok(entry.retryAfter > Date.now() + 5 * 60 * 60 * 1000);
    assert.equal(entry.page, null);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
