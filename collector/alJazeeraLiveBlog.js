import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function isAlJazeeraLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'www.aljazeera.com'
      && /^\/news\/liveblog\/\d{4}\/\d{1,2}\/\d{1,2}\/[a-z0-9-]+\/?$/i.test(parsed.pathname);
  } catch { return false; }
}

export function alJazeeraAmpUrl(url) {
  if (!isAlJazeeraLiveBlog(url)) return '';
  const parsed = new URL(url);
  return `${parsed.origin}/amp${parsed.pathname}`;
}

export function alJazeeraMissingPostIds(html, existingEntries, start, end) {
  const encoded = String(html || '').match(/window\.__APOLLO_STATE__="([A-Za-z0-9+/=]+)"/)?.[1];
  if (!encoded) return [];
  try {
    const state = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
    const known = new Set(existingEntries.map(entry => new URL(entry.link).searchParams.get('update')));
    return Object.values(state).filter(item => item?.__typename === 'ChildMeta'
      && /^\d+$/.test(String(item.id)) && !known.has(String(item.id))
      && Number(item.publishedTime) * 1000 >= +start
      && Number(item.publishedTime) * 1000 <= +end)
      .slice(0, 80).map(item => String(item.id));
  } catch { return []; }
}

export function extractAlJazeeraLiveBlogEntries(html, parent = {}) {
  if (!isAlJazeeraLiveBlog(parent.link) || !html) return [];
  const $ = load(html);
  const base = new URL(parent.link);
  const seen = new Set();
  return $('[id^="live-blog-updates-item-"]').toArray().flatMap(node => {
    const post = $(node);
    const id = post.attr('id')?.match(/^live-blog-updates-item-(\d+)$/)?.[1];
    const seconds = Number(post.attr('data-sort-time'));
    const published = seconds > 1_500_000_000 && seconds < 4_000_000_000
      ? new Date(seconds * 1000).toISOString() : '';
    const headline = clean(post.find('h2').first().text());
    const content = post.find('.card-live__content .wysiwyg').first();
    const body = content.find('p, li').toArray().map(element => clean($(element).text()))
      .filter(Boolean).join('\n\n');
    if (!id || seen.has(id) || !published || headline.length < 18 || headline.length > 180
      || body.split(/\s+/).length < 25) return [];
    // This is the long-form equivalent of Al Jazeera's Copy link URL,
    // which uses its short domain with the same update query parameter.
    seen.add(id);
    const link = `${base.origin}${base.pathname}?update=${id}`;
    const description = body.split(/\n\n/)[0];
    return [{ ...parent, id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline, link, originalLink: link, published, pageVerified: true,
      articleBody: body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}
