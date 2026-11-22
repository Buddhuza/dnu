import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFrance24LiveBlogEntries, isFrance24LiveBlog } from './france24LiveBlog.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { listingCandidates_ } from './rules.js';
import { adaptSelectedArticles } from './dnuEdition.js';

const parent = { link: 'https://www.france24.com/en/europe/20261122-live-finland-says-war-spilling-over-after-baltic-sea-drone-strike-on-russian-cargo-ship',
  source: 'France 24', sourceDomain: 'france24.com' };
const headline = 'Zelensky says Russia launched around 2,700 drones, 1,460 aerial bombs this week';
const first = 'Russia launched around 2,700 drones, nearly 1,460 aerial bombs, and 165 missiles of various types at them, Ukrainian President Volodymyr Zelensky said on X.';
const second = 'Zelensky urged the US to approve the transfer of Patriot air defence missiles already paid for by Kyiv partners, saying delays were difficult to understand.';

test('France 24 Arena IDs stay paired with the correct headline and paragraph text', () => {
  const structured = { '@type': 'LiveBlogPosting', liveBlogUpdate: [
    { '@type': 'BlogPosting', headline, url: `${parent.link}?arena_mid=XLB4svmyA357pMWznUsP&v=2`, datePublished: '2026-11-22T11:00:39+00:00', articleBody: `${first} ${second}` },
    { '@type': 'BlogPosting', headline: 'Kyiv restaurant owners brace for winter as war pressures mount',
      url: `${parent.link}?arena_mid=6KGHD9UnA4slJJikcDwa&v=2`, datePublished: '2026-11-22T10:35:24+00:00', articleBody: `${first} ${second}` }
  ] };
  const html = `<script type="application/ld+json">${JSON.stringify(structured)}</script><div class="m-em-liveblog"><div class="arena-liveblog"></div><div style="display: none"><div><time datetime="2026-11-22T11:00:39+00:00"></time><h2>${headline}</h2><p>${first}</p><p><br></p><p>${second}</p></div><div><time datetime="2026-11-22T10:35:24+00:00"></time><h2>Kyiv restaurant owners brace for winter as war pressures mount</h2><p>${first}</p><p>${second}</p></div></div></div>`;
  const entries = extractFrance24LiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].headline, headline);
  assert.equal(entries[0].published, '2026-11-22T11:00:39.000Z');
  assert.equal(entries[0].articleBody, `${first}\n\n${second}`);
  assert.equal(entries[0].link, `${parent.link}?arena_mid=XLB4svmyA357pMWznUsP&v=2`);
  assert.match(entries[1].link, /arena_mid=6KGHD9UnA4slJJikcDwa/);
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(entries[1].link));
  assert.equal(excludedHeadlineReason('Ukraine war live: latest updates', '', parent.link), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason(entries[0].headline, '', entries[0].link), '');
});

test('France 24 new daily blog URL can be found in publisher listings', () => {
  const source = { id: 'source-gas-france24-com', domain: 'france24.com', name: 'France 24', country: 'International' };
  const next = 'https://www.france24.com/en/europe/20261123-live-ukraine-war-latest-updates';
  const rows = listingCandidates_(`<a href="${next}">Ukraine war live: leaders discuss a new security deal</a>`,
    { ...source, url: 'https://www.france24.com/en/europe/', publisherDomain: 'france24.com' },
    { start: new Date('2026-11-23T00:00:00Z'), end: new Date('2026-11-24T00:00:00Z') }, [source]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, next);
  assert.ok(isFrance24LiveBlog(next));
});

test('a Zelensky live update keeps its body and existing France 24 source ID under Ukraine', () => {
  const source = { id: 'source-gas-france24-com', domain: 'france24.com', name: 'France 24', country: 'International' };
  const entry = { id: 'zelensky-update', link: `${parent.link}?arena_mid=XLB4svmyA357pMWznUsP&v=2`,
    headline, source: 'France 24', sourceDomain: 'france24.com', sourceCountry: 'International',
    published: '2026-11-22T11:00:39.000Z', articleBody: `${first}\n\n${second}`, summary: first };
  const result = adaptSelectedArticles([entry], new Set(), [source]);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.articles[0].sectionId, 'Eastern Europe');
  assert.equal(result.articles[0].subsection, 'Ukraine');
  assert.equal(result.articles[0].sourceId, source.id);
  assert.equal(result.articles[0].body, entry.articleBody);
});
