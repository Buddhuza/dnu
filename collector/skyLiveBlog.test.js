import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSkyLiveBlogEntries, isSkyUkraineLiveBlog, SKY_UKRAINE_LIVE_URL } from './skyLiveBlog.js';
import { adaptSelectedArticles } from './dnuEdition.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';

const parent = { link: SKY_UKRAINE_LIVE_URL, headline: 'Ukraine war latest: Updates', source: 'Sky News', sourceDomain: 'news.sky.com' };
const body = '<p>Danish authorities said they uncovered a suspected Russian plot targeting a US-Ukrainian citizen.</p><p>The European Commission president called the alleged attempt an attack on European Union soil and said support for Ukraine would continue.</p>';

test('Sky live posts use the postid Copy link, timestamp and individual body', () => {
  const posts = { success: true, result: [
    { id: 12884642, created: 1795251316, title: 'Russia plotted assassination attempt on US-Ukrainian citizen in Denmark, EU chief says', content: { html: body } },
    { id: 12884904, created: 1795255619, title: 'Mapped: The situation on the battlefield', content: { html: '<p>Too short.</p>' } }
  ] };
  const entries = extractSkyLiveBlogEntries(posts, parent);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].published, '2026-11-21T08:55:16.000Z');
  assert.equal(entries[0].link, `${SKY_UKRAINE_LIVE_URL}?postid=12884642#liveblog-body`);
  assert.match(entries[0].articleBody, /European Union soil/);
  assert.equal(entries[0].sourceDomain, 'news.sky.com');
  assert.equal(extractSkyLiveBlogEntries(`\uFEFF${JSON.stringify(posts)}`, parent).length, 1);
});

test('Sky extractor rejects unrelated pages and malformed feed entries', () => {
  assert.ok(!isSkyUkraineLiveBlog('https://news.sky.com/story/other-12541714'));
  assert.equal(extractSkyLiveBlogEntries('{broken', parent).length, 0);
  assert.equal(extractSkyLiveBlogEntries({ success: true, result: [{ id: '12884642', created: 1795251316, title: 'Russia plotted assassination attempt on US-Ukrainian citizen in Denmark, EU chief says', content: { html: body } }] }, parent).length, 0);
});

test('Sky wrapper is excluded while dated posts follow event location', () => {
  assert.equal(excludedHeadlineReason('Ukraine war latest: Updates', '', SKY_UKRAINE_LIVE_URL), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason('Russia plotted assassination attempt on US-Ukrainian citizen in Denmark, EU chief says', '', `${SKY_UKRAINE_LIVE_URL}?postid=12884642#liveblog-body`), '');
  const entries = extractSkyLiveBlogEntries({ success: true, result: [
    { id: 12884642, created: 1795251316, title: 'Russia plotted assassination attempt on US-Ukrainian citizen in Denmark, EU chief says', content: { html: body } },
    { id: 12884529, created: 1795249942, title: 'Seven-year-old boy and paramedic killed and dozens injured in Russian strike',
      content: { html: '<p>Two people were killed in Russian missile strikes on the Ukrainian city of Kryvyi Rih overnight.</p><p>Emergency crews responded as officials assessed damage across the city and neighbouring districts after the attack.</p>' } }
  ] }, parent);
  const { articles, rejected } = adaptSelectedArticles(entries, new Set(), [{ id: 'source-gas-news-sky-com', domain: 'news.sky.com', name: 'Sky News', country: 'International' }]);
  assert.equal(rejected.length, 0);
  assert.deepEqual(articles.map(article => [article.subsection, article.country]), [['WESTERN / CENTRAL EUROPE', 'Denmark'], ['Ukraine', '']]);
});
