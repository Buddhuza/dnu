import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAlJazeeraLiveBlogEntries, alJazeeraMissingPostIds, alJazeeraAmpUrl } from './alJazeeraLiveBlog.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { listingCandidates_ } from './rules.js';

const parent = { link: 'https://www.aljazeera.com/news/liveblog/2026/11/21/iran-war-live-bahrain-strikes',
  source: 'Al Jazeera', sourceDomain: 'aljazeera.com', sourceCountry: 'International' };
const body = 'Iranian forces struck two military installations in Bahrain overnight. Authorities said the strikes damaged equipment and emergency crews were assessing the site. Officials said diplomatic talks would continue despite the attack.';

test('Al Jazeera AMP posts have individual dated links and article text', () => {
  const html = `<ul><li id="live-blog-updates-item-1234567" data-sort-time="1795335300"><div class="card-live__content-area"><h2>Iranian forces strike two military installations in Bahrain</h2><div class="card-live__content"><div class="wysiwyg"><p>${body}</p></div></div></div></li><li id="live-blog-updates-item-1234568" data-sort-time="1795334400"><div class="card-live__content-area"><h2>Bahrain announces response after Iranian military attack</h2><div class="card-live__content"><div class="wysiwyg"><p>${body}</p></div></div></div></li></ul>`;
  const entries = extractAlJazeeraLiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].published, '2026-11-22T08:15:00.000Z');
  assert.equal(entries[0].articleBody, body);
  assert.equal(entries[0].link, `${parent.link}?update=1234567`);
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(entries[1].link));
  assert.equal(excludedHeadlineReason('Iran war live: strikes continue', '', parent.link), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason(entries[0].headline, '', entries[0].link), '');
  assert.equal(alJazeeraAmpUrl(parent.link), 'https://www.aljazeera.com/amp/news/liveblog/2026/11/21/iran-war-live-bahrain-strikes');
});

test('Al Jazeera embedded state identifies older posts still inside the collection window', () => {
  const state = { 'ChildMeta:1234567': { __typename: 'ChildMeta', id: '1234567', publishedTime: '1795335300' },
    'ChildMeta:1234568': { __typename: 'ChildMeta', id: '1234568', publishedTime: '1795334400' },
    'ChildMeta:1234569': { __typename: 'ChildMeta', id: '1234569', publishedTime: '1700000000' } };
  const html = `<script>window.__APOLLO_STATE__="${Buffer.from(JSON.stringify(state)).toString('base64')}";</script>`;
  const missing = alJazeeraMissingPostIds(html, [{ link: `${parent.link}?update=1234567` }], new Date('2026-11-22T07:00:00Z'), new Date('2026-11-22T09:00:00Z'));
  assert.deepEqual(missing, ['1234568']);
});

test('publisher listings discover a changed daily live-blog address', () => {
  const nextDay = 'https://www.aljazeera.com/news/liveblog/2026/11/22/iran-war-live-new-developments';
  const registry = [{ id: 'source-aj', domain: 'aljazeera.com', name: 'Al Jazeera', country: 'International' }];
  const feed = { ...registry[0], publisherDomain: 'aljazeera.com', url: 'https://www.aljazeera.com/news/' };
  const rows = listingCandidates_(`<a href="${nextDay}">Iran war live: new developments across the region</a>`, feed,
    { start: new Date('2026-11-22T00:00:00Z'), end: new Date('2026-11-23T00:00:00Z') }, registry);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, nextDay);
  assert.equal(alJazeeraAmpUrl(rows[0].link), nextDay.replace('/news/', '/amp/news/'));
});
