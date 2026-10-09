import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, normalizeArticles, parseWords, scrapeHeadlines, scrapeArticle } from './news.js';
import { createReportDocx } from './report.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  { id: 'google-news', name: 'Google News', group: 'Google News', url: 'https://news.google.com/' },
  ...JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'))
];
const sourceById = new Map(sources.map(source => [source.id, source]));
const cache = new Map();
const articleCache = new Map();
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/config', (_req, res) => {
  res.json({ sources, defaultInclude: DEFAULT_INCLUDE, defaultExclude: DEFAULT_EXCLUDE, firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY) });
});

app.post('/api/headlines', async (req, res) => {
  const source = sourceById.get(req.body?.sourceId);
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  const include = parseWords(req.body?.include);
  const exclude = parseWords(req.body?.exclude);
  if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Set FIRECRAWL_API_KEY on the server to collect headlines.' });
  const cacheKey = JSON.stringify([source.id, include]);
  try {
    let entry = cache.get(cacheKey);
    if (!entry || Date.now() - entry.at > 5 * 60 * 1000) {
      entry = { at: Date.now(), payload: await scrapeHeadlines(source, include, process.env.FIRECRAWL_API_KEY) };
      cache.set(cacheKey, entry);
    }
    const headlines = normalizeArticles(entry.payload, source, Date.now(), include, exclude);
    res.json({ source, headlines, fetchedAt: new Date(entry.at).toISOString(), note: 'Only headlines with verifiable publication times within the last 24 hours are shown.' });
  } catch (error) {
    res.status(502).json({ error: `Could not collect ${source.name}: ${error.message}` });
  }
});

app.post('/api/article', async (req, res) => {
  const source = sourceById.get(req.body?.sourceId);
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  let articleUrl;
  try {
    articleUrl = new URL(String(req.body?.url ?? ''));
    if (articleUrl.protocol !== 'https:') throw new Error('HTTPS required');
    if (source.id !== 'google-news' && articleUrl.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '')) throw new Error('The article must belong to its selected source.');
  } catch { return res.status(400).json({ error: 'Invalid article URL for this source.' }); }
  if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Set FIRECRAWL_API_KEY on the server to review articles.' });
  try {
    let entry = articleCache.get(articleUrl.href);
    if (!entry || Date.now() - entry.at > 10 * 60 * 1000) {
      entry = { at: Date.now(), payload: await scrapeArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY) };
      articleCache.set(articleUrl.href, entry);
    }
    const data = entry.payload.data ?? {};
    const extracted = typeof data.json === 'string' ? JSON.parse(data.json) : data.json ?? {};
    const publishedAt = data.metadata?.publishedTime ?? data.metadata?.['article:published_time'] ?? extracted.publishedAt;
    if (!publishedAt || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(publishedAt)) return res.status(422).json({ error: 'This article has no verifiable publication time.' });
    const time = Date.parse(publishedAt);
    if (!Number.isFinite(time) || time < Date.now() - 86400000 || time > Date.now() + 300000) return res.status(422).json({ error: 'This article is outside the last 24 hours.' });
    res.json({
      url: articleUrl.href,
      sourceId: source.id,
      sourceName: source.name,
      group: source.group,
      title: String(data.metadata?.ogTitle ?? extracted.exactHeadline ?? data.metadata?.title ?? '').trim(),
      summary: String(extracted.summary ?? '').trim(),
      publishedAt: new Date(time).toISOString()
    });
  } catch (error) { res.status(502).json({ error: `Could not review article: ${error.message}` }); }
});

app.post('/api/report.docx', async (req, res) => {
  const articles = Array.isArray(req.body?.articles) ? req.body.articles.slice(0, 300) : [];
  if (!articles.length || articles.some(x => !x.reviewed || !x.title?.trim() || !x.summary?.trim() || !x.sourceName?.trim() || !/^https:\/\//.test(x.url))) {
    return res.status(400).json({ error: 'Review each selected article and complete its summary before export.' });
  }
  try {
    const buffer = await createReportDocx({ title: String(req.body.title ?? '').slice(0, 120), articles, sourceOutcomes: Array.isArray(req.body.sourceOutcomes) ? req.body.sourceOutcomes : [], coverageNote: String(req.body.coverageNote ?? '').slice(0, 1000) });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="daily-news-update.docx"');
    res.send(buffer);
  } catch (error) { res.status(500).json({ error: `Could not create report: ${error.message}` }); }
});

if (process.env.NODE_ENV === 'production') app.use(express.static(join(root, 'dist')));
if (process.env.NODE_ENV === 'production') app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')));

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log(`Signal Desk server listening on ${port}`));
