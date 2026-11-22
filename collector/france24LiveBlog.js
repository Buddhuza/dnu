import { createHash } from 'node:crypto';
import { load } from 'cheerio';

const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

export function isFrance24LiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && /^(?:www\.)?france24\.com$/i.test(parsed.hostname)
      && /^\/en\/[a-z-]+\/\d{8}-live-[a-z0-9-]+\/?$/i.test(parsed.pathname);
  } catch { return false; }
}

function directPostUrl(value, parentUrl) {
  try {
    const url = new URL(value);
    const parent = new URL(parentUrl);
    const mid = url.searchParams.get('arena_mid');
    if (!isFrance24LiveBlog(url.href) || url.pathname !== parent.pathname
      || !/^[A-Za-z0-9]{8,40}$/.test(mid || '') || url.hash) return '';
    const direct = new URL(`${parent.origin}${parent.pathname}`);
    direct.searchParams.set('arena_mid', mid);
    if (url.searchParams.has('v')) direct.searchParams.set('v', url.searchParams.get('v'));
    return direct.href;
  } catch { return ''; }
}

export function extractFrance24LiveBlogEntries(html, parent = {}) {
  if (!isFrance24LiveBlog(parent.link) || !html) return [];
  const $ = load(html);
  const updates = [];
  $('script[type="application/ld+json"]').each((_, script) => {
    try {
      const value = JSON.parse($(script).html());
      const visit = node => {
        if (Array.isArray(node)) { node.forEach(visit); return; }
        if (!node || typeof node !== 'object') return;
        if (node['@type'] === 'LiveBlogPosting' && Array.isArray(node.liveBlogUpdate)) updates.push(...node.liveBlogUpdate);
        if (node['@graph']) visit(node['@graph']);
      };
      visit(value);
    } catch { /* Other structured data does not affect live posts. */ }
  });
  const hidden = $('.arena-liveblog').parent().find('div[style*="display: none"]').first().children('div').toArray()
    .map(node => {
      const post = $(node);
      const paragraphs = post.find('p').toArray().filter(element => !$(element).closest('figure, aside').length)
        .map(element => clean($(element).text())).filter(Boolean);
      return { headline: clean(post.find('h2').first().text()), published: post.find('time[datetime]').first().attr('datetime'), paragraphs };
    });
  const seen = new Set();
  return updates.flatMap((post, index) => {
    const headline = clean(post.headline);
    const link = directPostUrl(post.url || post['@id'], parent.link);
    const date = new Date(String(post.datePublished || ''));
    const published = Number.isFinite(date.getTime()) ? date.toISOString() : '';
    const dom = hidden[index]?.headline === headline ? hidden[index]
      : hidden.find(item => item.headline === headline && Date.parse(item.published) === +date);
    const body = dom?.paragraphs.length ? dom.paragraphs.join('\n\n') : clean(post.articleBody);
    if (!link || seen.has(link) || !published || headline.length < 18 || headline.length > 180
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
