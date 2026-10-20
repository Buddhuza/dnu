import { IMPORT_PROMPT } from './importPrompt.js';
import { importedArticle, publicArticleUrl, sourceForArticle } from '../server/importArticle.js';
import { extractBrowserArticleBody } from './articleBodyText.js';
import { storeArticleBody } from './articleBodyStore.js';

export async function importDirectArticle(value, apiKey, sources, fetchImpl = fetch, options = {}) {
  const url = publicArticleUrl(value);
  if (!url) throw new Error('Enter a public HTTPS article URL.');
  const response = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: url.href, formats: ['markdown', 'html', { type: 'json', prompt: IMPORT_PROMPT }], onlyMainContent: true, timeout: 30000 }),
    signal: AbortSignal.timeout(45000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) throw new Error(payload.error || payload.message || `Firecrawl returned HTTP ${response.status}`);
  const article = importedArticle(payload, url, sourceForArticle(url, sources), options);
  const page = payload.data || payload;
  const body = extractBrowserArticleBody(page, article.title);
  if (body.split(/\s+/).length >= 25) await storeArticleBody(url.href, { heading: String(page.metadata?.title || page.json?.exactHeadline || article.title).trim(), body });
  return article;
}
