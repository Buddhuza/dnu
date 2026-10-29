import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { SPREADSHEET_COLUMNS, spreadsheetRow, createSpreadsheet } from './spreadsheetExport.js';
import { extractBrowserArticleBody, extractReutersBody } from './articleBodyText.js';
import { extractArticleBody } from '../server/articleBody.js';

test('spreadsheet rows use article dates, regional labels and multi-country subjects', () => {
  const article = { id: 'one', sourceName: 'Reuters', section: 'Lead stories', subsection: 'Ukraine', publishedAt: '2026-10-19T23:30:00Z', url: 'https://example.com/story', title: 'Russia and Ukraine hold talks' };
  const row = spreadsheetRow(article, { heading: 'Russia and Ukraine hold talks', body: 'Officials from Russia and Ukraine held talks with the OSCE.' });
  assert.equal(row[0], '2026-10-20');
  assert.equal(row[2], 'Eastern Europe');
  assert.equal(row[3], 'Ukraine, Russia');
  assert.equal(row[5], 'OSCE');
  assert.equal(row[9], 'Russia and Ukraine hold talks');
  assert.equal(row[10], 'Officials from Russia and Ukraine held talks with the OSCE.');
});

test('spreadsheet uses database region names and the visible placement of lead stories', () => {
  const page = { heading: 'Talks continue', body: 'Officials held talks.' };
  const article = { id: 'story', sourceName: 'AP', section: 'Miscellaneous', url: 'https://example.com/story', title: 'Talks continue' };
  for (const [subsection, expected] of [
    ['MIDDLE EAST / NORTH AFRICA', 'Middle East'],
    ['WESTERN / CENTRAL EUROPE', 'Europe'],
    ['RUSSIA / EURASIA', 'Eurasia'],
    ['NORTH EAST ASIA', 'North East Asia'],
    ['NORTH AMERICA', 'North America'],
    ['INTERNATIONAL ORGANISATIONS', ''],
    ['AFGHANISTAN / PAKISTAN', 'AFGHANISTAN / PAKISTAN']
  ]) {
    assert.equal(spreadsheetRow({ ...article, subsection }, page)[2], expected, subsection);
  }
  const lead = { ...article, section: 'Lead stories', subsection: 'Middle East' };
  assert.equal(spreadsheetRow(lead, page)[2], 'Middle East');
  assert.equal(spreadsheetRow(lead, page, { story: { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE' } })[2], 'Middle East');
});

test('spreadsheet uses the visible lead heading when a story has moved from another country', () => {
  const article = { id: 'moved', sourceName: 'AP', sectionId: 'Lead stories', subsection: 'Ukraine', title: 'Talks continue', url: 'https://example.com/story' };
  const row = spreadsheetRow(article, { heading: 'Talks continue', body: 'Delegates met for a second day.' }, {
    moved: { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'France' }
  });
  assert.equal(row[2], 'Eastern Europe');
  assert.equal(row[3], 'Ukraine');
  assert.equal(row[5], '');
});

test('spreadsheet puts the displayed organisation heading in Organizations, including custom organisations', () => {
  const page = { heading: 'Delegates meet', body: 'Delegates met for a second day.' };
  const article = { id: 'body', sourceName: 'AP', sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'Council of Europe', title: 'Delegates meet', url: 'https://example.com/story' };
  const row = spreadsheetRow(article, page);
  assert.equal(row[2], '');
  assert.equal(row[3], '');
  assert.equal(row[5], 'Council of Europe');
  const lead = spreadsheetRow({ ...article, sectionId: 'Lead stories', subsection: 'Council of Europe' }, page, {
    body: { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'Council of Europe' }
  });
  assert.equal(lead[3], '');
  assert.equal(lead[5], 'Council of Europe');
});

test('spreadsheet keeps the placed country first when the text mentions a neighbouring territory', () => {
  const article = { id: 'serbia', sourceName: 'AP', sectionId: 'South Eastern Europe', subsection: 'Serbia', title: 'Delegates meet', url: 'https://example.com/story' };
  const row = spreadsheetRow(article, { heading: 'Delegates meet', body: 'The Kosovo delegation travelled to Belgrade.' });
  assert.equal(row[3], 'Serbia, Serbia / Kosovo');
});

test('spreadsheet distinguishes Georgian InterPressNews from Moldovan IPN', () => {
  const page = { heading: 'Talks continue', body: 'Officials held talks.' };
  const article = { sourceName: 'IPN', section: 'South Caucasus', subsection: 'Georgia', title: 'Talks continue' };
  assert.equal(spreadsheetRow({ ...article, sourceId: 'source-63', url: 'https://www.interpressnews.ge/en/story' }, page)[1], 'InterPressNews');
  assert.equal(spreadsheetRow({ ...article, url: 'https://www.interpressnews.ge/en/story' }, page)[1], 'InterPressNews');
  assert.equal(spreadsheetRow({ ...article, sourceId: 'source-32', url: 'https://ipn.md/en/story' }, page)[1], 'IPN');
});

test('spreadsheet files Abkhazia and South Ossetia under Georgia and identifies the relevant local regions', () => {
  const article = { id: 'georgia', sourceName: 'AP', section: 'South Caucasus', subsection: 'Georgia / Abkhazia / South Ossetia', title: 'Talks continue', url: 'https://example.com/georgia' };
  const cases = [
    [{ heading: 'South Ossetia announces new measures', body: 'Abkhazia was mentioned only as background.' }, 'South Ossetia'],
    [{ heading: 'Abkhaz officials meet Georgian delegation', body: 'The meeting was held in Abkhazia.' }, 'Abkhazia'],
    [{ heading: 'Abkhazia and South Ossetia hold talks', body: 'Delegations met.' }, 'Abkhazia, South Ossetia'],
    [{ heading: 'Talks continue', body: 'Officials met in Tskhinvali.' }, 'South Ossetia'],
    [{ heading: 'Talks continue', body: 'Officials met again.' }, '']
  ];
  for (const [page, regions] of cases) {
    const row = spreadsheetRow(article, page);
    assert.equal(row[3], 'Georgia');
    assert.equal(row[4], regions);
  }
  const crossBorder = spreadsheetRow({ ...article, subsection: 'Georgia' }, { heading: 'Russia and Abkhazia hold talks', body: 'Delegations met.' });
  assert.equal(crossBorder[3], 'Georgia, Russia');
  assert.equal(crossBorder[4], 'Abkhazia');
});

test('spreadsheet writes an importable workbook with exact column names and full body text', async () => {
  const row = ['2026-10-20', 'AP', 'South Eastern Europe', 'Serbia / Kosovo', '', 'EU', '', '', 'https://example.com/article', 'Headline', 'First paragraph.\n\nSecond paragraph.'];
  const blob = await createSpreadsheet([row]);
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  for (const label of SPREADSHEET_COLUMNS) assert.ok(sheet.includes(`>${label}</t>`), label);
  assert.ok(sheet.includes('First paragraph.\n\nSecond paragraph.'));
  assert.ok(sheet.includes('Serbia / Kosovo'));
});

test('Reuters body extraction leaves out newsletter copy and keeps article paragraphs', () => {
  const markdown = 'LONDON, Oct 20 (Reuters) - Britain will fly jets to protect Saudi cities and other targets after a new request for defensive support from the Saudi government.\n\nThe Misinformation Monitor newsletter rounds up international misinformation narratives.\n\nOfficials said the missions will begin on Wednesday and involve air force squadrons already based in the region, with flight crews instructed to intercept incoming drones and missiles.\n\nReporting by Example Reporter';
  const body = extractReutersBody(markdown);
  assert.match(body, /Britain will fly jets/);
  assert.match(body, /missions will begin/);
  assert.doesNotMatch(body, /Misinformation Monitor|Reporting by/);
});

test('translated article bodies are exported in English or left unavailable', () => {
  const page = { json: { translatedHeadline: 'Ministers discuss security', translatedBody: 'The ministers discussed cross-border security and agreed to establish a joint working group with neighbouring states. '.repeat(12) }, markdown: 'Министры обсудили безопасность. '.repeat(30) };
  assert.match(extractBrowserArticleBody(page), /cross-border security/);
  assert.match(extractArticleBody(page), /cross-border security/);
  delete page.json.translatedBody;
  assert.equal(extractBrowserArticleBody(page), '');
  assert.equal(extractArticleBody(page), '');
  page.json.translatedBody = 'Министры обсудили безопасность и сотрудничество с соседними государствами. '.repeat(30);
  assert.equal(extractBrowserArticleBody(page), '');
  assert.equal(extractArticleBody(page), '');
});
