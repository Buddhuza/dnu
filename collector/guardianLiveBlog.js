import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const BLOCK = /^block-[a-f0-9]{20,32}$/i;

export function isGuardianLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^(?:www\.)?theguardian\.com$/.test(parsed.hostname)
      && /^\/(?:world|politics|us-news|uk-news|australia-news)\/live\/\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]+\/?$/i.test(parsed.pathname);
  } catch { return false; }
}

function postLink(base, href, id) {
  try {
    const link = new URL(href, base);
    const expected = `with:${id}`;
    if (!isGuardianLiveBlog(link.href) || link.pathname !== base.pathname
      || link.searchParams.get('page') !== expected || link.hash !== `#${id}`) return '';
    return link.href;
  } catch { return ''; }
}

export function extractGuardianLiveBlogEntries(html, parent = {}) {
  if (!isGuardianLiveBlog(parent.link) || !html) return [];
  const $ = load(html);
  const base = new URL(parent.link);
  base.search = '';
  base.hash = '';
  const seen = new Set();
  return $('article.block[id^="block-"]').toArray().flatMap(node => {
    const post = $(node);
    const id = post.attr('id');
    if (!BLOCK.test(id) || seen.has(id)) return [];
    const header = post.find('header').first();
    const headline = clean(header.find('h2').first().text());
    const date = new Date(header.find('time[datetime]').first().attr('datetime') || '');
    const published = Number.isFinite(date.getTime()) ? date.toISOString() : '';
    const link = postLink(base, header.find('a[href*="page="]').first().attr('href'), id);
    const paragraphs = post.find('p').toArray().filter(node => !$(node).closest('figure, aside').length)
      .map(node => clean($(node).text())).filter(value => value && !/^Here is our latest .{0,80} podcast\b/i.test(value));
    const body = paragraphs.join('\n\n');
    if (!link || !published || headline.length < 18 || headline.length > 180 || body.split(/\s+/).length < 25) return [];
    seen.add(id);
    const description = paragraphs[0];
    return [{ ...parent, id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline, link, originalLink: link, published, pageVerified: true,
      articleBody: body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}

export function guardianNextPageUrl(html, parentUrl) {
  if (!isGuardianLiveBlog(parentUrl)) return '';
  const $ = load(html);
  const base = new URL(parentUrl);
  base.search = '';
  base.hash = '';
  const anchor = $('a[href*="#liveblog-navigation"]').toArray()
    .find(node => /^Next$/i.test(clean($(node).text())));
  if (!anchor) return '';
  try {
    const url = new URL($(anchor).attr('href'), base);
    if (!isGuardianLiveBlog(url.href) || url.pathname !== base.pathname
      || !/^with:block-[a-f0-9]{20,32}$/i.test(url.searchParams.get('page') || '')) return '';
    url.hash = '';
    return url.href;
  } catch { return ''; }
}

export function guardianOldestPostTime(html) {
  const $ = load(html);
  const times = $('article.block[id^="block-"] header time[datetime]').toArray()
    .map(node => Date.parse($(node).attr('datetime') || '')).filter(Number.isFinite);
  return times.length ? Math.min(...times) : 0;
}
