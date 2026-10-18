import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { blockedPlacementReason, disallowedUkraineSource, isUkrainianOutlet } from './sourcePolicy.js';
import { defaultSiteConfig, displaySiteContent, moveArticleInConfig } from './siteConfig.js';

test('Ukrainian outlets are excluded from Ukraine placement but retained for other countries', () => {
  const outlet = { sourceId: 'source-34', url: 'https://www.ukrinform.net/article', sourceName: 'Ukrinform' };
  assert.equal(disallowedUkraineSource(outlet, { sectionId: 'Eastern Europe', subsection: 'Ukraine' }), true);
  assert.equal(disallowedUkraineSource(outlet, { sectionId: 'Lead stories', subsection: 'Ukraine' }), true);
  assert.equal(disallowedUkraineSource(outlet, { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' }), false);
  assert.equal(isUkrainianOutlet({ url: 'https://en.interfax.com.ua/news/example' }), true);
  assert.equal(isUkrainianOutlet({ url: 'https://example.ua/en/news/example' }), true);
  assert.equal(isUkrainianOutlet({ sourceId: 'source-85', url: 'https://apnews.com/article/example' }), false);
});

test('display and move rules keep Ukrainian outlet stories out of Ukraine', () => {
  const articles = [
    { id: 'local', section: 'Eastern Europe', subsection: 'Ukraine', sourceId: 'source-34', url: 'https://www.ukrinform.net/article', title: 'Ukraine story' },
    { id: 'global', section: 'Eastern Europe', subsection: 'Ukraine', sourceId: 'source-85', url: 'https://apnews.com/article/story', title: 'AP story' },
    { id: 'other', section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States', sourceId: 'source-34', url: 'https://www.ukrinform.net/other', title: 'US story' }
  ];
  const config = defaultSiteConfig(articles);
  assert.deepEqual(displaySiteContent(articles, config).map(item => item.id), ['global', 'other']);
  assert.equal(moveArticleInConfig(config, articles, 'other', { sectionId: 'Lead stories', subsection: 'Ukraine' }), config);
});

test('Armenian and Azerbaijani outlets cannot cover the other country heading', () => {
  const armenian = { sourceId: 'source-47', url: 'https://www.pan.am/en/article' };
  const azerbaijani = { sourceId: 'source-59', url: 'https://news.az/news/article' };
  assert.match(blockedPlacementReason(armenian, { sectionId: 'South Caucasus', subsection: 'Azerbaijan' }), /Armenian outlet/);
  assert.match(blockedPlacementReason(azerbaijani, { sectionId: 'South Caucasus', subsection: 'Armenia' }), /Azerbaijani outlet/);
  assert.match(blockedPlacementReason(azerbaijani, { sectionId: 'Lead stories', subsection: 'Armenia' }), /Azerbaijani outlet/);
  assert.equal(blockedPlacementReason(armenian, { sectionId: 'South Caucasus', subsection: 'Armenia' }), '');
  assert.equal(blockedPlacementReason(azerbaijani, { sectionId: 'South Caucasus', subsection: 'Azerbaijan' }), '');
  assert.equal(blockedPlacementReason({ url: 'https://oc-media.org/article' }, { sectionId: 'South Caucasus', subsection: 'Armenia' }), '');
});

test('Russian outlets stay under Russia in display and manual moves', () => {
  const russian = { id: 'tass', sourceId: 'source-97', url: 'https://tass.com/politics/123', section: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia', title: 'Russia holds diplomatic talks' };
  const config = defaultSiteConfig([russian]);
  assert.equal(blockedPlacementReason(russian), '');
  assert.match(blockedPlacementReason(russian, { sectionId: 'Lead stories', subsection: 'Russia' }), /Russian outlet/);
  assert.match(blockedPlacementReason(russian, { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE' }), /Russian outlet/);
  assert.equal(moveArticleInConfig(config, [russian], 'tass', { sectionId: 'Lead stories', subsection: 'Ukraine' }), config);
  assert.deepEqual(displaySiteContent([russian], config).map(item => item.id), ['tass']);
});

test('published edition uses international outlets for all Ukraine stories', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-14-15.json', import.meta.url), 'utf8'));
  assert.ok(update.articles.some(article => article.section === 'Lead stories' && article.subsection === 'Ukraine'));
  assert.ok(update.articles.some(article => article.section === 'Eastern Europe' && article.subsection === 'Ukraine'));
  assert.ok(update.articles.every(article => !blockedPlacementReason(article)));
  assert.ok(update.articles.every(article => String(article.summary || '').trim().split(/\s+/).length <= 30));
  assert.ok(!update.articles.some(article => article.url.includes('tirana-erupts-in-chaos')));
});
