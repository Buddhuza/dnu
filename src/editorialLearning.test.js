import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSiteConfig, normalizeSiteConfig } from './siteConfig.js';
import { matchingEditorialDecision, recordEditorialDecision } from './editorialLearning.js';

test('approval learns a placement and survives shared settings normalization', () => {
  const article = { title: 'Turkmen parliament and Russian Federation Council sign 2027 cooperation plan', sourceName: 'Interfax', url: 'https://interfax.com/story' };
  const placement = { sectionId: 'Central Asia', subsection: 'Turkmenistan', country: '' };
  const config = normalizeSiteConfig(recordEditorialDecision(defaultSiteConfig(), article, 'approve', placement));
  const match = matchingEditorialDecision({ ...article, url: 'https://interfax.com/story?utm_source=rss' }, config.editorialLearning);
  assert.deepEqual([match.action, match.sectionId, match.subsection], ['approve', 'Central Asia', 'Turkmenistan']);
});

test('deleted stories suppress close repeats without blocking unrelated coverage by the same agency', () => {
  const original = { title: 'Serbia drops violent overthrow case against student protesters', sourceName: 'BIRN', url: 'https://birn.eu/first' };
  const { editorialLearning } = recordEditorialDecision(defaultSiteConfig(), original, 'reject');
  assert.equal(matchingEditorialDecision({ title: 'Serbia formally drops violent overthrow case against student protesters', sourceName: 'BIRN', url: 'https://birn.eu/rewrite' }, editorialLearning)?.action, 'reject');
  assert.equal(matchingEditorialDecision({ title: 'Serbia parliament passes new security law', sourceName: 'BIRN', url: 'https://birn.eu/other' }, editorialLearning), null);
});

test('a later editor decision replaces the earlier one for the same URL', () => {
  const article = { title: 'Regional security talks begin', sourceName: 'Reuters', url: 'https://reuters.com/item' };
  const approved = recordEditorialDecision(defaultSiteConfig(), article, 'approve', { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' });
  const rejected = recordEditorialDecision(approved, article, 'reject');
  assert.equal(rejected.editorialLearning.length, 1);
  assert.equal(matchingEditorialDecision(article, rejected.editorialLearning).action, 'reject');
});
