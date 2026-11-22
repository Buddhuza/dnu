import test from 'node:test';
import assert from 'node:assert/strict';
import { extractIndependentLiveBlogEntries, isIndependentLiveBlog } from './independentLiveBlog.js';
import { baselineScore_, listingCandidates_, selectArticles_ } from './rules.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { adaptSelectedArticles } from './dnuEdition.js';

const source = { id: 'source-independent-co-uk', name: 'The Independent', domain: 'independent.co.uk', country: 'International' };
const parent = {
  link: 'https://www.independent.co.uk/news/world/europe/ukraine-russia-war-live-crimea-bridge-attack-putin-zelensky-b3088384.html',
  source: source.name, sourceDomain: source.domain, sourceCountry: source.country
};
const headline = 'Ukrainian drones strike Russian National Guard facility in Krasnodar – reports';
const first = 'Ukrainian military has a regional headquarters of Russian National Guard, reported the Kyiv Independent, citing Telegram monitoring channels.';
const second = 'The extent of the damage to the facility is not clear.';

test('Independent live entries retain timestamp permalinks and separate paragraph text', () => {
  const posts = [
    { '@type': 'BlogPosting', headline, url: `${parent.link}#post-2430929`, datePublished: '2026-11-22T11:00:51.000Z', articleBody: `${first}\n\n${second}` },
    { '@type': 'BlogPosting', headline: 'Russian authorities report another drone attack near Krasnodar overnight',
      url: `${parent.link}#post-2430928`, datePublished: '2026-11-22T05:20:00.000Z', articleBody: `${first}\n\n${second}` }
  ];
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'LiveBlogPosting', liveBlogUpdate: posts })}</script>
    <div class="liveblog-post" id="post-2430929"><a href="#post-2430929"><span title="Sun Nov 22 2026 11:00:51 GMT+0000"></span></a><h2>${headline}</h2><p>${first}</p><p>${second}</p></div>
    <div class="liveblog-post" id="post-2430928"><a href="#post-2430928"><span title="Sun Nov 22 2026 05:20:00 GMT+0000"></span></a><h2>${posts[1].headline}</h2><p>${first}</p><p>${second}</p></div>`;
  const entries = extractIndependentLiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].headline, headline);
  assert.equal(entries[0].link, `${parent.link}#post-2430929`);
  assert.equal(entries[0].articleBody, `${first}\n\n${second}`);
  assert.equal(entries[0].published, '2026-11-22T11:00:51.000Z');
  assert.notEqual(canonicalArticleUrl(entries[0].link), canonicalArticleUrl(entries[1].link));
  assert.equal(excludedHeadlineReason('Ukraine war live: latest updates', '', parent.link), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason(entries[0].headline, '', entries[0].link), '');
  entries[0].score = baselineScore_(entries[0]);
  const selected = selectArticles_([entries[0]]);
  assert.equal(selected.length, 1);
  const result = adaptSelectedArticles(selected, new Set(), [source]);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.articles[0].sourceId, source.id);
  assert.equal(result.articles[0].sectionId, 'Miscellaneous');
  assert.equal(result.articles[0].country, 'Russia');
  assert.equal(result.articles[0].body, `${first}\n\n${second}`);
});

test('Independent daily live URL is discovered from its current world listing', () => {
  const next = 'https://www.independent.co.uk/news/world/europe/ukraine-russia-war-live-latest-zelensky-b3088999.html';
  const rows = listingCandidates_(`<a href="${next}">Ukraine war live: leaders discuss a new security deal</a>`,
    { ...source, url: 'https://www.independent.co.uk/news/world', publisherDomain: source.domain },
    { start: new Date('2026-11-22T00:00:00Z'), end: new Date('2026-11-23T00:00:00Z') }, [source]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].link, next);
  assert.ok(isIndependentLiveBlog(next));
});
