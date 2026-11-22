import test from 'node:test';
import assert from 'node:assert/strict';
import { extractBbcLiveBlogEntries, isBbcLiveBlog } from './bbcLiveBlog.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { listingCandidates_ } from './rules.js';

const parent = { link: 'https://www.bbc.com/news/live/crly5w901n20t', source: 'BBC', sourceDomain: 'bbc.com' };
const firstId = 'asset:7f8993b5-f76d-49c5-94b6-3c868e1f4ba2';
const secondId = 'asset:503acced-f7bb-4790-9726-95e68e556c1d';
const firstParagraph = 'As our colleague from the science team has just mentioned, carbon capture, use and storage (CCUS) is one of the issues mentioned in the latest draft deal.';
const rest = 'Put simply, it is a technology that aims to capture carbon dioxide emissions and prevent them from entering the atmosphere. The captured gas can be used in industry or stored underground.';

test('BBC live posts retain the Copy link asset ID, exact time and paragraph text', () => {
  const structured = { '@graph': [{ '@type': 'LiveBlogPosting', liveBlogUpdate: [
    { '@type': 'BlogPosting', '@id': `${parent.link}?post=${firstId}`, headline: 'What is carbon capture, use and storage?',
      datePublished: '2026-11-22T10:53:12.584Z', articleBody: `${firstParagraph} ${rest}` },
    { '@type': 'BlogPosting', '@id': `${parent.link}?post=${secondId}`, headline: 'Fourth draft still contains no mention of fossil fuels',
      datePublished: '2026-11-22T10:26:21.056Z', articleBody: rest }
  ] }] };
  const html = `<script type="application/ld+json">${JSON.stringify(structured)}</script><article data-testid="content-post" id="${firstId}"><h3>What is carbon capture, use and storage?</h3><p>${firstParagraph}</p><p>But what is CCUS?</p><p>${rest}</p></article>`;
  const entries = extractBbcLiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].link, 'https://www.bbc.com/news/live/crly5w901n20t?post=asset%3A7f8993b5-f76d-49c5-94b6-3c868e1f4ba2#post');
  assert.equal(entries[0].published, '2026-11-22T10:53:12.584Z');
  assert.equal(entries[0].articleBody, `${firstParagraph}\n\nBut what is CCUS?\n\n${rest}`);
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(entries[1].link));
  assert.equal(excludedHeadlineReason('COP31 climate talks - follow live', '', parent.link), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason(entries[0].headline, '', entries[0].link), 'What explainer headlines are excluded');
  assert.equal(excludedHeadlineReason(entries[1].headline, '', entries[1].link), '');
});

test('the BBC news listing discovers a live URL without a fixed slug', () => {
  const source = { id: 'source-83', domain: 'bbc.com', name: 'BBC', country: 'International' };
  const rows = listingCandidates_('<a href="/news/live/anotherday123">LIVE Climate summit agrees new draft after negotiations</a>',
    { ...source, publisherDomain: 'bbc.com', url: 'https://www.bbc.com/news' },
    { start: new Date('2026-11-22T00:00:00Z'), end: new Date('2026-11-23T00:00:00Z') }, [source]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, 'https://www.bbc.com/news/live/anotherday123');
  assert.ok(isBbcLiveBlog(rows[0].link));
});
