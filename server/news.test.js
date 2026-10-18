import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeArticles, scrapeHeadlines, searchSourceArticles, undatedCandidates, reviewedArticle, reviewedArticleCheck, fallbackListingUrl, candidatePage, shortlistCandidates, customSourceFromRequest, DEFAULT_INCLUDE } from './news.js';

const source = { id: 'source-1', name: 'Test News', group: 'Test', url: 'https://example.com/news/' };
const now = Date.parse('2026-10-09T12:00:00Z');

test('keeps only dated, matching headlines from the last 48 hours', () => {
  const payload = { data: { json: { articles: [
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' },
    { title: 'Security meeting held yesterday', url: '/story-2', publishedAt: '2026-10-07T10:00:00Z' },
    { title: 'Security rumor', url: '/story-3' },
    { title: 'Security date only', url: '/story-5', publishedAt: '2026-10-09' },
    { title: 'Security sports event', url: '/story-4', publishedAt: '2026-10-09T09:00:00Z' },
    { title: 'Security meeting held today', url: '/story-1', publishedAt: '2026-10-09T10:00:00Z' }
  ] } } };
  const result = normalizeArticles(payload, source, now, ['security'], ['sports']);
  assert.equal(result.length, 1);
  assert.equal(result[0].url, 'https://example.com/story-1');
});

test('Firecrawl request sends the fixed source URL and bearer credential', async () => {
  let called;
  const fetchStub = async (url, options) => {
    called = { url, options };
    return { ok: true, json: async () => ({ success: true, data: { json: { articles: [] } } }) };
  };
  await scrapeHeadlines(source, ['security'], 'test-key', fetchStub);
  assert.equal(called.url, 'https://api.firecrawl.dev/v2/scrape');
  assert.equal(called.options.headers.Authorization, 'Bearer test-key');
  assert.equal(JSON.parse(called.options.body).url, source.url);
});

test('recent Firecrawl site search supplies article candidates for verification', async () => {
  let called;
  const fetchStub = async (url, options) => {
    called = { url, body: JSON.parse(options.body) };
    return { ok: true, json: async () => ({ success: true, data: { web: [{ title: 'Security talks', url: 'https://example.com/article', description: 'Ministers met.' }] } }) };
  };
  const payload = await searchSourceArticles(source, ['security', 'politics'], 'test-key', fetchStub);
  assert.equal(called.url, 'https://api.firecrawl.dev/v2/search');
  assert.equal(called.body.tbs, 'qdr:d2');
  assert.equal(payload.collectionMethod, 'firecrawl-search');
  assert.deepEqual(undatedCandidates(payload, source, ['security']).map(item => item.url), ['https://example.com/article']);
});

test('undated matching links can be checked on their original article pages', () => {
  const payload = { data: { json: { articles: [
    { title: 'Security talks continue', url: '/story-1' },
    { title: 'Election vote opens', absoluteUrl: 'https://example.com/story-2', publishedAt: '2026-10-09T00:00:00Z' },
    { title: 'Sports results', url: '/sports' },
    { title: 'Security elsewhere', url: 'https://other.example/story' }
  ] } } };
  const candidates = undatedCandidates(payload, source, ['security', 'election']);
  assert.deepEqual(candidates.map(x => x.url), ['https://example.com/story-1', 'https://example.com/story-2']);
  assert.equal(normalizeArticles(payload, source, now, ['election']).length, 0);
  const verified = reviewedArticle({ data: { metadata: { publishedTime: '2026-10-09T10:00:00Z', ogTitle: 'Security talks continue' }, json: { summary: 'The ministers agreed to meet again.' } } }, source, candidates[0].url, now);
  assert.equal(verified.publishedAt, '2026-10-09T10:00:00.000Z');
  assert.equal(verified.summary, 'The ministers agreed to meet again.');
  assert.equal(reviewedArticle({ data: { metadata: { publishedTime: '2026-10-07T10:00:00Z', ogTitle: 'Old story' } } }, source, candidates[0].url, now), null);
  assert.equal(reviewedArticleCheck({ data: { metadata: { publishedTime: '2026-10-07T10:00:00Z', ogTitle: 'Old story' } } }, source, candidates[0].url, now).reason, 'outsideWindow');
  assert.equal(reviewedArticleCheck({ data: { metadata: { ogTitle: 'No date' } } }, source, candidates[0].url, now).reason, 'missingHeadlineOrTime');
  const mediatorPage = { data: { metadata: { publishedTime: '2026-10-09 10:00:00', mediator_published_time: '2026-10-09T10:00:00+00:00', ogTitle: 'Belarus calls for international disaster cooperation' }, json: { summary: 'The proposal was presented at the United Nations.' } } };
  assert.equal(reviewedArticle(mediatorPage, source, candidates[0].url, now).publishedAt, '2026-10-09T10:00:00.000Z');
  const spacedZonePage = { data: { metadata: { 'article:published_time': '2026-10-09 12:25:11 +02:00', ogTitle: 'NATO allies discuss more air defence for Ukraine' }, json: { summary: 'The secretary general asked members to step up deliveries.' } } };
  assert.equal(reviewedArticle(spacedZonePage, source, candidates[0].url, now).publishedAt, '2026-10-09T10:25:11.000Z');
  const bbcPage = { data: { metadata: { ogTitle: 'Ukraine seeks allied military support', 'cXenseParse:publishtime': '2026-10-09T10:17:09Z' }, json: { summary: 'Officials asked for additional air defence systems.' } } };
  assert.equal(reviewedArticle(bbcPage, source, candidates[0].url, now).publishedAt, '2026-10-09T10:17:09.000Z');
  const structuredPage = { data: { metadata: { ogTitle: 'UN discusses peacekeeper mandate in Lebanon' }, rawHtml: '<head><script type="application/ld+json">{"datePublished":"2026-10-09T11:47:00+00:00"}</script></head>', json: { summary: 'The current mandate expires at the end of the year.' } } };
  assert.equal(reviewedArticle(structuredPage, source, candidates[0].url, now).publishedAt, '2026-10-09T11:47:00.000Z');
  const aaPage = { data: { metadata: { ogTitle: 'NATO allies increase military aid', publishedTime: '2026-10-09T14:15:01.383' }, json: { summary: 'The package includes drones and missiles.' } } };
  assert.equal(reviewedArticle(aaPage, { ...source, url: 'https://www.aa.com.tr/en/', id: 'source-149' }, 'https://www.aa.com.tr/en/europe/story/4088419', now).publishedAt, '2026-10-09T11:15:01.000Z');
});

test('a retrospective collection can verify an article older than the usual 48 hours', () => {
  const end = Date.parse('2026-10-18T19:44:31Z');
  const page = { data: { metadata: { publishedTime: '2026-10-16T10:00:00Z', ogTitle: 'OSCE convenes security talks' }, json: { summary: 'Delegates agreed to meet again.' } } };
  assert.equal(reviewedArticleCheck(page, source, 'https://example.com/osce-talks', end).reason, 'outsideWindow');
  assert.equal(reviewedArticleCheck(page, source, 'https://example.com/osce-talks', end, end - Date.parse('2026-10-16T10:00:00Z')).article?.publishedAt, '2026-10-16T10:00:00.000Z');
});

test('alternate collection checks the source homepage after a section fails', () => {
  assert.equal(fallbackListingUrl(source), 'https://example.com/');
  assert.equal(fallbackListingUrl({ ...source, url: 'https://example.com/' }), null);
  assert.equal(fallbackListingUrl({ ...source, listingUrl: 'https://example.com/section' }), source.url);
});

test('publisher article timestamps are taken from TASS and non-English pages are rejected', () => {
  const tass = { id: 'tass', name: 'TASS', url: 'https://tass.com/politics', group: 'Miscl' };
  const tassUrl = 'https://tass.com/politics/2201383';
  const tassPage = { data: { html: '<dateformat time="1791890077" mode="abs"></dateformat>', metadata: { ogTitle: 'Russia to cooperate with ASEAN on marine security — Lavrov' } } };
  assert.equal(reviewedArticle(tassPage, tass, tassUrl, Date.parse('2026-10-13T12:00:00Z')).publishedAt, '2026-10-13T11:14:37.000Z');
  assert.equal(reviewedArticle(tassPage, tass, tassUrl, Date.parse('2026-10-13T11:00:00Z')), null);

  const izvestia = { id: 'izvestia', name: 'Izvestia', url: 'https://iz.ru/rubric/mir', group: 'Miscl' };
  const izvestiaUrl = 'https://iz.ru/2183304/v-frg-zaderzhali-tretego-podozrevaemogo-v-podzhoge-shliuza-starlink-v-polshe-izi';
  const izvestiaPage = { data: { html: '<div itemprop="datePublished">2026-10-13T12:59:04+03:00</div>', metadata: { ogTitle: 'В ФРГ задержали третьего подозреваемого в поджоге шлюза Starlink в Польше' } } };
  assert.equal(reviewedArticleCheck(izvestiaPage, izvestia, izvestiaUrl, Date.parse('2026-10-13T12:00:00Z')).reason, 'nonEnglish');
  assert.deepEqual(undatedCandidates({ data: { json: { articles: [{ title: 'В ФРГ задержали третьего подозреваемого', url: izvestiaUrl }] } } }, izvestia, DEFAULT_INCLUDE).map(item => item.url), []);
});

test('Al Jazeera page time is converted from Doha when AI only returns a date', () => {
  const outlet = { id: 'al-jazeera', name: 'Al Jazeera', url: 'https://www.aljazeera.com/news/', group: 'Miscl' };
  const url = 'https://www.aljazeera.com/news/2026/10/17/hormuz-shipping';
  const page = { data: {
    metadata: { ogTitle: 'Iran and US dispute control of Hormuz shipping', publishedDate: '2026-10-17T12:10:56' },
    json: { publishedAt: '2026-10-17T00:00:00Z', summary: 'Twelve ships were attacked during the preceding week, according to the UK maritime agency.' }
  } };
  assert.equal(reviewedArticle(page, outlet, url, Date.parse('2026-10-17T15:22:48Z')).publishedAt, '2026-10-17T09:10:56.000Z');
});

test('complete source scan pages through every matching article link', () => {
  const candidates = Array.from({ length: 27 }, (_, index) => ({ url: `https://example.com/${index}` }));
  const seen = [];
  let cursor = 0;
  do {
    const page = candidatePage(candidates, cursor, true);
    seen.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== null);
  assert.deepEqual(seen, candidates);
  assert.equal(candidatePage(candidates).items.length, 3);
  assert.equal(candidatePage(candidates, 0, false, true).items.length, 10);
});

test('bulk scan opens a bounded headline shortlist while complete scan keeps every link', () => {
  const candidates = Array.from({ length: 31 }, (_, index) => ({ url: `https://example.com/${index}` }));
  const shortlisted = shortlistCandidates(candidates);
  assert.equal(shortlisted.length, 12);
  assert.deepEqual(shortlisted, candidates.slice(0, 12));
  assert.equal(candidatePage(shortlisted, 10, true).items.length, 2);
  assert.equal(candidatePage(shortlisted, 10, true).nextCursor, null);
  assert.equal(candidatePage(shortlisted, 0, true, false, true).items.length, 3);
  assert.equal(candidatePage(shortlisted, 3, true, false, true).nextCursor, 6);
  assert.equal(candidates.length, 31);
});

test('listing descriptions help rank externally focused stories before article scrapes', () => {
  const payload = { data: { json: { articles: [
    { title: 'Political agenda today', description: 'The OSCE discussed a new cross-border security agreement.', url: '/osce' },
    { title: 'Election campaign rally', description: 'A local mayor spoke at a party event.', url: '/local' }
  ] } } };
  assert.equal(undatedCandidates(payload, source, ['political', 'election'])[0].url, 'https://example.com/osce');
});

test('listing AI priority shortlists visible headlines before article scrapes', () => {
  const payload = { data: { json: { articles: [
    { title: 'Election campaign rally', description: 'A local mayor spoke at a party event.', url: '/local', priority: 1 },
    { title: 'Political agenda today', description: 'The OSCE discussed a cross-border agreement.', url: '/osce', priority: 5 }
  ] } } };
  assert.equal(shortlistCandidates(undatedCandidates(payload, source, ['political', 'election']))[0].url, 'https://example.com/osce');
  assert.equal(shortlistCandidates(undatedCandidates(payload, source, ['political', 'election'])).length, 1);
});

test('manual source accepts a public HTTPS news site and rejects local targets', () => {
  const input = { id: 'manual-source-123', name: 'New Agency', group: 'Europe', url: 'https://news.example.org/latest' };
  assert.equal(customSourceFromRequest(input)?.url, input.url);
  assert.equal(customSourceFromRequest({ ...input, url: 'https://localhost/private' }), null);
  assert.equal(customSourceFromRequest({ ...input, url: 'http://news.example.org/' }), null);
  assert.equal(customSourceFromRequest({ ...input, url: 'https://127.0.0.1/' }), null);
});

test('Internazionale collects its Reuters feed and credits Reuters articles', async () => {
  const source = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8')).find(item => item.name === 'Internazionale');
  let targetUrl;
  const fetchStub = async (_url, options) => {
    targetUrl = JSON.parse(options.body).url;
    return { ok: true, json: async () => ({ success: true, data: { json: { articles: [] } } }) };
  };
  await scrapeHeadlines(source, [], 'test-key', fetchStub);
  assert.equal(source.group, 'Miscl');
  assert.equal(source.verifyArticlePages, true);
  assert.equal(targetUrl, 'https://www.internazionale.it/ultime-notizie-reuters');
  const payload = { data: { json: { articles: [
    { title: 'Reuters security report', url: 'https://www.internazionale.it/ultime-notizie-reuters/2026/10/10/security-report', publishedAt: '2026-10-10T10:00:00+02:00' },
    { title: 'Unrelated security opinion', url: 'https://www.internazionale.it/opinioni/security', publishedAt: '2026-10-10T10:00:00+02:00' }
  ] } } };
  const result = normalizeArticles(payload, source, Date.parse('2026-10-11T12:00:00Z'), ['security']);
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceName, 'Reuters');
  assert.deepEqual(undatedCandidates(payload, source, ['security'], [], true).map(item => item.url), [result[0].url]);
});

test('Montsame uses its working English politics listing', async () => {
  const source = JSON.parse(readFileSync(new URL('../sources.json', import.meta.url), 'utf8')).find(item => item.name === 'Montsame');
  assert.equal(source.listingUrl, 'https://montsame.mn/en/more/302');
  assert.equal(fallbackListingUrl(source), source.url);
});
