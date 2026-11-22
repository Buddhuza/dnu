import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGuardianLiveBlogEntries, guardianNextPageUrl, guardianOldestPostTime, isGuardianLiveBlog } from './guardianLiveBlog.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { listingCandidates_ } from './rules.js';

const parent = { link: 'https://www.theguardian.com/world/live/2026/nov/19/russia-ukraine-war-coalition-of-the-willing-europe-latest-news-updates', source: 'The Guardian', sourceDomain: 'theguardian.com' };
const id = 'block-6aff365f8f083b93122af030';
const title = 'Is Europe now in the shadow of a Trump, Putin and Xi alliance? – podcast';
const first = 'Andy Burnham is meeting western leaders in Berlin and Brussels this week, to discuss Ukraine and closer ties to the EU. Meanwhile, Donald Trump, Vladimir Putin and Xi Jinping have met at the Apec summit in China.';
const second = 'Is this the start of a global shift of power away from Europe, or was it just a hyped-up photo opportunity?';

test('Guardian timestamp link supplies the exact post target, time and body', () => {
  const html = `<article id="${id}" class="block"><header><a href="?page=with%3A${id}#${id}"><time datetime="2026-11-19T17:49:59.000Z">3d ago</time></a><h2>${title}</h2></header><p>${first}</p><figure><p>Image caption, not article text</p></figure><p>${second}</p><p>Here is our latest Politics Weekly podcast on this if you want to catch up.</p></article>`;
  const entries = extractGuardianLiveBlogEntries(html, parent);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].headline, title);
  assert.equal(entries[0].published, '2026-11-19T17:49:59.000Z');
  assert.equal(entries[0].articleBody, `${first}\n\n${second}`);
  assert.equal(entries[0].link, `${parent.link}?page=with%3A${id}#${id}`);
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(parent.link));
  assert.equal(excludedHeadlineReason(title, '', entries[0].link), 'Live-blog roundup, podcast or photo gallery rather than a standalone news story');
  assert.equal(excludedHeadlineReason('Ukraine war live updates', '', parent.link), 'Live blogs are excluded');
  assert.equal(guardianOldestPostTime(html), Date.parse('2026-11-19T17:49:59.000Z'));
});

test('Guardian older page is taken only from a same-blog Next link', () => {
  const next = 'block-6aff280b8f08b5d1002898ca';
  assert.equal(guardianNextPageUrl(`<a href="?page=with%3A${next}#liveblog-navigation">Next</a>`, parent.link),
    `${parent.link}?page=with%3A${next}`);
  assert.equal(guardianNextPageUrl('<a href="https://example.com/?page=with%3Ablock-6aff280b8f08b5d1002898ca#liveblog-navigation">Next</a>', parent.link), '');
});

test('Guardian listings can discover a new daily live URL', () => {
  const url = 'https://www.theguardian.com/world/live/2026/nov/22/russia-ukraine-war-latest-news';
  const source = { id: 'source-guardian', domain: 'theguardian.com', name: 'The Guardian', country: 'International' };
  const rows = listingCandidates_(`<a href="${url}">Ukraine war live: leaders discuss a proposed ceasefire deal</a>`,
    { ...source, url: 'https://www.theguardian.com/world', publisherDomain: 'theguardian.com' },
    { start: new Date('2026-11-22T00:00:00Z'), end: new Date('2026-11-23T00:00:00Z') }, [source]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, url);
  assert.ok(isGuardianLiveBlog(rows[0].link));
});
