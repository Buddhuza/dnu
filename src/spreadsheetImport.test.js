import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createSpreadsheet } from './spreadsheetExport.js';
import { convertSpreadsheetRows, listSpreadsheetSheets, readSpreadsheet } from './spreadsheetImport.js';
import { reportStoryText } from './reportText.js';
import { displaySiteContent, normalizeSiteConfig } from './siteConfig.js';

const columns = ['2026-10-23', 'Guardian', 'Europe', 'UK, US', '', '', '', '', 'https://www.theguardian.com/example', 'UK and US ministers meet in London | Guardian', 'UK and US ministers met in London on Friday to discuss European security. They agreed to establish a working group on protection of critical undersea cables and to share intelligence across the Atlantic.'];

test('an exported Excel sheet imports a short DNU story and retains its full body for export', async () => {
  const workbook = await createSpreadsheet([columns]);
  const rows = await readSpreadsheet(new File([workbook], 'update.xlsx'));
  const converted = convertSpreadsheetRows(rows);
  assert.equal(rows.length, 1);
  assert.equal(converted.articles.length, 1);
  assert.equal(converted.articles[0].title, 'UK and US ministers meet in London');
  assert.match(converted.articles[0].summary, /working group on protection of critical undersea cables/);
  assert.equal(converted.articles[0].sectionId, 'Miscellaneous');
  assert.equal(converted.articles[0].country, 'United Kingdom');
  assert.equal(converted.bodies[0].body, columns[10]);
  assert.match(reportStoryText(converted.articles[0]).headline, /^UK and US ministers meet in London\./);
});

test('matching URL uses the new sheet content and placement', () => {
  const existing = { id: 'osce', url: 'https://n1info.ba/example', sourceId: 'source-8', sourceName: 'N1', title: 'OSCE chief visits regional summit', summary: 'Officials discussed election monitoring in Montenegro.', publishedAt: '2026-10-23T09:00:00Z', section: 'South Eastern Europe', subsection: '', country: '' };
  const row = { rowNumber: 2, date: '2026-10-23', source: 'N1', region: 'South Eastern Europe', countries: 'Montenegro', organisations: 'OSCE', url: existing.url, heading: 'OSCE chief visits regional summit | N1', body: 'The chief joined a meeting in Montenegro with several senior officials.' };
  const result = convertSpreadsheetRows([row], { existingArticles: [existing] });
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].title, 'OSCE chief visits regional summit');
  assert.equal(result.articles[0].summary, 'The chief joined a meeting in Montenegro with several senior officials');
  assert.equal(result.articles[0].subsection, 'Montenegro');
});

test('paywalled rows are skipped without storing their teaser as a full article', () => {
  const base = { rowNumber: 2, date: '2026-10-23', source: 'AP', region: 'Europe', countries: 'UK', url: 'https://example.com/story', heading: 'Ministers agree to talks' };
  const result = convertSpreadsheetRows([
    { ...base, body: 'Subscribe to continue reading this article.' },
    { ...base, rowNumber: 3, url: 'https://example.com/other', body: 'A full story.', paywall: 'Yes' }
  ]);
  assert.equal(result.articles.length, 0);
  assert.equal(result.bodies.length, 0);
  assert.deepEqual(result.skipped.map(row => row.reason), ['Paywalled article', 'Paywalled article']);
});

test('CSV import handles quoted body text and skips a non-English article', async () => {
  const csv = 'Date,Source,Region,Countries,Source URL,Heading,Body\n2026-10-23,France 24,Europe,France,https://www.france24.com/fr/example,Manifestations à Paris,"Les manifestants sont descendus dans les rues de Paris samedi. Le gouvernement français a annoncé plusieurs mesures de sécurité après les rassemblements. Les forces de police ont procédé à des interpellations dans plusieurs quartiers de la capitale."';
  const rows = await readSpreadsheet(new File([csv], 'update.csv'));
  const result = convertSpreadsheetRows(rows);
  assert.equal(rows.length, 1);
  assert.equal(result.articles.length, 0);
  assert.match(result.skipped[0].reason, /not English/);
});

test('Excel files with shared strings and numeric dates use their column headings', async () => {
  const zip = new JSZip();
  zip.file('xl/sharedStrings.xml', '<sst><si><t>Heading</t></si><si><t>Source URL</t></si><si><t>Source</t></si><si><t>Date</t></si><si><t>News headline</t></si><si><t>https://example.com/news</t></si><si><t>AP</t></si></sst>');
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c><c r="D1" t="s"><v>3</v></c></row><row r="2"><c r="A2" t="s"><v>4</v></c><c r="B2" t="s"><v>5</v></c><c r="C2" t="s"><v>6</v></c><c r="D2"><v>46318</v></c></row></sheetData></worksheet>');
  const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'news.xlsx');
  const rows = await readSpreadsheet(file);
  assert.equal(rows[0].heading, 'News headline');
  assert.equal(rows[0].url, 'https://example.com/news');
  assert.equal(rows[0].date, '46318');
});

test('SITCEN workbook defaults to its dated selection and can open Audit separately', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2026-10-30_Rejected" r:id="rId1"/><sheet name="2026-10-30" r:id="rId2"/><sheet name="2026-10-30_Audit" r:id="rId3"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Target="worksheets/sheet3.xml"/></Relationships>');
  const worksheet = (headline, published) => `<worksheet><sheetData><row r="1"><c r="A1" t="str"><v>Date</v></c><c r="B1" t="str"><v>Category</v></c><c r="C1" t="str"><v>Headline</v></c><c r="D1" t="str"><v>Source</v></c><c r="E1" t="str"><v>Link</v></c><c r="F1" t="str"><v>PublishedUTC</v></c><c r="G1" t="str"><v>Country</v></c></row><row r="2"><c r="A2" t="str"><v>2026-10-30</v></c><c r="B2" t="str"><v>Eastern Europe</v></c><c r="C2" t="str"><v>${headline}</v></c><c r="D2" t="str"><v>BBC</v></c><c r="E2" t="str"><v>https://www.bbc.com/news/example</v></c><c r="F2" t="str"><v>${published}</v></c><c r="G2" t="str"><v>Ukraine</v></c></row></sheetData></worksheet>`;
  zip.file('xl/worksheets/sheet1.xml', '<worksheet><sheetData/></worksheet>');
  zip.file('xl/worksheets/sheet2.xml', worksheet('Morning headline', '2026-10-29T12:00:00Z'));
  zip.file('xl/worksheets/sheet3.xml', worksheet('Audit headline', '2026-10-28T11:00:00Z'));
  const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'SITCEN.xlsx');
  assert.deepEqual((await listSpreadsheetSheets(file)).sort(), ['2026-10-30', '2026-10-30_Audit']);
  const morning = convertSpreadsheetRows(await readSpreadsheet(file));
  assert.equal(morning.articles[0].title, 'Morning headline');
  assert.equal(morning.articles[0].publishedAt, '2026-10-29T12:00:00.000Z');
  assert.equal(morning.articles[0].subsection, 'Ukraine');
  assert.equal(morning.bodies.length, 0);
  const audit = convertSpreadsheetRows(await readSpreadsheet(file, '2026-10-30_Audit'));
  assert.equal(audit.articles[0].title, 'Audit headline');
});

test('the empty DNU keeps its configured structure and shows imported stories under their headings', () => {
  const config = normalizeSiteConfig({}, []);
  assert.equal(config.sections.length, 6);
  assert.deepEqual(displaySiteContent([], config), []);
  const rows = [
    { rowNumber: 2, date: '2026-10-23', source: 'AP', region: 'Eastern Europe', countries: 'Ukraine, Russia', organisations: '', url: 'https://apnews.com/article/a', heading: 'Ukraine and Russia agree to talks', summary: 'Negotiators plan to meet in Geneva.', body: '' },
    { rowNumber: 3, date: '2026-10-23', source: 'Reuters', region: 'Middle East', countries: 'Iran, US', organisations: '', url: 'https://www.reuters.com/article/b', heading: 'Iran and US agree to talks', summary: 'Negotiators plan to meet in Geneva.', body: '' }
  ];
  const imported = convertSpreadsheetRows(rows).articles;
  const visible = displaySiteContent(imported, config);
  assert.equal(visible.length, 2);
  assert.deepEqual(visible.map(item => [item.sectionId, item.subsection, item.country]), [
    ['Eastern Europe', 'Ukraine', ''],
    ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Iran']
  ]);
});

test('routine food poisoning is omitted and a top spreadsheet row alone does not make a lead', () => {
  const rows = [
    { rowNumber: 2, date: '2026-10-30', source: 'UzDaily', region: 'Central Asia Region', countries: 'Uzbekistan', url: 'https://www.uzdaily.uz/en/food-poisoning/', heading: 'Uzbekistan Court Sentences Four Over Poisoning of 105 Children', summary: 'Four catering staff were sentenced after mass food poisoning at kindergartens.' },
    { rowNumber: 3, date: '2026-10-30', source: 'UzDaily', region: 'Central Asia Region', countries: 'Uzbekistan', url: 'https://www.uzdaily.uz/en/commercial-case/', heading: 'Uzbekistan court decides commercial fraud case' },
    { rowNumber: 4, date: '2026-10-30', source: 'UzDaily', region: 'Central Asia Region', countries: 'Uzbekistan', url: 'https://www.uzdaily.uz/en/security-talks/', heading: 'Uzbekistan president holds regional security talks' },
    { rowNumber: 5, date: '2026-10-30', source: 'N1', region: 'South Eastern Europe', countries: 'Serbia', url: 'https://n1info.rs/example/', heading: 'Serbia parliament debates border security' }
  ];
  const converted = convertSpreadsheetRows(rows);
  assert.equal(converted.skipped[0].reason, 'Routine public-health incident outside the security and political scope');
  assert.deepEqual(converted.articles.slice(0, 2).map(article => article.sectionId), ['Central Asia', 'Lead stories']);

  const storedPoisoning = { ...converted.articles[0], id: 'older-import', title: rows[0].heading, summary: rows[0].summary, sectionId: 'Lead stories', section: 'Lead stories', subsection: 'Uzbekistan' };
  assert.deepEqual(displaySiteContent([storedPoisoning], normalizeSiteConfig({}, [])), []);
});

test('a generic country list does not file an Israel story under Albania', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'BBC', region: 'International',
    countries: 'Albania; Bosnia and Herzegovina; Serbia; Ukraine; Armenia; Uzbekistan',
    url: 'https://www.bbc.co.uk/news/articles/israel-election',
    heading: 'Israeli opposition accuses Netanyahu of trying to delegitimise election',
    summary: 'Opposition parties challenged the prime minister after the Israeli vote.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Israel']);

  const olderImport = { ...article, sectionId: 'South Eastern Europe', section: 'South Eastern Europe', subsection: 'Albania', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []));
  assert.deepEqual([displayed[0].sectionId, displayed[0].subsection, displayed[0].country], ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Israel']);
});

test('a generic country list does not file a North Korea story under North Macedonia', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'AP', region: 'International',
    countries: 'North Macedonia; Serbia; Kosovo; Montenegro; Bosnia and Herzegovina; Albania',
    url: 'https://apnews.com/article/north-korea-missiles',
    heading: 'North Korea fires missile barrage toward the sea as tensions with South rise',
    summary: 'South Korea said it detected ballistic missile launches from the North.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'NORTH EAST ASIA', 'North Korea']);

  const olderImport = { ...article, sectionId: 'South Eastern Europe', section: 'South Eastern Europe', subsection: 'North Macedonia', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []));
  assert.deepEqual([displayed[0].sectionId, displayed[0].subsection, displayed[0].country], ['Miscellaneous', 'NORTH EAST ASIA', 'North Korea']);

  const regionalStory = { ...olderImport, id: 'regional-story', title: 'The EU Growth Plan for the Western Balkans' };
  const kept = displaySiteContent([regionalStory], normalizeSiteConfig({}, []));
  assert.deepEqual([kept[0].sectionId, kept[0].subsection], ['South Eastern Europe', 'North Macedonia']);
});
