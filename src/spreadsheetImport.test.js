import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createSpreadsheet } from './spreadsheetExport.js';
import { convertSpreadsheetRows, readSpreadsheet } from './spreadsheetImport.js';
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
