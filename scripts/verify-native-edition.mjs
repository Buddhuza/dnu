import assert from 'node:assert/strict';
import { readCompletedEdition, storedBody } from '../server/nativeEdition.js';
import { defaultSiteConfig, displaySiteContent } from '../src/siteConfig.js';
import { createReportDocx } from '../server/report.js';
import { createSpreadsheet, spreadsheetRow } from '../src/spreadsheetExport.js';

const edition = readCompletedEdition(process.argv[2]);
assert.equal(edition.nativeEdition, true, 'The completed JSON must come from the native collector.');
assert.ok(edition.articles.length > 0, 'The completed edition must have visible articles.');
const visible = displaySiteContent(edition.articles, defaultSiteConfig(edition.articles));
assert.ok(visible.length > 0, 'The app must render at least one native article.');
assert.ok(visible.every(article => article.title && article.url && article.sectionId && article.subsection));
const word = await createReportDocx({ ...edition, articles: visible });
assert.ok(Buffer.from(word).length > 1000, 'Word export must contain the native edition.');
const withBody = visible.find(article => storedBody(article));
assert.ok(withBody, 'The native edition must offer at least one full article body for export.');
const row = spreadsheetRow(withBody, storedBody(withBody), edition.leadOrigins || {});
assert.equal(row.at(-1), withBody.body);
const spreadsheet = await createSpreadsheet([row]);
assert.ok(spreadsheet.size > 1000, 'Excel export must contain a native full article.');
console.log(JSON.stringify({
  checkedAt: edition.checkedAt, selected: edition.articles.length, visible: visible.length,
  bodies: edition.articles.filter(article => storedBody(article)).length,
  failedRoutes: edition.sourceOutcomes.filter(route => route.status === 'failed').length,
  wordBytes: Buffer.from(word).length, spreadsheetBytes: spreadsheet.size
}));
