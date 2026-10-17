import test from 'node:test';
import assert from 'node:assert/strict';
import { carryForwardArticles } from '../server/updateCarryForward.js';

test('a second scan keeps previously selected in-window stories and drops expired stories', () => {
  const old = { url: 'https://example.org/old', sourceId: 'agency', publishedAt: '2026-10-16T11:59:59Z', title: 'Expired' };
  const kept = { url: 'https://example.org/kept', sourceId: 'agency', publishedAt: '2026-10-16T12:30:00Z', title: 'Reviewed headline' };
  const refreshed = { url: 'https://example.org/kept?utm_source=feed', sourceId: 'agency', publishedAt: kept.publishedAt, title: 'Raw headline' };
  const added = { url: 'https://example.org/new', sourceId: 'agency', publishedAt: '2026-10-17T11:00:00Z', title: 'New' };
  const result = carryForwardArticles([refreshed, added], [old, kept], '2026-10-16T12:00:00Z', '2026-10-17T12:00:00Z', new Set(['agency']));
  assert.deepEqual(result.map(article => article.title), ['Reviewed headline', 'New']);
});

test('carry-forward excludes unknown outlets and stories at the window end', () => {
  const articles = [
    { url: 'https://example.org/a', sourceId: 'removed', publishedAt: '2026-10-17T11:00:00Z' },
    { url: 'https://example.org/b', sourceId: 'agency', publishedAt: '2026-10-17T12:00:00Z' }
  ];
  assert.deepEqual(carryForwardArticles([], articles, '2026-10-16T12:00:00Z', '2026-10-17T12:00:00Z', new Set(['agency'])), []);
});
