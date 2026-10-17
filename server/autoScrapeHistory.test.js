import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAutoScrapeHistory } from './autoScrapeHistory.js';

test('automatic batches claim an article once, including across processes', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dnu-scrape-history-'));
  try {
    const path = join(directory, 'history.jsonl');
    const first = createAutoScrapeHistory(path);
    const second = createAutoScrapeHistory(path);
    const article = { url: 'https://www.example.com/story?utm_source=feed', title: 'Leaders agree on border talks' };
    const claims = await Promise.all([first.claim(article, { batchId: 'batch-1', sourceId: 'publisher' }), second.claim(article, { batchId: 'batch-2', sourceId: 'publisher' })]);
    assert.equal(claims.filter(claim => claim.claimed).length, 1);
    const restarted = createAutoScrapeHistory(path);
    assert.equal(restarted.reason({ url: 'https://example.com/story/', title: 'Different listing title' }), 'same URL');
    assert.equal(restarted.reason({ url: 'https://other.example/new-story', title: 'Leaders agree on border talks!' }, 'publisher'), 'same headline');
    assert.equal(restarted.reason({ url: 'https://other.example/new-story', title: 'Leaders agree on border talks!' }, 'different-outlet'), null);
    assert.equal((await restarted.claim(article, { batchId: 'batch-3' })).claimed, false);
    assert.equal((await restarted.claim(article, { batchId: 'manual-review', force: true })).claimed, true);
    assert.equal(readFileSync(path, 'utf8').trim().split('\n').length, 1);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
