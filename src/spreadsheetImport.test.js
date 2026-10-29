import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { createSpreadsheet } from './spreadsheetExport.js';
import { convertSpreadsheetRows, readSpreadsheet } from './spreadsheetImport.js';
import { reportStoryText } from './reportText.js';

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

test('matching URL reuses the prepared DNU summary and direct regional placement', () => {
  const existing = { id: 'osce', url: 'https://n1info.ba/example', sourceId: 'source-8', sourceName: 'N1', title: 'OSCE chief visits regional summit', summary: 'Officials discussed election monitoring in Montenegro.', publishedAt: '2026-10-23T09:00:00Z', section: 'South Eastern Europe', subsection: '', country: '' };
  const row = { rowNumber: 2, date: '2026-10-23', source: 'N1', region: 'South Eastern Europe', countries: 'Montenegro', organisations: 'OSCE', url: existing.url, heading: 'OSCE chief visits regional summit | N1', body: 'The chief joined a meeting in Montenegro.' };
  const result = convertSpreadsheetRows([row], { existingArticles: [existing] });
  assert.equal(result.articles.length, 1);
  assert.equal(result.articles[0].summary, existing.summary);
  assert.equal(result.articles[0].subsection, '');
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
