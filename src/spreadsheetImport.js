import JSZip from 'jszip';
import sax from 'sax';
import { franc } from 'franc-min';
import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from './newsSections.js';
import { canonicalArticleUrl } from './siteConfig.js';
import { viennaWallTimeToIso } from './viennaTime.js';
import { blockedPlacementReason } from './sourcePolicy.js';
import { excludedHeadlineReason } from './headlinePolicy.js';
import { articlePlacement } from '../server/importArticle.js';

const headerAliases = {
  date: ['date', 'publicationdate', 'publishedat'],
  source: ['source', 'agency', 'publisher'],
  region: ['region', 'section'],
  countries: ['countries', 'country'],
  organisations: ['organizations', 'organisations', 'organization', 'organisation'],
  url: ['sourceurl', 'url', 'articleurl', 'link', 'hyperlink'],
  heading: ['heading', 'headline', 'title'],
  summary: ['summary', 'description'],
  body: ['body', 'articlebody', 'articletext', 'fulltext', 'text']
};
const compact = value => String(value ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
const text = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const first = value => String(value ?? '').split(/[,;]/).map(text).find(Boolean) || '';
const regionalSections = NEWS_SECTIONS.slice(1, 5);
const miscRegions = new Map([
  ['europe', 'WESTERN / CENTRAL EUROPE'], ['westerncentraleurope', 'WESTERN / CENTRAL EUROPE'],
  ['middleeast', 'MIDDLE EAST / NORTH AFRICA'], ['middleeastnorthafrica', 'MIDDLE EAST / NORTH AFRICA'],
  ['eurasia', 'RUSSIA / EURASIA'], ['russiaeurasia', 'RUSSIA / EURASIA'],
  ['afghanistanpakistan', 'AFGHANISTAN / PAKISTAN'], ['northeastasia', 'NORTH EAST ASIA'],
  ['northamerica', 'NORTH AMERICA'], ['internationalorganisations', 'INTERNATIONAL ORGANISATIONS'],
  ['internationalorganizations', 'INTERNATIONAL ORGANISATIONS']
]);

function readSharedStrings(xml = '') {
  const strings = [];
  if (!xml) return strings;
  const parser = sax.parser(true);
  let entry = null, reading = false;
  parser.onopentag = node => {
    const tag = node.name.split(':').at(-1);
    if (tag === 'si') entry = '';
    if (tag === 't' && entry !== null) reading = true;
  };
  parser.ontext = value => { if (reading) entry += value; };
  parser.oncdata = value => { if (reading) entry += value; };
  parser.onclosetag = name => {
    const tag = name.split(':').at(-1);
    if (tag === 't') reading = false;
    if (tag === 'si') { strings.push(entry); entry = null; }
  };
  parser.write(xml).close();
  return strings;
}

function readWorksheet(xml, sharedStrings) {
  const rows = [];
  const parser = sax.parser(true);
  let row = null, cell = null, reading = false;
  parser.onopentag = node => {
    const tag = node.name.split(':').at(-1);
    if (tag === 'row') row = [];
    if (tag === 'c' && row) cell = { index: columnIndex(String(node.attributes.r || '')), type: node.attributes.t, value: '' };
    if (cell && (tag === 'v' || tag === 't')) reading = true;
  };
  parser.ontext = value => { if (reading && cell) cell.value += value; };
  parser.oncdata = value => { if (reading && cell) cell.value += value; };
  parser.onclosetag = name => {
    const tag = name.split(':').at(-1);
    if (tag === 'v' || tag === 't') reading = false;
    if (tag === 'c' && cell && row) {
      row[cell.index ?? row.length] = cell.type === 's' ? sharedStrings[Number(cell.value)] ?? '' : cell.value;
      cell = null;
    }
    if (tag === 'row' && row) { rows.push(row); row = null; }
  };
  parser.write(xml).close();
  return rows;
}

function columnIndex(reference) {
  const label = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!label) return null;
  return [...label].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function readCsv(value) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === '"' && quoted && value[index + 1] === '"') { cell += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && value[index + 1] === '\n') index++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

export async function readSpreadsheet(file) {
  if (file.size > 15_000_000) throw new Error('Choose a spreadsheet smaller than 15 MB.');
  let rows;
  if (/\.csv$/i.test(file.name)) rows = readCsv(await file.text());
  else if (/\.xlsx$/i.test(file.name)) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const sheetName = Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort((a, b) => Number(a.match(/sheet(\d+)/i)[1]) - Number(b.match(/sheet(\d+)/i)[1]))[0];
    if (!sheetName) throw new Error('No worksheet was found in this Excel file.');
    const shared = zip.file('xl/sharedStrings.xml') ? readSharedStrings(await zip.file('xl/sharedStrings.xml').async('string')) : [];
    rows = readWorksheet(await zip.file(sheetName).async('string'), shared);
  } else throw new Error('Choose an .xlsx or .csv spreadsheet.');
  const headerIndex = rows.findIndex(row => Object.values(headerAliases).some(aliases => row.some(value => aliases.includes(compact(value)))));
  if (headerIndex < 0) throw new Error('No column headings were found.');
  const header = rows[headerIndex].map(compact);
  const indexes = Object.fromEntries(Object.entries(headerAliases).map(([key, aliases]) => [key, header.findIndex(value => aliases.includes(value))]));
  if (['source', 'url', 'heading'].some(key => indexes[key] < 0)) throw new Error('The sheet needs Source, Source URL, and Heading columns.');
  return rows.slice(headerIndex + 1).map((row, index) => ({ rowNumber: headerIndex + index + 2,
    ...Object.fromEntries(Object.entries(indexes).map(([key, column]) => [key, column >= 0 ? String(row[column] ?? '').trim() : '']))
  })).filter(row => Object.values(row).some((value, index) => index > 0 && value));
}

function spreadsheetDate(value, fallback) {
  const raw = text(value);
  let dateOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!dateOnly && /^\d{5}(?:\.\d+)?$/.test(raw)) {
    const date = new Date(Date.UTC(1899, 11, 30) + Number(raw) * 86_400_000);
    dateOnly = date.toISOString().slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  }
  if (dateOnly) return viennaWallTimeToIso(...dateOnly.slice(1).map(Number), 12);
  return Number.isFinite(Date.parse(raw)) ? new Date(raw).toISOString() : fallback;
}

function cleanHeading(heading, source, url) {
  const title = text(heading);
  let host = '';
  try { host = new URL(url).hostname.replace(/^www\./, '').split('.')[0]; } catch { /* URL is checked separately. */ }
  const brand = compact(source), domain = compact(host);
  return title.replace(/\s+[|–-]\s+([^|–-]+)$/, (whole, suffix) => {
    const tail = compact(suffix);
    return tail === brand || tail.includes(brand) && brand.length > 3 || tail.includes(domain) && domain.length > 4 ? '' : whole;
  }).trim();
}

function summaryFromBody(body, headline) {
  const paragraphs = String(body || '').split(/\n\s*\n/).map(text).filter(Boolean).slice(0, 2);
  const headlineTerms = new Set((headline.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word => !['this', 'that', 'from', 'with', 'have', 'into'].includes(word)));
  const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
  for (const paragraph of paragraphs) {
    for (const { segment } of segmenter.segment(paragraph.replace(/^[A-Z][A-Z ]{1,35},?\s+\d{1,2}\s+[A-Z][a-z]+\s*\([^)]*\)\s*[-–]\s*/, ''))) {
      const sentence = segment.trim();
      const words = sentence.split(/\s+/);
      if (words.length < 8 || words.length > 45 || /[?]$/.test(sentence)) continue;
      const terms = (sentence.toLowerCase().match(/[a-z]{4,}/g) || []).filter(word => !headlineTerms.has(word));
      if (terms.length >= 5) return sentence.replace(/[.!]+$/, '');
    }
  }
  return '';
}

function placementFromRow(row, title, summary, existing, leadPrefix) {
  if (existing) return { sectionId: existing.sectionId || existing.section, subsection: existing.subsection || '', country: existing.country || '' };
  const region = text(row.region);
  const regional = regionalSections.find(section => compact(section.id) === compact(region));
  const countries = String(row.countries || '').split(/[,;]/).map(text).filter(Boolean);
  const organisations = String(row.organisations || '').split(/[,;]/).map(text).filter(Boolean);
  const normalizeCountry = value => ({ US: 'United States', UK: 'United Kingdom', UN: 'UN' })[value] || value;
  if (regional) {
    const subsection = countries.map(normalizeCountry).find(name => regional.subsections.includes(name)) || regional.subsections.find(name => new RegExp(`\\b${name}\\b`, 'i').test(title));
    if (subsection) return leadPrefix ? { sectionId: 'Lead stories', subsection, country: '' } : { sectionId: regional.id, subsection, country: '' };
  }
  const misc = miscRegions.get(compact(region)) || (!region && organisations.length ? 'INTERNATIONAL ORGANISATIONS' : '');
  if (misc) {
    const country = misc === 'INTERNATIONAL ORGANISATIONS'
      ? organisations.find(name => MISCELLANEOUS_COUNTRIES[misc].includes(name))
      : countries.map(normalizeCountry).find(name => MISCELLANEOUS_COUNTRIES[misc]?.includes(name));
    if (country) return leadPrefix && misc === 'MIDDLE EAST / NORTH AFRICA'
      ? { sectionId: 'Lead stories', subsection: 'Middle East', country: '' }
      : { sectionId: 'Miscellaneous', subsection: misc, country };
  }
  return articlePlacement({}, title, summary);
}

export function convertSpreadsheetRows(rows, { existingArticles = [], sources = [], importedAt = new Date().toISOString() } = {}) {
  const existingByUrl = new Map(existingArticles.map(article => [canonicalArticleUrl(article.url), article]));
  const sourceByName = new Map(sources.map(source => [compact(source.name), source]));
  const sourceByHost = new Map(sources.flatMap(source => {
    try { return [[new URL(source.url).hostname.replace(/^www\./, '').toLowerCase(), source]]; }
    catch { return []; }
  }));
  const seen = new Set();
  const articles = [], bodies = [], skipped = [];
  const firstRegional = rows.findIndex(row => compact(row.region) === 'southeasterneurope');
  for (const [index, row] of rows.entries()) {
    const url = text(row.url);
    let parsed;
    try { parsed = new URL(url); if (parsed.protocol !== 'https:') throw new Error(); }
    catch { skipped.push({ row: row.rowNumber, reason: 'Missing or invalid HTTPS article link' }); continue; }
    const key = canonicalArticleUrl(parsed.href);
    if (seen.has(key)) { skipped.push({ row: row.rowNumber, reason: 'Repeated article link' }); continue; }
    seen.add(key);
    const existing = existingByUrl.get(key);
    const sourceName = text(row.source) || existing?.sourceName;
    const title = existing?.title || cleanHeading(row.heading, sourceName, url);
    if (!sourceName || !title) { skipped.push({ row: row.rowNumber, reason: 'Missing source or headline' }); continue; }
    if (excludedHeadlineReason(title)) { skipped.push({ row: row.rowNumber, reason: excludedHeadlineReason(title) }); continue; }
    if (!existing && row.body && !['eng', 'und'].includes(franc(row.body.slice(0, 1500), { minLength: 100 }))) {
      skipped.push({ row: row.rowNumber, reason: 'Article body is not English; translate it before import' }); continue;
    }
    const summary = text(row.summary) || existing?.summary || summaryFromBody(row.body, title);
    const leadPrefix = firstRegional > 0 && index < firstRegional;
    const placement = placementFromRow(row, title, summary, existing, leadPrefix);
    if (!placement?.sectionId || !placement.subsection && placement.sectionId !== 'South Eastern Europe' || placement.sectionId === 'Miscellaneous' && !placement.country) {
      skipped.push({ row: row.rowNumber, reason: 'Could not identify a DNU section and country or organisation' }); continue;
    }
    const source = sourceByHost.get(parsed.hostname.replace(/^www\./, '').toLowerCase()) || sourceByName.get(compact(sourceName));
    const article = {
      id: existing?.id || `spreadsheet-${key}`, url: parsed.href, sourceId: existing?.sourceId || source?.id || 'spreadsheet', sourceName,
      title, summary, originalHeadline: existing?.originalHeadline || text(row.heading), translated: existing?.translated === true,
      publishedAt: existing?.publishedAt || spreadsheetDate(row.date, importedAt),
      reviewed: true, ...placement
    };
    const restriction = blockedPlacementReason(article);
    if (restriction) { skipped.push({ row: row.rowNumber, reason: restriction }); continue; }
    articles.push(article);
    if (text(row.body)) bodies.push({ url: parsed.href, heading: text(row.heading), body: String(row.body), translated: article.translated });
  }
  return { articles, bodies, skipped };
}
