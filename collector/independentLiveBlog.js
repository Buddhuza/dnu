import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function isIndependentLiveBlog(url) {
  try {
    const parsed = new URL(url);
    const filename = parsed.pathname.split('/').at(-1);
    return parsed.protocol === 'https:' && /^(?:www\.)?independent\.co\.uk$/i.test(parsed.hostname)
      && parsed.pathname.startsWith('/news/') && /(?:^|-)live(?:-|$)/i.test(filename)
      && /^[-a-z0-9]+-b\d+\.html$/i.test(filename);
  } catch { return false; }
}

function directPostUrl(value, parentUrl) {
  try {
    const url = new URL(value);
    const parent = new URL(parentUrl);
    return isIndependentLiveBlog(url.href) && url.pathname === parent.pathname
      && /^#post-\d+$/i.test(url.hash) && (!url.search || /^\?page=\d+$/i.test(url.search))
      ? url.href : '';
  } catch { return ''; }
}

export function extractIndependentLiveBlogEntries(html, parent = {}) {
  if (!isIndependentLiveBlog(parent.link) || !html) return [];
  const $ = load(html);
  const structured = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const value = JSON.parse($(script).html());
      const visit = node => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (node['@type'] === 'LiveBlogPosting' && Array.isArray(node.liveBlogUpdate)) structured.push(...node.liveBlogUpdate);
        if (node['@graph']) visit(node['@graph']);
      };
      visit(value);
    } catch { /* Other page metadata does not affect live updates. */ }
  });
  const domPosts = new Map($('.liveblog-post[id^="post-"]').toArray()
    .map(node => [$(node).attr('id'), $(node)]));
  const seen = new Set();
  return structured.flatMap(post => {
    const link = directPostUrl(post.url || post['@id'], parent.link);
    const postId = link && new URL(link).hash.slice(1);
    const dom = domPosts.get(postId);
    const headline = clean(post.headline);
    const date = new Date(String(post.datePublished || ''));
    const published = Number.isFinite(date.getTime()) ? date.toISOString() : '';
    const domHeadline = clean(dom?.find('h2').first().text());
    const domDate = Date.parse(dom?.find('a[href^="#post-"] span[title]').first().attr('title') || '');
    const paragraphs = dom?.find('p').toArray().map(node => clean($(node).text())).filter(Boolean) || [];
    const body = paragraphs.length ? paragraphs.join('\n\n') : clean(post.articleBody);
    if (!link || seen.has(link) || !published || headline.length < 18 || headline.length > 180
      || (dom && (domHeadline !== headline || Number.isFinite(domDate) && Math.abs(domDate - +date) > 1000))
      || body.split(/\s+/).length < 25) return [];
    seen.add(link);
    const description = body.split(/\n\n/)[0];
    return [{ ...parent, id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline, link, originalLink: link, published, pageVerified: true,
      articleBody: body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}
