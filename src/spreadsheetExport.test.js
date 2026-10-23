import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { SPREADSHEET_COLUMNS, spreadsheetRow, createSpreadsheet } from './spreadsheetExport.js';
import { extractReutersBody } from './articleBodyText.js';

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

test('spreadsheet uses database region names, including original placements of lead stories', () => {
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
  assert.equal(spreadsheetRow(lead, page, { story: { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE' } })[2], 'Europe');
});

test('spreadsheet distinguishes Georgian InterPressNews from Moldovan IPN', () => {
  const page = { heading: 'Talks continue', body: 'Officials held talks.' };
  const article = { sourceName: 'IPN', section: 'South Caucasus', subsection: 'Georgia', title: 'Talks continue' };
  assert.equal(spreadsheetRow({ ...article, sourceId: 'source-63', url: 'https://www.interpressnews.ge/en/story' }, page)[1], 'InterPressNews');
  assert.equal(spreadsheetRow({ ...article, url: 'https://www.interpressnews.ge/en/story' }, page)[1], 'InterPressNews');
  assert.equal(spreadsheetRow({ ...article, sourceId: 'source-32', url: 'https://ipn.md/en/story' }, page)[1], 'IPN');
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
