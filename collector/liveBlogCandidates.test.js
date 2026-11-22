import test from 'node:test';
import assert from 'node:assert/strict';
import { isLiveBlogParentCandidate } from './liveBlogCandidates.js';

const dw = 'https://www.dw.com/en/ukraine-updates-russian-attack-one-of-largest-zelenskyy-says/live-79999822?maca=en-rss-en-all-1573-rdf';

test('a DW live blog parent is excluded while its extracted post remains eligible', () => {
  assert.equal(isLiveBlogParentCandidate({ link: dw }), true);
  assert.equal(isLiveBlogParentCandidate({ link: `${dw}&dnu-update=post-1#post-1`, fromLiveBlog: true }), false);
  assert.equal(isLiveBlogParentCandidate({ link: 'https://www.dw.com/en/story/a-80000000' }), false);
});

test('other supported live blog parents cannot enter article selection', () => {
  for (const link of [
    'https://www.bbc.com/news/live/crly5w901n20t',
    'https://www.theguardian.com/world/live/2026/nov/19/russia-ukraine-war-coalition-of-the-willing-europe-latest-news-updates',
    'https://www.france24.com/en/europe/20261122-live-finland-says-war-spilling-over-after-baltic-sea-drone-strike-on-russian-cargo-ship',
    'https://www.independent.co.uk/news/world/europe/ukraine-russia-war-live-crimea-bridge-attack-putin-zelensky-b3088384.html',
    'https://www.cbsnews.com/live-updates/iran-war-trump-tehran-denies-chemical-weapons/',
    'https://www.aljazeera.com/news/liveblog/2026/11/21/iran-war-live-iran-targets-us-military-in-bahrain-houthi-strikes-continue',
    'https://news.sky.com/story/ukraine-war-latest-zelenskyy-labels-putin-killer-after-trumps-friendship-comments-12541713'
  ]) assert.equal(isLiveBlogParentCandidate({ link }), true, link);
});
