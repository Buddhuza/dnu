import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
const assetId = value => /^asset:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));

export function isBbcLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^(?:www\.)?bbc\.(?:com|co\.uk)$/i.test(parsed.hostname)
      && /^\/news\/live\/[a-z0-9]+\/?$/i.test(parsed.pathname);
  } catch { return false; }
}

function directPostUrl(parentUrl, id) {
  const parent = new URL(parentUrl);
  const url = new URL(`https://www.bbc.com${parent.pathname}`);
  url.searchParams.set('post', id);
  url.hash = 'post';
  return url.href;
}

export function extractBbcLiveBlogEntries(html, parent = {}) {
  if (!isBbcLiveBlog(parent.link) || !html) return [];
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
    } catch { /* An unrelated JSON-LD block cannot prevent extraction. */ }
  });
  const domPosts = new Map($('article[data-testid="content-post"][id]').toArray()
    .map(node => [$(node).attr('id'), $(node)]).filter(([id]) => assetId(id)));
  const seen = new Set();
  return structured.flatMap(post => {
    let id;
    try { id = new URL(post['@id'] || post.url).searchParams.get('post'); }
    catch { return []; }
    if (!assetId(id) || seen.has(id)) return [];
    const publishedDate = new Date(String(post.datePublished || ''));
    const published = Number.isFinite(publishedDate.getTime()) ? publishedDate.toISOString() : '';
    const headline = clean(post.headline);
    const dom = domPosts.get(id);
    const paragraphs = dom?.find('p').toArray().map(node => clean($(node).text())).filter(Boolean) || [];
    const body = paragraphs.length ? paragraphs.join('\n\n') : clean(post.articleBody);
    if (!published || headline.length < 18 || headline.length > 180 || body.split(/\s+/).length < 25) return [];
    seen.add(id);
    const link = directPostUrl(parent.link, id);
    const description = body.split(/\n\n/)[0];
    return [{ ...parent, id: createHash('sha256').update(link).digest('hex').slice(0, 8),
      headline, link, originalLink: link, published, pageVerified: true,
      articleBody: body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}
