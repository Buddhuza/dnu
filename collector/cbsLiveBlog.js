import { createHash } from 'node:crypto';
import { load } from 'cheerio';

export function isCbsLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^(?:www\.)?cbsnews\.com$/.test(parsed.hostname)
      && /^\/live-updates\/[a-z0-9-]+\/?$/i.test(parsed.pathname);
  } catch { return false; }
}

const text = value => String(value || '').replace(/\s+/g, ' ').trim();

function publishedTime(value) {
  const time = typeof value === 'number' ? new Date(value) : new Date(String(value || ''));
  return Number.isFinite(time.getTime()) && time.getUTCFullYear() >= 2020 ? time.toISOString() : '';
}

function directPostUrl(value, parentUrl, anchor) {
  try {
    const url = new URL(text(value));
    const parent = new URL(parentUrl);
    return url.protocol === 'https:' && /^(?:www\.)?cbsnews\.com$/.test(url.hostname)
      && url.pathname.replace(/\/$/, '') === parent.pathname.replace(/\/$/, '') && !url.search && url.hash === `#${anchor}`
      && /^post-update-[a-f0-9]{8,32}$/i.test(anchor) ? url.href : '';
  } catch { return ''; }
}

export function extractCbsLiveBlogEntries(html, parent = {}) {
  if (!isCbsLiveBlog(parent.link) || !html) return [];
  const $ = load(html);
  const structured = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const value = JSON.parse($(script).html());
      if (value?.['@type'] === 'LiveBlogPosting' && Array.isArray(value.liveBlogUpdate)) structured.push(...value.liveBlogUpdate);
    } catch { /* Other JSON-LD blocks do not affect post extraction. */ }
  });
  const seen = new Set();
  return $('.content__post.post-update').not('.post-update--intro').toArray().flatMap((node, index) => {
    const post = $(node);
    const headline = text(post.find('.post-update__headline').first().text());
    const matchingStructured = structured[index]?.headline === headline ? structured[index] : null;
    const published = publishedTime(matchingStructured?.datePublished)
      || publishedTime(post.attr('data-sort-time') && Number(post.attr('data-sort-time')))
      || publishedTime(post.find('time[datetime]').first().attr('datetime'));
    const anchor = text(post.find('a.post-update__anchor-link[name]').first().attr('name'));
    const link = directPostUrl(post.find('.sharebar__textarea').first().text(), parent.link, anchor);
    const body = post.find('.post-update__bodytext').first().find('p, li').toArray()
      .map(paragraph => text($(paragraph).text())).filter(Boolean).join('\n\n');
    if (!link || seen.has(link) || !published || headline.length < 18 || headline.length > 180
      || body.split(/\s+/).length < 25) return [];
    seen.add(link);
    const byline = text(post.find('.post-update__author').first().text());
    const wire = /\bAssociated\s+Press\b/i.test(byline) ? 'AP' : /\bAFP\b/i.test(byline) ? 'AFP' : '';
    const description = body.split(/\n\n/)[0];
    return [{ ...parent, id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline, link, originalLink: link, published, pageVerified: true,
      articleBody: body.slice(0, 14000), description, summary: description, wire,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}
