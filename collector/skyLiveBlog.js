import { createHash } from 'node:crypto';
import { load } from 'cheerio';

// Sky's Ukraine live blog uses this publisher-hosted LiveCenter channel.
export const SKY_UKRAINE_LIVE_URL = 'https://news.sky.com/story/ukraine-war-latest-zelenskyy-labels-putin-killer-after-trumps-friendship-comments-12541713';
export const SKY_UKRAINE_LIVE_FEED = 'https://livecenter.norkon.net/BulletinFeed/sky-news-prod/20915/Latest/';

export function isSkyUkraineLiveBlog(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'news.sky.com'
      && /^\/story\/[a-z0-9-]+-12541713$/i.test(parsed.pathname);
  } catch { return false; }
}

function text(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }

function postBody(html) {
  const $ = load(String(html || ''));
  const paragraphs = $('p, li').toArray().map(node => text($(node).text())).filter(Boolean);
  return paragraphs.join('\n\n');
}

export function extractSkyLiveBlogEntries(payload, parent = {}) {
  if (!isSkyUkraineLiveBlog(parent.link)) return [];
  let data;
  try { data = typeof payload === 'string' ? JSON.parse(payload) : payload; }
  catch { return []; }
  if (data?.success !== true || !Array.isArray(data.result)) return [];
  const seen = new Set();
  return data.result.flatMap(post => {
    const id = post?.id;
    const headline = text(post?.title);
    const published = new Date(Number(post?.created) * 1000);
    const body = postBody(post?.content?.html);
    if (!Number.isSafeInteger(id) || id <= 0 || seen.has(id) || headline.length < 18 || headline.length > 180
      || /^(?:good morning|welcome to|that'?s it for today|here'?s a recap)\b/i.test(headline)
      || !Number.isFinite(published.getTime()) || published.getUTCFullYear() < 2020
      || body.split(/\s+/).length < 25) return [];
    seen.add(id);
    const link = new URL(parent.link);
    link.search = '';
    link.searchParams.set('postid', String(id));
    link.hash = 'liveblog-body';
    const url = link.href;
    const description = body.split(/\n\n/)[0];
    return [{ ...parent, id: createHash('sha256').update(url).digest('hex').slice(0, 8),
      headline, link: url, originalLink: url, published: published.toISOString(),
      pageVerified: true, articleBody: body.slice(0, 14000), description, summary: description,
      contentStatus: 'publisher_article_html', dateEvidence: 'live_blog_entry_timestamp',
      country: '', countries: [], category: 'International', fromLiveBlog: true }];
  });
}
