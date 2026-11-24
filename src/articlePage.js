import { articleHintsFromHtml } from './urlArticleHints.js';
import { extractBrowserArticleBody } from './articleBodyText.js';
import { resolveArticleTime } from '../server/importArticle.js';

const viennaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit' });

function metaContent(html, ...names) {
  for (const name of names) {
    const pattern = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${name}["'][^>]*>`, 'i');
    const tag = String(html).match(pattern)?.[0];
    const content = tag?.match(/\bcontent\s*=\s*(["'])(.*?)\1/is)?.[2];
    if (content) return content;
  }
  return '';
}

// Turns a publisher page into Add article suggestions: headline, agency, Vienna date, exact time and full text.
export function articleFieldsFromPage(html, pageUrl, extractBody = extractBrowserArticleBody) {
  const url = new URL(pageUrl);
  const hints = articleHintsFromHtml(html);
  const page = { html, metadata: { url: url.href, sourceURL: url.href, title: hints.title } };
  const text = String(extractBody(page, hints.title) || '').trim();
  const payload = { data: { html, metadata: { publishedTime: metaContent(html, 'article:published_time', 'og:article:published_time', 'datePublished', 'pubdate', 'publish-date', 'date') } } };
  const { publishedAt, timeSource } = resolveArticleTime(payload, url);
  const timed = timeSource === 'current' ? null : publishedAt;
  return {
    title: hints.title,
    sourceName: hints.sourceName,
    date: timed ? viennaDate.format(new Date(timed)) : hints.date,
    publishedAt: timeSource === 'page' ? timed : null,
    text: text.split(/\s+/).length >= 25 ? text : ''
  };
}

// Asks the editor-only Supabase function to fetch the page server-side, avoiding browser CORS limits.
export async function fetchArticlePage(client, url) {
  if (!client) throw new Error('Server-side reading needs the shared editor sign-in.');
  const { data, error } = await client.functions.invoke('fetch-article-page', { method: 'POST', body: { url } });
  if (error) {
    let message = data?.error;
    try { message ||= (await error.context?.json())?.error; } catch { /* Network errors have no JSON body. */ }
    throw new Error(message || 'The article page could not be read.');
  }
  if (typeof data?.html !== 'string' || !data.url) throw new Error('The article page could not be read.');
  return data;
}
