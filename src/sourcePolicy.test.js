import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { disallowedUkraineSource, isUkrainianOutlet } from './sourcePolicy.js';
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

test('published edition uses international outlets for all Ukraine stories', () => {
  const update = JSON.parse(readFileSync(new URL('../data/daily-update-2026-10-14-15.json', import.meta.url), 'utf8'));
  assert.ok(update.articles.some(article => article.section === 'Lead stories' && article.subsection === 'Ukraine'));
  assert.ok(update.articles.some(article => article.section === 'Eastern Europe' && article.subsection === 'Ukraine'));
  assert.ok(update.articles.every(article => !disallowedUkraineSource(article)));
});
