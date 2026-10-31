import test from 'node:test';
import assert from 'node:assert/strict';
import { articlePlacement, importedArticle, publicArticleUrl, publicationTimestamp, resolveArticleTime, sourceForArticle } from './importArticle.js';
import { formatViennaDateTime } from '../src/viennaTime.js';

test('custom article URLs must be public HTTPS pages', () => {
  assert.equal(publicArticleUrl('https://news.example.org/story')?.href, 'https://news.example.org/story');
  for (const value of ['http://news.example.org/story', 'https://localhost/story', 'https://127.0.0.1/story', 'https://name:password@news.example.org/story', 'https://news.example.org:8080/story']) assert.equal(publicArticleUrl(value), null);
});

test('placement uses the report taxonomy and rejects invented classifications', () => {
  assert.deepEqual(articlePlacement({}, 'Kosovo and Serbia hold security talks', ''), { sectionId: 'South Eastern Europe', subsection: 'Serbia / Kosovo', country: '' });
  assert.deepEqual(articlePlacement({}, 'EU launches new sanctions', ''), { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'EU' });
  assert.deepEqual(articlePlacement({}, 'European Commission rejects Baltic anti-drone funding request', ''), { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'EU' });
  assert.deepEqual(articlePlacement({ section: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'Mars' }, 'OSCE chair to visit Armenia', ''), { sectionId: 'South Caucasus', subsection: 'Armenia', country: '' });
  assert.deepEqual(articlePlacement({}, 'Germany signs defence deal with France', ''), { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Germany' });
  assert.deepEqual(articlePlacement({}, 'Estonia to build 150 bunkers along Russian border', ''), { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Estonia' });
});

test('imported international coverage of an attack in Ukraine overrides a Russia classification', () => {
  const url = new URL('https://example.org/russia-bombs-ukraine');
  const payload = { data: { metadata: { ogTitle: 'Russia bombs Ukraine overnight', publishedTime: '2026-10-17T08:00:00Z', language: 'en' }, json: { summary: 'The Russian military said missiles hit a power plant near Kyiv.', classification: { section: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' } } } };
  const article = importedArticle(payload, url, { id: 'manual', name: 'International News', url: url.href });
  assert.equal(article.sectionId, 'Eastern Europe');
  assert.equal(article.subsection, 'Ukraine');
  const armenianUrl = new URL('https://www.pan.am/en/russian-attack-ukraine');
  const armenianPayload = { data: { metadata: { ogTitle: 'Armenian officials condemn Russian bombing of Ukraine', publishedTime: '2026-10-17T08:00:00Z', language: 'en' }, json: { summary: 'The Russian military struck energy facilities in Kyiv overnight.' } } };
  const regionalArticle = importedArticle(armenianPayload, armenianUrl, { id: 'source-47', name: 'PAN', url: 'https://www.pan.am/en' });
  assert.equal(regionalArticle.subsection, 'Ukraine');
});

test('review flow can keep a scraped article whose location is unknown', () => {
  const url = new URL('https://example.org/story');
  const payload = { data: { metadata: { ogTitle: 'New security talks announced', publishedTime: '2026-10-14T10:00:00Z', language: 'en' }, json: { summary: 'The foreign ministers will meet next month.' } } };
  assert.throws(() => importedArticle(payload, url, { id: 'manual', name: 'Example News', url: url.href }), /could not be placed/);
  const draft = importedArticle(payload, url, { id: 'manual', name: 'Example News', url: url.href }, { allowUnplaced: true });
  assert.equal(draft.sectionId, '');
  assert.equal(draft.subsection, '');
});

test('imported story has a reviewed headline, summary, source and placement', () => {
  const url = publicArticleUrl('https://example.org/article');
  const source = sourceForArticle(url, [{ id: 'source-1', name: 'Example News', url: 'https://example.org/latest' }]);
  const payload = { data: { metadata: { ogTitle: 'OSCE chair to visit Armenia', publishedTime: '2026-10-14T10:00:00Z', language: 'en' }, json: { summary: 'The chair will discuss the peace process in Yerevan.', section: 'South Caucasus', subsection: 'Armenia' } } };
  const story = importedArticle(payload, url, source);
  assert.equal(story.sourceName, 'Example News');
  assert.equal(story.subsection, 'Armenia');
  assert.equal(story.reviewed, true);
  assert.equal(story.summary, 'The chair will discuss the peace process in Yerevan.');
  assert.equal(story.id, 'manual-https://example.org/article');
});

test('manual import uses the participating outlet country for a bilateral story', () => {
  const url = publicArticleUrl('https://www.pan.am/en/626315');
  const source = { id: 'source-47', name: 'PAN', url: 'https://www.pan.am/en/newsfeed' };
  const payload = { data: { metadata: { ogTitle: 'Mirzoyan discusses bilateral issues with Kosovo’s official', publishedTime: '2026-10-14T07:18:00Z', language: 'en' }, json: { summary: 'Armenian Foreign Minister Ararat Mirzoyan met Kosovo’s deputy prime minister.', section: 'South Eastern Europe', subsection: 'Serbia / Kosovo' } } };
  const story = importedArticle(payload, url, source);
  assert.deepEqual([story.sectionId, story.subsection], ['South Caucasus', 'Armenia']);
});

test('non-English pages need a translation, while an undated page uses the import time', () => {
  const url = publicArticleUrl('https://example.org/article');
  const source = sourceForArticle(url, []);
  const data = { metadata: { ogTitle: 'OSCE chair to visit Armenia', publishedTime: '2026-10-14T10:00:00Z', language: 'ru' }, json: { summary: 'The chair will discuss the peace process in Yerevan.' } };
  assert.throws(() => importedArticle({ data }, url, source), /could not be translated/);
  const translated = importedArticle({ data: { ...data, markdown: 'Правительство обсудило вопросы безопасности. '.repeat(15), json: { ...data.json, translatedHeadline: 'OSCE chair to visit Armenia', translatedSummary: 'The chair will discuss the peace process in Yerevan.', translatedBody: 'The chair will discuss the peace process in Yerevan. '.repeat(12) } } }, url, source);
  assert.equal(translated.title, '(文A) OSCE chair to visit Armenia');
  assert.equal(translated.originalHeadline, data.metadata.ogTitle);
  assert.equal(translated.translated, true);
  const before = Date.now();
  const story = importedArticle({ data: { ...data, metadata: { ...data.metadata, language: 'en', publishedTime: undefined } } }, url, source);
  assert.equal(story.timeSource, 'current');
  assert.ok(Date.parse(story.publishedAt) >= before && Date.parse(story.publishedAt) <= Date.now());
});

test('publisher page timestamps with a space and timezone are verified', () => {
  assert.equal(publicationTimestamp('2026-10-13 08:25:00 +02:00'), '2026-10-13T06:25:00.000Z');
  assert.equal(publicationTimestamp('2026-10-14CEST16:42:24'), '2026-10-14T14:42:24.000Z');
  assert.equal(publicationTimestamp('2026-10-13', '2026-10-13T08:25:00+02:00'), '2026-10-13T06:25:00.000Z');
});

test('imported article times accept old dates and convert offsets to Vienna time', () => {
  const url = publicArticleUrl('https://example.org/story');
  const time = resolveArticleTime({ data: { metadata: { publishedTime: '2020-01-14T09:30:00-05:00' } } }, url);
  assert.deepEqual(time, { publishedAt: '2020-01-14T14:30:00.000Z', timeSource: 'page' });
  assert.match(formatViennaDateTime(time.publishedAt), /15:30 CET$/);
  assert.equal(publicationTimestamp('2026-10-14 09:30 EDT'), '2026-10-14T13:30:00.000Z');
  assert.equal(publicationTimestamp('2026-10-14 09:30 America/New_York'), '2026-10-14T13:30:00.000Z');
  assert.equal(publicationTimestamp('13 October 2026 at 08:25 CET'), '2026-10-13T07:25:00.000Z');
  assert.equal(publicationTimestamp('2026-10-13 08:25 GMT+2'), '2026-10-13T06:25:00.000Z');
});

test('Add infers a missing timezone, a date-only page, or a date in the URL', () => {
  const now = Date.parse('2026-10-14T12:00:00Z');
  const plainUrl = publicArticleUrl('https://example.org/story');
  assert.deepEqual(resolveArticleTime({ data: { metadata: { publishedTime: '2026-10-13 08:25:00' } } }, plainUrl, now), { publishedAt: '2026-10-13T06:25:00.000Z', timeSource: 'inferred' });
  assert.deepEqual(resolveArticleTime({ data: { metadata: { publishedTime: '2026-10-13' }, json: { publicationClue: '13 October 2026 at 08:25' } } }, plainUrl, now), { publishedAt: '2026-10-13T06:25:00.000Z', timeSource: 'inferred' });
  assert.deepEqual(resolveArticleTime({ data: {} }, publicArticleUrl('https://example.org/news/2026/10/12/story'), now), { publishedAt: '2026-10-12T10:00:00.000Z', timeSource: 'inferred' });
  assert.deepEqual(resolveArticleTime({ data: {} }, plainUrl, now), { publishedAt: '2026-10-14T12:00:00.000Z', timeSource: 'current' });
  assert.match(formatViennaDateTime('2026-10-14T12:00:00Z'), /14:00 CEST$/);
});
