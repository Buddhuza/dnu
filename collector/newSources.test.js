import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newSourceListingCandidates } from './newSourceListings.js';
import { extractPage_ } from './rules.js';
import { adaptSelectedArticles } from './dnuEdition.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';

const registry = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url)));
const win = { start: new Date('2026-11-21T00:00:00Z'), end: new Date('2026-11-23T00:00:00Z') };
const source = domain => registry.find(item => item.domain === domain);
const feed = (domain, url) => ({ ...source(domain), url, publisherDomain: domain });

test('all seven requested sources have stable catalogue IDs and direct collection routes', () => {
  const domains = ['pap.pl', 'thedefensepost.com', 'therecord.media', 'defensescoop.com',
    'securityweek.com', 'middleeasteye.net', 'koreatimes.co.kr'];
  assert.equal(new Set(domains.map(domain => source(domain)?.id)).size, domains.length);
  for (const domain of domains) {
    assert.equal(source(domain)?.domain, domain);
    assert.ok(source(domain).listingUrl.startsWith('https://'));
  }
});

test('PAP empty overlay links use adjacent headline and Warsaw time', () => {
  const html = `<div class="news-card"><a class="newsLink" href="/en/news/poland-receive-nato-support-strengthen-eastern-border-minister-says"></a>
    <div class="date"><time datetime="2026-11-22T12:26:00+01:00">22.11.2026 12:26</time></div>
    <h2 class="title">Poland to receive NATO support to strengthen eastern border, minister says</h2>
    <p class="field--name-field-lead">Poland will receive support from NATO allies to strengthen protection of its eastern border.</p></div>`;
  const rows = newSourceListingCandidates(html, feed('pap.pl', 'https://www.pap.pl/en/news'), win, registry);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].published, '2026-11-22T11:26:00.000Z');
  assert.equal(rows[0].source, 'PAP');
  assert.match(rows[0].link, /pap\.pl\/en\/news\/poland-receive-nato/);
});

test('Korea Times long teaser yields only the headline and original article link', () => {
  const html = `<a href="/southkorea/politics/20261122/ruling-party-outlines-grounds-to-impeach-chief-justice">
    <h2>Ruling party outlines grounds to impeach chief justice</h2>
    <p>${'The Democratic Party of Korea proposed impeaching the chief justice. '.repeat(12)}</p></a>`;
  const rows = newSourceListingCandidates(html, feed('koreatimes.co.kr', 'https://www.koreatimes.co.kr/'), win, registry);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].headline, 'Ruling party outlines grounds to impeach chief justice');
  assert.equal(rows[0].source, 'The Korea Times');
  assert.equal(rows[0].pendingPublication, true);
});

test('PAP article date and Middle East Eye live-update time are verified on article pages', () => {
  const pap = extractPage_(`<link rel="canonical" href="https://www.pap.pl/en/news/poland-receive-nato-support-strengthen-eastern-border-minister-says">
    <h1>Poland to receive NATO support to strengthen eastern border, minister says</h1><div class="date">22.11.2026 12:26</div>
    <article><p>${'Poland will receive NATO support to protect its eastern border. '.repeat(6)}</p></article>`,
  'Poland to receive NATO support to strengthen eastern border, minister says');
  assert.equal(pap.published, '2026-11-22T11:26:00.000Z');
  const mee = extractPage_(`<link rel="canonical" href="https://www.middleeasteye.net/live-blog/live-blog-update/araghchi-talks-down-qatari-visit">
    <h1>Araghchi talks down Qatari visit</h1><div class="submitted-date"><span class="date-created">22 November 2026 11:09 GMT</span></div>
    <article><p>${'Iranian Foreign Minister Abbas Araghchi discussed a Qatari delegation visit to Tehran. '.repeat(6)}</p></article>`,
  'Araghchi talks down Qatari visit');
  assert.equal(mee.published, '2026-11-22T11:09:00.000Z');
  assert.equal(excludedHeadlineReason('Live: Iran updates', '', 'https://www.middleeasteye.net/live'), 'Live blogs are excluded');
  assert.equal(excludedHeadlineReason('Araghchi talks down Qatari visit', '',
    'https://www.middleeasteye.net/live-blog/live-blog-update/araghchi-talks-down-qatari-visit'), '');
});

test('SecurityWeek retains article paragraphs when page metadata contains only a teaser', () => {
  const title = 'FBI Investigating Apparent Hack of National Criminal Justice Database';
  const first = 'The FBI is investigating an apparent hack of a national law enforcement database that it maintains.';
  const body = 'The National Crime Information Center contains criminal justice information available to federal and local agencies. '.repeat(7);
  const html = `<link rel="canonical" href="https://www.securityweek.com/fbi-investigating-hack/"><meta property="article:published_time" content="2026-11-22T00:53:02+00:00">
    <meta name="author" content="Associated Press"><h1>${title}</h1><article><p>${first}</p><p>${first} A source confirmed the inquiry.</p><p>${body}</p></article>`;
  const page = extractPage_(html, title);
  assert.ok(page.text.length > 300);
  assert.match(page.text, /National Crime Information Center/);
  assert.equal(page.wire, 'AP');
});

test('PAP can cover another European country; Middle East Eye and Korea Times stay in scope', () => {
  const item = (domain, headline, path) => ({ id: domain, headline, link: `https://${domain}${path}`,
    source: source(domain).name, sourceDomain: domain, sourceCountry: source(domain).country,
    published: '2026-11-22T11:00:00.000Z', articleBody: 'A verified article body with enough words to be kept for database export and review. '.repeat(5) });
  const cases = [
    [item('pap.pl', 'Romanian parliament approves new defence cooperation law', '/en/news/romania-defence-law'), true],
    [item('middleeasteye.net', 'Araghchi talks down Qatari visit', '/live-blog/live-blog-update/araghchi-talks-down-qatari-visit'), true],
    [item('middleeasteye.net', 'French government announces defence spending plan', '/news/france-defence-spending'), false],
    [item('koreatimes.co.kr', 'Ruling party outlines grounds to impeach chief justice', '/southkorea/politics/20261122/chief-justice'), true],
    [item('koreatimes.co.kr', 'North Korea launches ballistic missile into sea', '/northkorea/20261122/ballistic-missile'), true]
  ];
  for (const [story, accepted] of cases) {
    const result = adaptSelectedArticles([story], new Set(), registry);
    assert.equal(result.articles.length === 1, accepted, story.headline);
  }
});
