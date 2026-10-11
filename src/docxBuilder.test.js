import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import { reportFilename } from './reportFilename.js';

test('browser report download creates a readable Word file with country headings', async () => {
  const template = readFileSync(new URL('../public/daily-update-template.docx', import.meta.url));
  const output = await createReportDocxFromTemplate(template, {
    title: 'DAILY NEWS UPDATE', coverageNote: 'This coverage note must not appear.',
    articles: [{ section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Belgium', title: 'Exact headline', summary: 'A factual second sentence.', sourceName: 'Agency', url: 'https://example.com/story' }]
  });
  assert.ok(output instanceof Uint8Array);
  const zip = await JSZip.loadAsync(output);
  const document = await zip.file('word/document.xml').async('string');
  assert.match(document, /BELGIUM/);
  assert.doesNotMatch(document.split('WESTERN / CENTRAL EUROPE')[0].split('<w:p>').at(-1), /<w:shd/);
  assert.match(document.split('BELGIUM')[0].split('<w:p>').at(-1), /<w:shd[^>]*w:fill="D9E2F3"/);
  assert.match(document, /Exact headline/);
  assert.doesNotMatch(document, /COVERAGE NOTE|This coverage note must not appear/);
  assert.match(document, /<w:tblpPr[^>]*w:tblpYSpec="bottom"/);
  assert.match(document, /<w:tblBorders><w:top w:val="single"/);
  assert.match(document, /Disclaimer:/);
  assert.match(document, /This product is based on open media sources only/);
  assert.match(document, /We would like to remind all our recipients/);
  assert.ok(document.indexOf('Disclaimer:') > document.indexOf('Exact headline'));
  assert.match(await zip.file('word/_rels/document.xml.rels').async('string'), /https:\/\/example.com\/story/);
});

test('download filename includes the local generation date and time', () => {
  assert.equal(reportFilename(new Date(2026, 9, 11, 14, 7)), 'Daily news update - 2026-10-11 14-07.docx');
});
