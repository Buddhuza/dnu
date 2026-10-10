import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, normalizeArticles, parseWords, scrapeHeadlines, scrapeArticle, undatedCandidates, reviewedArticle, customSourceFromRequest } from './news.js';
import { createReportDocx } from './report.js';
import { currentDailyUpdate } from './daily.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  { id: 'google-news', name: 'Google News', group: 'Google News', url: 'https://news.google.com/' },
  ...JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'))
];
const sourceById = new Map(sources.map(source => [source.id, source]));
const dailySnapshot = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-09.json'), 'utf8'));
const cache = new Map();
const articleCache = new Map();
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/config', (_req, res) => {
  res.json({ sources, defaultInclude: DEFAULT_INCLUDE, defaultExclude: DEFAULT_EXCLUDE, firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY) });
});

app.get('/api/daily-update', (_req, res) => {
  res.json(currentDailyUpdate(dailySnapshot));
});

app.get('/api/daily-update.docx', async (_req, res) => {
  const update = currentDailyUpdate(dailySnapshot);
  if (!update.articles.length) return res.status(410).json({ error: 'This daily update has expired. Collect new articles for the next report.' });
  try {
    const coverageNote = `${update.articles.length} selected articles from ${new Set(update.articles.map(x => x.sourceId)).size} agencies. Source pages were checked for this selected roundup; many accessible sources were not reviewed article by article. Publication times fall within the 24 hours ending ${update.servedAt}. Opinion and analysis were excluded.`;
    const buffer = await createReportDocx({ ...update, coverageNote });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="daily-news-update-2026-10-09.docx"');
    res.send(buffer);
  } catch (error) { res.status(500).json({ error: `Could not create daily update: ${error.message}` }); }
});

app.post('/api/headlines', async (req, res) => {
  const source = sourceById.get(req.body?.sourceId) ?? customSourceFromRequest(req.body?.customSource);
  if (source?.id !== req.body?.sourceId) return res.status(400).json({ error: 'Choose a valid source from the list.' });
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  const include = parseWords(req.body?.include);
  const exclude = parseWords(req.body?.exclude);
  if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Set FIRECRAWL_API_KEY on the server to collect headlines.' });
  const cacheKey = JSON.stringify([source.id, source.url, include]);
  try {
    let entry = cache.get(cacheKey);
    if (!entry || Date.now() - entry.at > 5 * 60 * 1000) {
      entry = { at: Date.now(), payload: await scrapeHeadlines(source, include, process.env.FIRECRAWL_API_KEY) };
      cache.set(cacheKey, entry);
    }
    const headlines = normalizeArticles(entry.payload, source, Date.now(), include, exclude);
    const candidates = source.id === 'google-news' ? [] : undatedCandidates(entry.payload, source, include, exclude);
    let checked = 0;
    for (const candidate of candidates.slice(0, req.body?.deepScan === true ? 10 : 3)) {
        checked++;
        try {
          let article = articleCache.get(candidate.url);
          if (!article || Date.now() - article.at > 10 * 60 * 1000) {
            article = { at: Date.now(), payload: await scrapeArticle(candidate.url, process.env.FIRECRAWL_API_KEY) };
            articleCache.set(candidate.url, article);
          }
          const reviewed = reviewedArticle(article.payload, source, candidate.url);
          if (!reviewed) continue;
          const matched = normalizeArticles({ data: { json: { articles: [reviewed] } } }, source, Date.now(), include, exclude, true);
          headlines.push(...matched);
        } catch { /* Other candidates may still be verifiable. */ }
    }
    res.json({ source, headlines: headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date(entry.at).toISOString(), candidatesFound: candidates.length, candidatesChecked: checked, note: 'Listings without a full timestamp are checked against original articles. No result is not proof that the source had no relevant news.' });
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
    const reviewed = reviewedArticle(entry.payload, source, articleUrl.href);
    if (!reviewed) return res.status(422).json({ error: 'This article has no verifiable publication time within the last 24 hours.' });
    res.json(reviewed);
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
