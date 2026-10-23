import JSZip from 'jszip';
import { MISCELLANEOUS_COUNTRIES, NEWS_SECTIONS } from './newsSections.js';
import { displaySourceName } from './sourceNames.js';
import { reportHeadingLabel } from './reportLabels.js';

export const SPREADSHEET_COLUMNS = ['Date', 'Source', 'Region', 'Countries', 'Local Regions', 'Organizations', 'Themes', 'Types', 'Source URL', 'Heading', 'Body'];
const exportRegions = {
  'MIDDLE EAST / NORTH AFRICA': 'Middle East',
  'WESTERN / CENTRAL EUROPE': 'Europe',
  'RUSSIA / EURASIA': 'Eurasia',
  'NORTH EAST ASIA': 'North East Asia',
  'NORTH AMERICA': 'North America',
  'INTERNATIONAL ORGANISATIONS': ''
};
const countryNames = [...new Set([...NEWS_SECTIONS.slice(1, 5).flatMap(section => section.subsections), ...Object.values(MISCELLANEOUS_COUNTRIES).flat()])]
  .filter(name => !MISCELLANEOUS_COUNTRIES['INTERNATIONAL ORGANISATIONS'].includes(name) && !['Serbia / Kosovo', 'Moldova / Transdniestria', 'Georgia / Abkhazia / South Ossetia'].includes(name));
const aliases = {
  'United States': /\b(?:United States|U\.S\.|America|American|Washington|Pentagon|White House)\b/i,
  'United Kingdom': /\b(?:United Kingdom|U\.K\.|UK|Britain|British|London)\b/i,
  'South Korea': /\b(?:South Korea|South Korean|Seoul)\b/i,
  'North Korea': /\b(?:North Korea|North Korean|Pyongyang)\b/i,
  'Türkiye': /\b(?:Türkiye|Turkey|Turkish|Ankara|Erdoğan|Erdogan)\b/i,
  'Ukraine': /\b(?:Ukraine|Ukrainian|Kyiv|Kiev|Zelensky\w*)\b/i,
  'Russia': /\b(?:Russia|Russian|Moscow|Kremlin|Putin)\b/i,
  'Iran': /\b(?:Iran|Iranian|Tehran)\b/i,
  'Israel': /\b(?:Israel|Israeli|Jerusalem|Gaza|West Bank|Palestin\w*)\b/i,
  'Serbia': /\b(?:Serbia|Serbian|Belgrade)\b/i,
  'Moldova': /\b(?:Moldova|Moldovan|Chișinău|Chisinau)\b/i,
  'Georgia': /\b(?:Georgia|Georgian|Tbilisi)\b/i,
  'Kazakhstan': /\b(?:Kazakhstan|Kazakh|Astana)\b/i,
  'Kyrgyzstan': /\b(?:Kyrgyzstan|Kyrgyz|Bishkek)\b/i,
  'Azerbaijan': /\b(?:Azerbaijan|Azerbaijani|Baku)\b/i,
  'Armenia': /\b(?:Armenia|Armenian|Yerevan)\b/i,
  'Albania': /\b(?:Albania|Albanian|Tirana)\b/i,
  'Bosnia and Herzegovina': /\b(?:Bosnia|Bosnian|Herzegovina|Sarajevo)\b/i,
  'Kosovo': /\b(?:Kosovo|Kosovar|Pristina|Prishtina)\b/i
};
const organisations = [
  ['OSCE', /\bOSCE\b|Organization for Security and Co-operation in Europe|Organisation for Security and Co-operation in Europe/i],
  ['EU', /\bEU\b|European Union|European Commission|European Parliament/i],
  ['UN', /\bUN\b|United Nations/i], ['NATO', /\bNATO\b/i], ['IMF', /\bIMF\b|International Monetary Fund/i],
  ['G7', /\bG7\b/], ['G20', /\bG20\b/], ['ICC', /\bICC\b|International Criminal Court/i],
  ['WTO', /\bWTO\b|World Trade Organization|World Trade Organisation/i], ['CIS', /\bCIS\b|Commonwealth of Independent States/i],
  ['CSTO', /\bCSTO\b/], ['BRICS', /\bBRICS\b/]
];
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
const column = index => { let label = ''; for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label; return label; };
const date = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value)) : '';

export function spreadsheetRow(article, page, leadOrigins = {}) {
  const original = leadOrigins[article.id];
  const section = article.sectionId || article.section;
  const subsection = article.subsection;
  const region = section === 'Miscellaneous' ? subsection : section === 'Lead stories'
    ? original?.sectionId === 'Miscellaneous' ? original.subsection : original?.sectionId && original.sectionId !== 'Lead stories' ? original.sectionId
      : subsection === 'Middle East' ? 'MIDDLE EAST / NORTH AFRICA' : NEWS_SECTIONS.slice(1, 5).find(item => item.subsections.includes(subsection))?.id || subsection
    : section;
  const initial = reportHeadingLabel(section === 'Miscellaneous' ? article.country : section === 'Lead stories' ? original?.country || original?.subsection || subsection : subsection);
  const context = `${page.heading || article.title} ${article.summary || ''} ${String(page.body || '').slice(0, 1300)}`;
  const found = new Set();
  if (initial && !organisations.some(([name]) => name === initial) && initial !== 'Middle East') found.add(initial);
  if (/\b(?:Kosovo|Kosovar|Pristina|Prishtina)\b/i.test(context)) found.add('Serbia / Kosovo');
  if (/\b(?:Transdniestria|Transnistria|Tiraspol)\b/i.test(context)) found.add('Moldova / Transdniestria');
  if (/\b(?:Abkhazia|South Ossetia)\b/i.test(context)) found.add('Georgia / Abkhazia / South Ossetia');
  for (const name of countryNames) if ((name === 'United States' && /\bUS\b/.test(context)) || (aliases[name] || new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')).test(context)) found.add(name);
  if (found.has('Serbia / Kosovo')) { found.delete('Serbia'); found.delete('Kosovo'); }
  if (found.has('Moldova / Transdniestria')) found.delete('Moldova');
  if (found.has('Georgia / Abkhazia / South Ossetia')) found.delete('Georgia');
  const organisationsFound = new Set(initial && organisations.some(([name]) => name === initial) ? [initial] : []);
  for (const [name, pattern] of organisations) if (pattern.test(context)) organisationsFound.add(name);
  const source = article.sourceName === 'IPN' && (article.sourceId === 'source-63' || /^https?:\/\/(?:www\.)?interpressnews\.ge\//i.test(article.url || ''))
    ? 'InterPressNews' : displaySourceName(article.sourceName);
  return [date(article.publishedAt || article.addedAt), source, Object.hasOwn(exportRegions, region) ? exportRegions[region] : region, [...new Set([...found].map(reportHeadingLabel))].join(', '), '', [...new Set([...organisationsFound].map(reportHeadingLabel))].join(', '), '', '', article.url, page.heading || article.title, page.body];
}

export async function createSpreadsheet(rows) {
  const zip = new JSZip();
  const all = [SPREADSHEET_COLUMNS, ...rows];
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols><col min="1" max="1" width="14" customWidth="1"/><col min="2" max="8" width="22" customWidth="1"/><col min="9" max="9" width="42" customWidth="1"/><col min="10" max="10" width="65" customWidth="1"/><col min="11" max="11" width="95" customWidth="1"/></cols><sheetData>${all.map((row, i) => `<row r="${i + 1}">${row.map((value, j) => `<c r="${column(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="News articles" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', sheet);
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}
