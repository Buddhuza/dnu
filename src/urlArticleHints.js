import { conciseDnuSummary } from './conciseSummary.js';
import { cleanHeadlinePrefix } from './headlineText.js';

const genericSegments = /^(?:news|article|articles|story|stories|world|europe|politics|latest|live|amp|en|a-?\d+|\d+)$/i;
const abbreviations = new Set(['osce', 'eu', 'un', 'nato', 'us', 'uk', 'ecb', 'imf', 'g7', 'g20', 'icc']);
const knownHosts = new Map([['bbc.co.uk', 'BBC'], ['bbc.com', 'BBC'], ['apnews.com', 'AP'], ['dw.com', 'DW'], ['reuters.com', 'Reuters'], ['aljazeera.com', 'Al Jazeera'], ['theguardian.com', 'The Guardian'], ['rte.ie', 'RTÉ']]);

function publicationDate(path) {
  const match = path.match(/(?:^|[\/-])(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})(?:[\/-]|$)/);
  if (!match) return '';
  const [, year, month, day] = match;
  const value = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const date = new Date(`${value}T12:00:00Z`);
  return date.toISOString().slice(0, 10) === value ? value : '';
}

function sourceFromHost(hostname, sources) {
  const host = hostname.replace(/^(?:www|m|amp)\./i, '').toLowerCase();
  const known = sources.find(source => {
    try {
      const publisher = new URL(source.url).hostname.replace(/^(?:www|m|amp)\./i, '').toLowerCase();
      return host === publisher || host.endsWith(`.${publisher}`);
    } catch { return false; }
  });
  if (known) return known.name;
  if (host === 'news.google.com') return '';
  const familiar = [...knownHosts].find(([domain]) => host === domain || host.endsWith(`.${domain}`));
  if (familiar) return familiar[1];
  const label = host.split('.')[0].replace(/^the(?=[a-z])/, 'The ');
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
}

function titleFromPath(pathname) {
  const segments = pathname.split('/').filter(Boolean).map(segment => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  const slug = [...segments].reverse().map(segment => segment.replace(/\.(?:html?|aspx?|php)$/i, ''))
    .find(segment => /[-_]/.test(segment) && !genericSegments.test(segment) && /[a-z]{3}/i.test(segment) && !/^[a-z]{1,3}-?[a-z0-9]{12,}$/i.test(segment));
  if (!slug) return '';
  const cleaned = slug.replace(/^exclusive[-_]/i, '').replace(/[-_]?20\d{2}[-_]\d{1,2}[-_]\d{1,2}$/i, '')
    .replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.split(' ').length < 3) return '';
  return cleanHeadlinePrefix(cleaned.split(' ').map((word, index) => abbreviations.has(word.toLowerCase())
    ? word.toUpperCase() : index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word).join(' '));
}

export function articleHintsFromUrl(value, sources = []) {
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('Enter a public HTTPS article URL.');
  return { title: titleFromPath(url.pathname), sourceName: sourceFromHost(url.hostname, sources), summary: '', date: publicationDate(url.pathname) };
}

function decodeHtml(value) {
  return String(value || '').replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|nbsp|lt|gt);/gi, (whole, name) => {
    const named = { amp: '&', quot: '"', apos: "'", nbsp: ' ', lt: '<', gt: '>' };
    if (name[0] === '#') {
      const number = name[1]?.toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : whole;
    }
    return named[name.toLowerCase()] || whole;
  }).replace(/\s+/g, ' ').trim();
}

export function articleHintsFromHtml(html) {
  const tags = String(html || '').slice(0, 250_000).match(/<meta\b[^>]*>/gi) || [];
  const metadata = new Map();
  for (const tag of tags) {
    const attributes = new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/gis)].map(([, key, , value]) => [key.toLowerCase(), decodeHtml(value)]));
    const key = (attributes.get('property') || attributes.get('name') || '').toLowerCase();
    if (key && attributes.get('content')) metadata.set(key, attributes.get('content'));
  }
  const titleTag = String(html || '').slice(0, 250_000).match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  const title = cleanHeadlinePrefix(metadata.get('og:title') || metadata.get('twitter:title') || decodeHtml(titleTag));
  const description = metadata.get('og:description') || metadata.get('description') || '';
  const suggested = description.toLowerCase().replace(/[^a-z0-9]/g, '') === title.toLowerCase().replace(/[^a-z0-9]/g, '') ? '' : conciseDnuSummary(description, title);
  const summary = suggested.split(/\s+/).length <= 25 && !suggested.endsWith('?') ? suggested : '';
  const rawDate = metadata.get('article:published_time') || metadata.get('datepublished') || '';
  const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) && Number.isFinite(Date.parse(rawDate)) ? rawDate.slice(0, 10) : '';
  return { title, sourceName: metadata.get('og:site_name') || '', summary, date };
}

export async function articleHintsFromPage(value, fetchImpl = fetch) {
  const response = await fetchImpl(value, { mode: 'cors', credentials: 'omit', redirect: 'follow', headers: { Accept: 'text/html' }, signal: AbortSignal.timeout(7000) });
  if (!response.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('Page metadata is unavailable.');
  if (Number(response.headers.get('content-length') || 0) > 2_000_000) throw new Error('Page metadata is unavailable.');
  return articleHintsFromHtml(await response.text());
}
