import test from 'node:test';
import assert from 'node:assert/strict';
import { extractDwLiveBlogEntries, isDwLiveBlog } from './dwLiveBlog.js';
import { adaptSelectedArticles } from './dnuEdition.js';
import { parseItem_ } from './rules.js';
import { load } from 'cheerio';

const url = 'https://www.dw.com/en/ukraine-updates-russian-attack-one-of-largest-zelenskyy-says/live-79999822?maca=en-rss-en-all-1573-rdf';
const parent = { id: 'parent', link: url, headline: 'Ukraine updates: Russian attack one of largest, Zelenskyy says',
  source: 'DW', sourceDomain: 'dw.com', country: 'Ukraine', category: 'Eastern Europe' };
const body = 'Russian missiles struck several Ukrainian cities overnight. Officials reported damage to power infrastructure and emergency teams responded at multiple sites. Ukrainian authorities said they were assessing casualties and restoring electricity after the attack.';

test('DW structured live updates become separate dated articles with distinct links and bodies', () => {
  const html = `<script type="application/ld+json">${JSON.stringify({ '@type': 'LiveBlogPosting', liveBlogUpdate: [
    { '@type': 'BlogPosting', headline: 'Russian missiles hit Kyiv power infrastructure', datePublished: '2026-11-21T06:15:00+01:00', url: `${url.split('?')[0]}#post-abc`, articleBody: body },
    { '@type': 'BlogPosting', headline: 'Ukraine officials report further attacks in Odesa', datePublished: '2026-11-21T07:20:00+01:00', url: `${url.split('?')[0]}#post-def`, articleBody: body },
    { '@type': 'BlogPosting', headline: 'Undated update should be ignored', articleBody: body, url: `${url.split('?')[0]}#post-old` }
  ] })}</script>`;
  const entries = extractDwLiveBlogEntries(html, parent);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].published, '2026-11-21T05:15:00.000Z');
  assert.match(entries[0].link, /dnu-update=post-abc#post-abc$/);
  assert.notEqual(entries[0].link, entries[1].link);
  assert.equal(entries[0].articleBody, body);
  const adapted = adaptSelectedArticles(entries, new Set(), [{ id: 'source-80', domain: 'dw.com', name: 'DW', country: 'International' }]);
  assert.equal(adapted.rejected.length, 0);
  assert.equal(adapted.articles[0].subsection, 'Ukraine');
});

test('DW timestamped HTML entries are extracted without treating the whole blog as an article', () => {
  const html = `<main><h1>${parent.headline}</h1><article id="post-123"><time datetime="2026-11-21T08:30:00+01:00">08:30</time><h2>Ukraine says drones hit Russian airfield</h2><p>${body}</p></article><article id="post-124"><time>09:00</time><h2>Undated update</h2><p>${body}</p></article></main>`;
  const entries = extractDwLiveBlogEntries(html, parent);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].headline, 'Ukraine says drones hit Russian airfield');
  assert.equal(entries[0].published, '2026-11-21T07:30:00.000Z');
  assert.ok(!isDwLiveBlog('https://www.dw.com/en/ordinary-story/a-79999822'));
});

test('an older DW blog wrapper remains eligible for checking fresh individual updates', () => {
  const $ = load(`<item><title>Ukraine updates: Russian attack one of largest, Zelenskyy says</title><link>${url.replaceAll('&', '&amp;')}</link><pubDate>Thu, 19 Nov 2026 09:00:00 GMT</pubDate></item>`, { xmlMode: true });
  const element = node => ({ getName: () => node.name, getText: () => $(node).text(),
    getChildren: () => $(node).children().toArray().map(element), getAttribute: name => node.attribs[name] ? { getValue: () => node.attribs[name] } : null });
  const win = { start: new Date('2026-11-20T12:00:00Z'), end: new Date('2026-11-21T12:00:00Z') };
  const feed = { name: 'DW', publisherDomain: 'dw.com', url: 'https://rss.dw.com/xml/rss-en-all' };
  const registry = [{ name: 'DW', domain: 'dw.com', country: 'International' }];
  const blog = parseItem_(element($('item')[0]), feed, win, registry);
  assert.equal(blog.link.split('?')[0], url.split('?')[0]);
  assert.equal(blog.reject, undefined);
});
