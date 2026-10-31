import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { gzipSync } from 'node:zlib';
import { createSpreadsheet, spreadsheetRow } from './spreadsheetExport.js';
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

test('SITCEN working-data sheets supply full bodies and a short first-paragraph summary', async () => {
  const zip = new JSZip();
  zip.file('xl/workbook.xml', '<workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="2026-10-30" r:id="rId1"/><sheet name="NewsWork_A" r:id="rId2"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>');
  const url = 'https://apnews.com/article/ukraine-talks';
  const body = 'Ukraine and Russia agreed to talks. Negotiators will meet in Geneva on Friday to discuss border monitoring and prisoner exchanges.\n\nA second paragraph has less important details.';
  zip.file('xl/worksheets/sheet1.xml', `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>Date</t></is></c><c r="B1" t="inlineStr"><is><t>Source</t></is></c><c r="C1" t="inlineStr"><is><t>Headline</t></is></c><c r="D1" t="inlineStr"><is><t>Link</t></is></c><c r="E1" t="inlineStr"><is><t>Summary</t></is></c></row><row r="2"><c r="A2" t="inlineStr"><is><t>2026-10-30</t></is></c><c r="B2" t="inlineStr"><is><t>AP</t></is></c><c r="C2" t="inlineStr"><is><t>Ukraine and Russia agree to talks</t></is></c><c r="D2" t="inlineStr"><is><t>${url}</t></is></c><c r="E2" t="inlineStr"><is><t>A much longer feed summary that should not be used when the article body is available.</t></is></c></row></sheetData></worksheet>`);
  const encoded = gzipSync(JSON.stringify({ items: [{ link: `${url}?utm_source=feed`, articleBody: body }] })).toString('base64');
  const split = Math.ceil(encoded.length / 2);
  zip.file('xl/worksheets/sheet2.xml', `<worksheet><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>RunID</t></is></c><c r="B1" t="inlineStr"><is><t>Chunk</t></is></c><c r="C1" t="inlineStr"><is><t>JSON</t></is></c></row>${[encoded.slice(0, split), encoded.slice(split)].map((part, index) => `<row r="${index + 2}"><c r="A${index + 2}" t="inlineStr"><is><t>2026-10-30-1234</t></is></c><c r="B${index + 2}"><v>${index}</v></c><c r="C${index + 2}" t="inlineStr"><is><t>gzip:${part}</t></is></c></row>`).join('')}</sheetData></worksheet>`);
  const file = new File([await zip.generateAsync({ type: 'uint8array' })], 'SITCEN.xlsx');
  const rows = await readSpreadsheet(file);
  const result = convertSpreadsheetRows(rows);
  assert.equal(rows[0].body, body);
  assert.equal(result.articles[0].summary, 'Negotiators will meet in Geneva on Friday to discuss border monitoring and prisoner exchanges');
  assert.equal(result.bodies[0].body, body);
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

  const regionalStory = { ...olderImport, id: 'regional-story', title: 'North Macedonia seeks funds under EU Growth Plan for the Western Balkans' };
  const kept = displaySiteContent([regionalStory], normalizeSiteConfig({}, []));
  assert.deepEqual([kept[0].sectionId, kept[0].subsection], ['South Eastern Europe', 'North Macedonia']);
});

test('a ship attacked off Bulgaria is filed under Bulgaria, including in an older imported edition', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'Ekathimerini', region: 'International',
    countries: 'Albania; Bosnia and Herzegovina; Montenegro; North Macedonia; Serbia; Ukraine',
    url: 'https://www.ekathimerini.com/example/ship-bulgaria',
    heading: 'Greek container ship sinks after drone attack off Bulgaria',
    summary: 'Greek container ship sinks after drone attack off Bulgaria'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Bulgaria']);
  const olderImport = { ...article, sectionId: 'South Eastern Europe', section: 'South Eastern Europe', subsection: 'Albania', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []));
  assert.deepEqual([displayed[0].sectionId, displayed[0].subsection, displayed[0].country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Bulgaria']);
});

test('a region-wide OSCE conference appears before South Eastern Europe country headings', () => {
  const osceRow = {
    rowNumber: 2, date: '2026-10-30', source: 'OSCE', region: 'General',
    countries: 'Albania; Bosnia and Herzegovina; Montenegro; North Macedonia; Serbia; Kosovo',
    url: 'https://www.osce.org/example/conference',
    heading: 'OSCE Conference Highlights Need for Stronger Institutional Response to Gender-Based Hate Crime in South-East Europe',
    summary: 'Regional institutions met to discuss their response to hate crime.'
  };
  const article = convertSpreadsheetRows([osceRow]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['South Eastern Europe', '', '']);
  const olderImport = { ...article, sectionId: 'South Eastern Europe', section: 'South Eastern Europe', subsection: 'Albania' };
  const albania = { ...article, id: 'albania-story', url: 'https://example.com/albania', title: 'Albanian parliament debates reform', subsection: 'Albania' };
  const displayed = displaySiteContent([albania, olderImport], normalizeSiteConfig({}, []));
  assert.deepEqual(displayed.map(item => item.subsection), ['', 'Albania']);
});

test('a possible US strike on Iran is filed under Iran and lists both countries in export', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'News am', region: 'International',
    countries: 'Albania; Bosnia and Herzegovina; Montenegro; North Macedonia; Serbia; Ukraine',
    url: 'https://example.com/us-iran-strikes',
    heading: 'Possible US strikes on Iran in November could last several days, media report',
    summary: 'Possible US strikes on Iran in November could last several days, media report'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Iran']);
  const olderImport = { ...article, sectionId: 'South Eastern Europe', section: 'South Eastern Europe', subsection: 'Albania', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.sectionId, displayed.subsection, displayed.country], ['Miscellaneous', 'MIDDLE EAST / NORTH AFRICA', 'Iran']);
  assert.deepEqual(spreadsheetRow(displayed, { heading: article.title, body: 'US and Iranian officials discussed possible strikes.' })[3], 'Iran, US');
});

test('a Western Balkans-wide growth plan appears before South Eastern Europe country headings', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'The Region', region: 'South Eastern Europe',
    countries: 'North Macedonia', url: 'https://example.com/western-balkans-growth-plan',
    heading: 'The €6 Billion Test: EU Growth Plan for the Western Balkans',
    summary: 'The EU plan addresses growth across the Western Balkans.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection], ['South Eastern Europe', '']);
  const olderImport = { ...article, subsection: 'North Macedonia' };
  const albania = { ...article, id: 'albania-growth', url: 'https://example.com/albania-growth', title: 'Albania adopts growth plan', subsection: 'Albania' };
  const displayed = displaySiteContent([albania, olderImport], normalizeSiteConfig({}, []));
  assert.deepEqual(displayed.map(item => item.subsection), ['', 'Albania']);
});

test('a MINA statement on issues with Croatia belongs under Montenegro', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'MINA', region: 'International',
    countries: 'Bosnia and Herzegovina', url: 'https://example.com/vuksanovic-croatia',
    heading: 'Vuksanovic: Outstanding issues with Croatia must be resolved through dialogue while protecting state interest',
    summary: 'Vuksanovic called for dialogue on outstanding bilateral issues.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection], ['South Eastern Europe', 'Montenegro']);
  const olderImport = { ...article, sectionId: 'Miscellaneous', section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Croatia' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.sectionId, displayed.subsection, displayed.country], ['South Eastern Europe', 'Montenegro', '']);
  assert.deepEqual(spreadsheetRow(displayed, { heading: article.title, body: 'Montenegro and Croatia discussed bilateral issues.' })[3], 'Montenegro, Croatia');
});

test('a Kosovo arrest story uses the Serbia / Kosovo heading', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'Kosovo Online', region: 'South Eastern Europe',
    countries: 'Kosovo; Serbia', url: 'https://example.com/kosovo-arrests',
    heading: 'Serb List: Continued persecution of Serbs in Kosovo, war crimes arrests without a single piece of evidence',
    summary: 'Serb List criticised arrests in Kosovo.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection], ['South Eastern Europe', 'Serbia / Kosovo']);
  const olderImport = { ...article, subsection: 'Serbia' };
  assert.equal(displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0].subsection, 'Serbia / Kosovo');
});

test('a Lithuania defence purchase is filed under Lithuania despite a generic country list', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'LRT', region: 'International',
    countries: 'Belarus; Moldova; Ukraine; Armenia; Azerbaijan; Georgia; Kazakhstan',
    url: 'https://www.lrt.lt/en/news-in-english/lithuania-palantir',
    heading: 'Lithuania considers buying Palantir AI system for armed forces',
    summary: 'Lithuania is considering a purchase for its armed forces.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Lithuania']);
  const olderImport = { ...article, sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Belarus', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.sectionId, displayed.subsection, displayed.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Lithuania']);
});

test('an LRT report on the Baltic states anti-drone request is filed under Lithuania', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'LRT', region: 'International',
    countries: 'Belarus; Moldova; Ukraine; Armenia; Azerbaijan; Georgia; Kazakhstan',
    url: 'https://www.lrt.lt/en/news-in-english/baltic-anti-drone-request',
    heading: 'Brussels rejects Baltic states’ €500 million anti-drone request, suggests borrowing',
    summary: 'The European Commission responded to a request by Lithuania, Latvia and Estonia for anti-drone defences.'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Lithuania']);
  const olderImport = { ...article, sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Belarus', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.sectionId, displayed.subsection, displayed.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Lithuania']);
  assert.deepEqual(spreadsheetRow(displayed, { heading: article.title, body: row.summary })[3], 'Lithuania, Estonia, Latvia');
});

test('a Greek PM statement on Turkey and Libya belongs under Greece', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'Reuters', region: 'International',
    countries: 'Ukraine; Georgia; Armenia; Azerbaijan', url: 'https://example.com/greek-pm',
    heading: "EXCLUSIVE: Greek PM calls Turkey-Libya maritime deal 'void;' calls for global truce after Black Sea attacks",
    summary: "EXCLUSIVE: Greek PM calls Turkey-Libya maritime deal 'void;' calls for global truce after Black Sea attacks"
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Greece']);
  const olderImport = { ...article, subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Libya' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.subsection, displayed.country], ['WESTERN / CENTRAL EUROPE', 'Greece']);
});

test('Estonian bunkers along the Russian border belong under Estonia', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'Kyiv Independent', region: 'International',
    countries: 'Armenia; Azerbaijan; Georgia; Kazakhstan; Kyrgyzstan; Tajikistan',
    url: 'https://example.com/estonian-bunkers',
    heading: 'Estonia to build 150 bunkers along Russian border',
    summary: 'Estonia to build 150 bunkers along Russian border'
  };
  const article = convertSpreadsheetRows([row]).articles[0];
  assert.deepEqual([article.sectionId, article.subsection, article.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Estonia']);
  const olderImport = { ...article, sectionId: 'South Caucasus', section: 'South Caucasus', subsection: 'Armenia', country: '' };
  const displayed = displaySiteContent([olderImport], normalizeSiteConfig({}, []))[0];
  assert.deepEqual([displayed.sectionId, displayed.subsection, displayed.country], ['Miscellaneous', 'WESTERN / CENTRAL EUROPE', 'Estonia']);
});

test('a broad summit preview is omitted from imported and displayed editions', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'UzDaily', region: 'International',
    countries: 'Armenia; Azerbaijan; Kazakhstan; Kyrgyzstan; Uzbekistan',
    url: 'https://www.uzdaily.uz/en/critical-developments-turkic-summit/',
    heading: 'Critical developments ahead of the 13th Summit of the Organization of Turkic States: Strategic partnerships and shifting balances in Eurasia',
    summary: 'Leaders gathered in Ankara for the summit.'
  };
  const result = convertSpreadsheetRows([row]);
  assert.equal(result.articles.length, 0);
  assert.match(result.skipped[0].reason, /Broad analytical summit preview/);
  const olderImport = { id: 'older-summit', title: row.heading, summary: row.summary, url: row.url, sourceName: row.source, sectionId: 'Central Asia', section: 'Central Asia', subsection: 'Uzbekistan', fromSpreadsheet: true };
  assert.deepEqual(displaySiteContent([olderImport], normalizeSiteConfig({}, [])), []);
});

test('Why headlines and Mehriban Aliyeva stories are omitted from import and display', () => {
  const rows = [
    { rowNumber: 2, date: '2026-10-30', source: 'Azernews', region: 'South Caucasus', countries: 'Azerbaijan', url: 'https://example.com/why-summit', heading: 'Why President Aliyev’s absence from Turkic Summit matters more than it seems' },
    { rowNumber: 3, date: '2026-10-30', source: 'Trend', region: 'South Caucasus', countries: 'Azerbaijan', url: 'https://example.com/mehriban', heading: 'First Vice-President Mehriban Aliyeva attended performance of The Seagull' },
    { rowNumber: 4, date: '2026-10-30', source: 'Trend', region: 'South Caucasus', countries: 'Azerbaijan', url: 'https://example.com/vice-president-event', heading: 'First vice-president attends cultural event', summary: 'Mehriban Aliyeva attended the performance.' }
  ];
  const result = convertSpreadsheetRows(rows);
  assert.equal(result.articles.length, 0);
  assert.deepEqual(result.skipped.map(item => item.reason), ['Why headlines are excluded', 'Mehriban Aliyeva stories are excluded', 'Mehriban Aliyeva stories are excluded']);
  const old = rows.map(row => ({ id: row.url, url: row.url, title: row.heading, summary: row.summary || '', sourceName: row.source, sectionId: 'South Caucasus', section: 'South Caucasus', subsection: 'Azerbaijan', fromSpreadsheet: true }));
  assert.deepEqual(displaySiteContent(old, normalizeSiteConfig({}, [])), []);
});

test('Expert Says commentary is omitted from import and the displayed update', () => {
  const row = {
    rowNumber: 2, date: '2026-10-30', source: 'Astana Times', region: 'Central Asia',
    countries: 'Kazakhstan', url: 'https://astanatimes.com/example/tokayev-wages',
    heading: 'Tokayev’s Wage, Digital Economy Reforms Must Protect Workers’ Rights, Expert Says',
    summary: 'An academic argued for stronger labour protections after the president announced reforms.'
  };
  const result = convertSpreadsheetRows([row]);
  assert.equal(result.articles.length, 0);
  assert.equal(result.skipped[0].reason, 'Expert commentary is excluded');
  const olderStory = { id: 'tokayev-expert', title: row.heading, summary: row.summary, sourceName: row.source, url: row.url, sectionId: 'Central Asia', section: 'Central Asia', subsection: 'Kazakhstan', fromSpreadsheet: true };
  assert.deepEqual(displaySiteContent([olderStory], normalizeSiteConfig({}, [])), []);
});

test('official government rows are skipped even when Google News masks their original host', () => {
  const rows = [
    { rowNumber: 2, date: '2026-10-30', source: 'GOV.UK', region: 'Europe', countries: 'UK', url: 'https://news.google.com/rss/articles/uk-statement', heading: 'UK issues statement on OSCE meeting' },
    { rowNumber: 3, date: '2026-10-30', source: 'Turkmenistan government', region: 'Central Asia', countries: 'Turkmenistan', url: 'https://news.google.com/rss/articles/tm-education', heading: 'Minister of Education of Turkmenistan Participates in Roundtable of Central Asian Education Ministers in Tashkent' },
    { rowNumber: 4, date: '2026-10-30', source: 'BBC', region: 'Europe', countries: 'UK', url: 'https://bbc.com/news/independent-story', heading: 'UK government responds to OSCE meeting' }
  ];
  const result = convertSpreadsheetRows(rows);
  assert.deepEqual(result.articles.map(article => article.sourceName), ['BBC']);
  assert.deepEqual(result.skipped.map(item => item.reason), ['Direct government publication', 'Direct government publication']);
});

test('live blogs are excluded even when their headline names a concrete event', () => {
  const rows = [
    { rowNumber: 2, date: '2026-10-30', source: 'Al Jazeera', region: 'Middle East', countries: 'Iran', url: 'https://www.aljazeera.com/news/liveblog/2026/10/30/iran-war', heading: 'Iran war live: IRGC says four tankers struck mines in Strait of Hormuz' },
    { rowNumber: 3, date: '2026-10-30', source: 'Al Jazeera', region: 'Middle East', countries: 'Iran', url: 'https://www.aljazeera.com/news/liveblog/2026/10/30/another', heading: 'IRGC reports tanker strikes in Strait of Hormuz' }
  ];
  const result = convertSpreadsheetRows(rows);
  assert.equal(result.articles.length, 0);
  assert.deepEqual(result.skipped.map(item => item.reason), ['Live blogs are excluded', 'Live blogs are excluded']);
  const olderStory = { id: 'liveblog', title: rows[0].heading, url: rows[0].url, sourceName: rows[0].source, sectionId: 'Miscellaneous', section: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Iran', fromSpreadsheet: true };
  assert.deepEqual(displaySiteContent([olderStory], normalizeSiteConfig({}, [])), []);
});
