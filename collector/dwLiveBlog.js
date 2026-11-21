import { createHash } from 'node:crypto';
import { load } from 'cheerio';

export function isDwLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return /^https:$/.test(parsed.protocol) && /^(?:www\.)?dw\.com$/i.test(parsed.hostname)
      && /\/live-\d+(?:\/|$)/.test(parsed.pathname);
  } catch { return false; }
}

function explicitTime(value) {
  const text = String(value || '').trim();
  if (!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)$/i.test(text)) return '';
  const time = new Date(text);
  return Number.isFinite(time.getTime()) ? time.toISOString() : '';
}

function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
function bodyText(value) {
  const raw = String(value || '');
  if (!/<[a-z][\s\S]*>/i.test(raw)) return text(raw);
  const $ = load(raw);
  const paragraphs = $('p').toArray().map(node => text($(node).text())).filter(Boolean);
  return paragraphs.length ? paragraphs.join('\n\n') : text($.root().text());
}

function entryUrl(parentUrl, suppliedUrl, id) {
  const parent = new URL(parentUrl);
  const url = typeof suppliedUrl === 'string' && suppliedUrl ? new URL(suppliedUrl, parent) : new URL(parent);
  if (!isDwLiveBlog(url.href) || url.pathname !== parent.pathname) return '';
  const anchor = url.hash.slice(1) || id;
  if (!anchor || !/^[\w-]{2,120}$/.test(anchor)) return '';
  url.searchParams.delete('maca');
  url.searchParams.set('dnu-update', anchor);
  url.hash = anchor;
  return url.href;
}

function jsonEntries(html) {
  const $ = load(html);
  const entries = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    let value;
    try { value = JSON.parse($(script).html()); } catch { return; }
    const visit = node => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      if (node.liveBlogUpdate) entries.push(...[].concat(node.liveBlogUpdate));
      if (node['@graph']) visit(node['@graph']);
    };
    visit(value);
  });
  return entries.map(entry => ({
    title: text(entry.headline || entry.name), published: entry.datePublished || entry.dateCreated,
    body: bodyText(entry.articleBody || entry.text || entry.description),
    url: entry.url || entry['@id'] || '', id: entry.identifier || ''
  }));
}

function embeddedStateEntries(html) {
  const $ = load(html);
  const entries = [];
  $('script').each((_, script) => {
    const source = $(script).html() || '';
    const marker = source.indexOf('window.__APP_STATE__=');
    if (marker < 0) return;
    const start = source.indexOf('{', marker);
    if (start < 0) return;
    let depth = 0, quoted = false, escaped = false, end = -1;
    for (let index = start; index < source.length; index++) {
      const character = source[index];
      if (escaped) { escaped = false; continue; }
      if (quoted && character === '\\') { escaped = true; continue; }
      if (character === '"') { quoted = !quoted; continue; }
      if (quoted) continue;
      if (character === '{') depth++;
      if (character === '}' && --depth === 0) { end = index + 1; break; }
    }
    if (end < 0) return;
    let state;
    try { state = JSON.parse(source.slice(start, end)); } catch { return; }
    const visit = node => {
      if (Array.isArray(node)) { node.forEach(visit); return; }
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node.posts)) for (const post of node.posts) {
        if (post?.__typename !== 'LiveblogElement' || !Number.isSafeInteger(post.id)) continue;
        entries.push({ title: text(post.title), published: post.firstPublicationDate || post.contentDate,
          body: bodyText(post.text), id: `post-liveblog-post-${post.id}`, url: '' });
      }
      for (const [key, value] of Object.entries(node)) if (key !== 'posts' && value && typeof value === 'object') visit(value);
    };
    visit(state);
  });
  return entries;
}

function domEntries(html) {
  const $ = load(html);
  const entries = [];
  $('time[datetime]').each((_, timeNode) => {
    const published = $(timeNode).attr('datetime');
    if (!explicitTime(published)) return;
    let container = $(timeNode).closest('article, section, [data-id], [data-testid*="live"], [id]');
    while (container.length && container.find('time[datetime]').length !== 1) {
      container = container.parent().closest('article, section, [data-id], [data-testid*="live"], [id]');
    }
    if (!container.length) return;
    const heading = container.find('h2, h3, h4').first();
    const title = text(heading.text());
    const body = container.find('p').toArray().map(node => text($(node).text())).filter(Boolean).join('\n\n');
    const id = container.attr('id') || container.attr('data-id') || heading.attr('id')
      || container.find('[id]').first().attr('id') || '';
    entries.push({ title, published, body, id, url: '' });
  });
  return entries;
}

export function extractDwLiveBlogEntries(html, parent) {
  if (!isDwLiveBlog(parent?.link) || !html) return [];
  const parentTitle = text(parent.headline).toLowerCase();
  const seen = new Set();
  const entries = [...embeddedStateEntries(html), ...jsonEntries(html), ...domEntries(html)];
  return entries.flatMap(entry => {
    const published = explicitTime(entry.published);
    const title = text(entry.title);
    const body = text(entry.body);
    const id = String(entry.id || '').replace(/^#/, '');
    const link = entryUrl(parent.link, entry.url, id);
    if (!published || !link || title.length < 18 || title.length > 180 || title.toLowerCase() === parentTitle
      || body.split(/\s+/).length < 25 || seen.has(link)) return [];
    seen.add(link);
    const description = entry.body.split(/\n\n/)[0];
    return [{
      ...parent,
      id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline: title, link, originalLink: link, published, pageVerified: true,
      articleBody: entry.body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true
    }];
  });
}
