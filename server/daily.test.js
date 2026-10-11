import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentDailyUpdate } from './daily.js';
import { NEWS_SECTIONS } from '../src/newsSections.js';

test('daily stream drops articles outside the rolling 24-hour window', () => {
  const now = Date.parse('2026-10-09T22:00:00Z');
  const snapshot = {
    articles: [
      { sourceId: 'recent', sourceName: 'Recent News', publishedAt: '2026-10-09T21:00:00Z' },
      { sourceId: 'old', sourceName: 'Old News', publishedAt: '2026-10-08T21:59:59Z' }
    ],
    sourceOutcomes: [
      { id: 'recent', name: 'Recent News', status: 'collected' },
      { id: 'old', name: 'Old News', status: 'collected' }
    ]
  };
  const update = currentDailyUpdate(snapshot, now);
  assert.equal(update.articles.length, 1);
  assert.equal(update.sourceOutcomes[1].status, 'no selected article remains in the current 24-hour window');
});

test('a 48-hour update keeps articles inside its stated window', () => {
  const now = Date.parse('2026-10-11T12:00:00Z');
  const snapshot = {
    windowHours: 48,
    articles: [
      { sourceId: 'inside', publishedAt: '2026-10-09T13:00:00Z' },
      { sourceId: 'outside', publishedAt: '2026-10-09T11:59:00Z' }
    ],
    sourceOutcomes: []
  };
  assert.deepEqual(currentDailyUpdate(snapshot, now).articles.map(item => item.sourceId), ['inside']);
});

test('prepared 48-hour edition follows the regional placement rules', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-11.json', import.meta.url), 'utf8'));
  const checked = Date.parse(update.checkedAt);
  const allowed = new Map(NEWS_SECTIONS.map(section => [section.id, new Set(section.subsections)]));
  assert.equal(update.windowHours, 48);
  assert.ok(update.articles.length > 0);
  for (const article of update.articles) {
    const published = Date.parse(article.publishedAt);
    assert.ok(published >= checked - 48 * 60 * 60 * 1000 && published <= checked, article.title);
    assert.ok(allowed.get(article.section)?.has(article.subsection), article.title);
    if (article.section === 'Lead stories' && article.subsection === 'Ukraine') assert.equal(article.sourceName, 'Reuters');
  }
});
