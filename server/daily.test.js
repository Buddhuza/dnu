import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { currentDailyUpdate } from './daily.js';
import { NEWS_SECTIONS } from '../src/newsSections.js';
import { passesSourcePolicy } from './editorialPolicy.js';

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

test('a retrospective 36-hour edition stays available after Thursday', () => {
  const snapshot = {
    windowHours: 36,
    windowStart: '2026-10-07T09:59:59Z',
    windowEnd: '2026-10-08T21:59:59Z',
    articles: [
      { publishedAt: '2026-10-08T15:00:00Z' },
      { publishedAt: '2026-10-09T00:00:00Z' }
    ],
    sourceOutcomes: []
  };
  assert.equal(currentDailyUpdate(snapshot, Date.parse('2026-10-11T12:00:00Z')).articles.length, 1);
});

test('prepared Thursday edition covers only its fixed 36-hour window and follows regional placement', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-08.json', import.meta.url), 'utf8'));
  const start = Date.parse(update.windowStart);
  const end = Date.parse(update.windowEnd);
  const allowed = new Map(NEWS_SECTIONS.map(section => [section.id, new Set(section.subsections)]));
  assert.equal(update.windowHours, 36);
  assert.equal(end - start, 36 * 60 * 60 * 1000 - 1000);
  assert.ok(update.articles.length > 0);
  for (const article of update.articles) {
    const published = Date.parse(article.publishedAt);
    assert.ok(published >= start && published <= end, article.title);
    assert.ok(allowed.get(article.section)?.has(article.subsection), article.title);
    if (article.section === 'Lead stories' && article.subsection === 'Ukraine') assert.equal(article.sourceName, 'Reuters');
  }
});

test('prepared Monday–Friday edition covers its fixed window and uses country or organisation labels in Miscellaneous', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-05-09.json', import.meta.url), 'utf8'));
  const start = Date.parse(update.windowStart);
  const end = Date.parse(update.windowEnd);
  const allowed = new Map(NEWS_SECTIONS.map(section => [section.id, new Set(section.subsections)]));
  assert.equal(update.windowHours, 120);
  assert.equal(start, Date.parse('2026-10-04T22:00:00Z'));
  assert.equal(end, Date.parse('2026-10-09T21:59:59Z'));
  assert.ok(update.articles.length >= 60);
  assert.ok(new Set(update.articles.map(article => article.sourceId)).size >= 25);
  assert.ok(update.articles.some(article => article.group === 'Miscl' && article.section === 'Lead stories'));
  assert.equal(update.articles.filter(article => article.section === 'Lead stories' && article.subsection === 'Ukraine').length, 4);
  assert.equal(update.articles.filter(article => article.section === 'Lead stories' && article.subsection === 'Middle East').length, 2);
  assert.ok(new Set(update.articles.filter(article => article.section === 'South Eastern Europe' && article.subsection === 'Bosnia and Herzegovina').map(article => article.sourceId)).size >= 2);
  assert.ok(new Set(update.articles.filter(article => article.section === 'South Caucasus' && article.subsection === 'Georgia').map(article => article.sourceId)).size >= 2);
  assert.ok(update.sourceChecks.some(check => check.name === 'NewsNow' && /original publisher/i.test(check.reason)));
  const byPlace = new Map();
  for (const article of update.articles) {
    const place = `${article.section}|${article.subsection}|${article.country || ''}`;
    if (!byPlace.has(place)) byPlace.set(place, []);
    byPlace.get(place).push(article);
  }
  for (const [place, articles] of byPlace) if (articles.length > 1) {
    assert.ok(new Set(articles.map(article => article.sourceId)).size > 1, place);
  }
  for (const article of update.articles) {
    const published = Date.parse(article.publishedAt);
    assert.ok(published >= start && published <= end, article.title);
    assert.ok(allowed.get(article.section)?.has(article.subsection), article.title);
    if (article.section === 'Miscellaneous') assert.ok(article.country, article.title);
    if (article.section === 'Lead stories' && article.subsection === 'Ukraine') assert.ok(['Reuters', 'AP', 'BBC', 'Politico.eu', 'Euronews', 'DW', 'AFP', 'dpa'].includes(article.sourceName), article.title);
  }
  assert.equal(currentDailyUpdate(update, Date.parse('2026-10-11T12:00:00Z')).articles.length, update.articles.length);
});

test('13 October edition contains verified headlines inside its fixed 24-hour window', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-13.json', import.meta.url), 'utf8'));
  const start = Date.parse(update.windowStart);
  const end = Date.parse(update.windowEnd);
  const allowed = new Map(NEWS_SECTIONS.map(section => [section.id, new Set(section.subsections)]));
  assert.equal(update.windowHours, 24);
  assert.equal(end - start, 24 * 60 * 60 * 1000);
  assert.ok(update.articles.length >= 25);
  assert.ok(new Set(update.articles.map(item => item.sourceId)).size >= 10);
  const leads = update.articles.filter(item => item.section === 'Lead stories');
  assert.equal(leads.filter(item => item.subsection === 'Ukraine').length, 4);
  assert.ok(leads.some(item => item.sourceName === 'Euronews'));
  assert.ok([1, 2].includes(leads.filter(item => item.subsection === 'Middle East').length));
  for (const article of update.articles) {
    assert.ok(Date.parse(article.publishedAt) >= start && Date.parse(article.publishedAt) <= end, article.title);
    assert.ok(allowed.get(article.section)?.has(article.subsection), article.title);
    assert.ok(article.title && article.url.startsWith('https://') && article.reviewed);
    if (article.section === 'Miscellaneous') assert.ok(article.country, article.title);
    if (article.timePrecision === 'date') assert.ok(article.url.includes('/2026/10/13/'), article.url);
    assert.ok(passesSourcePolicy({ id: article.sourceId }, article.title, article.summary), article.title);
  }
  const armenia = update.articles.filter(item => item.section === 'South Caucasus' && item.subsection === 'Armenia');
  assert.match(armenia[0].title, /OSCE/);
  assert.equal(currentDailyUpdate(update, end + 86400000).articles.length, update.articles.length);
});
