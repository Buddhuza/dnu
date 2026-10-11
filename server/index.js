import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, normalizeArticles, parseWords, scrapeHeadlines, scrapeArticle, undatedCandidates, reviewedArticle, customSourceFromRequest } from './news.js';
import { collectFeed, FEED_URLS } from './feeds.js';
import { createReportDocx } from './report.js';
import { currentDailyUpdate } from './daily.js';
import { reportFilename } from '../src/reportFilename.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const sourceById = new Map(sources.map(source => [source.id, source]));
const dailySnapshot = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-05-09.json'), 'utf8'));
const cache = new Map();
const articleCache = new Map();
const app = express();
app.use(express.json({ limit: '256kb' }));

app.get('/api/config', (_req, res) => {
  res.json({ sources, defaultInclude: DEFAULT_INCLUDE, defaultExclude: DEFAULT_EXCLUDE, firecrawlConfigured: Boolean(process.env.FIRECRAWL_API_KEY), feedSourceIds: Object.keys(FEED_URLS) });
});

app.get('/api/daily-update', (_req, res) => {
  res.json(currentDailyUpdate(dailySnapshot));
});

app.get('/api/daily-update.docx', async (_req, res) => {
  const update = currentDailyUpdate(dailySnapshot);
  if (!update.articles.length) return res.status(410).json({ error: 'This daily update has expired. Collect new articles for the next report.' });
  try {
    const buffer = await createReportDocx(update);
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${reportFilename(update)}"`);
    res.send(Buffer.from(buffer));
  } catch (error) { res.status(500).json({ error: `Could not create daily update: ${error.message}` }); }
});

app.post('/api/headlines', async (req, res) => {
  const source = sourceById.get(req.body?.sourceId) ?? customSourceFromRequest(req.body?.customSource);
  if (source?.id !== req.body?.sourceId) return res.status(400).json({ error: 'Choose a valid source from the list.' });
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  const include = parseWords(req.body?.include);
  const exclude = parseWords(req.body?.exclude);
  const cacheKey = JSON.stringify([source.id, source.url, include]);
  try {
    let entry = cache.get(cacheKey);
    if (!entry || Date.now() - entry.at > 5 * 60 * 1000) {
      let payload = null;
      try { payload = await collectFeed(source); } catch { /* Fall through to Firecrawl when a feed is unavailable. */ }
      if (!payload) {
        if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'No usable feed was available. Set FIRECRAWL_API_KEY on the server to collect this source.' });
        payload = await scrapeHeadlines(source, include, process.env.FIRECRAWL_API_KEY);
      }
      entry = { at: Date.now(), payload };
      cache.set(cacheKey, entry);
    }
    const fromFeed = entry.payload.collectionMethod === 'feed';
    const headlines = fromFeed ? normalizeArticles(entry.payload, source, Date.now(), include, exclude, true) : [];
    const candidates = fromFeed ? [] : undatedCandidates(entry.payload, source, include, exclude, true);
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
    res.json({ source, headlines: headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date(entry.at).toISOString(), candidatesFound: candidates.length, candidatesChecked: checked, collectionMethod: fromFeed ? 'feed' : 'firecrawl', note: fromFeed ? 'Headlines and dates came from the publisher feed. Article pages were not independently checked.' : 'Article pages are checked when listing dates are missing or unreliable. No result is not proof that the source had no relevant news.' });
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
    if (articleUrl.hostname.replace(/^www\./, '') !== new URL(source.url).hostname.replace(/^www\./, '')) throw new Error('The article must belong to its selected source.');
  } catch { return res.status(400).json({ error: 'Invalid article URL for this source.' }); }
  if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Set FIRECRAWL_API_KEY on the server to review articles.' });
  try {
    let entry = articleCache.get(articleUrl.href);
    if (!entry || Date.now() - entry.at > 10 * 60 * 1000) {
      entry = { at: Date.now(), payload: await scrapeArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY) };
      articleCache.set(articleUrl.href, entry);
    }
    const reviewed = reviewedArticle(entry.payload, source, articleUrl.href);
    if (!reviewed) return res.status(422).json({ error: 'This article has no verifiable publication time within the last 48 hours.' });
    res.json(reviewed);
  } catch (error) { res.status(502).json({ error: `Could not review article: ${error.message}` }); }
});

app.post('/api/report.docx', async (req, res) => {
  const articles = Array.isArray(req.body?.articles) ? req.body.articles.slice(0, 300) : [];
  if (!articles.length || articles.some(x => !x.reviewed || !x.title?.trim() || !x.sourceName?.trim() || !/^https:\/\//.test(x.url))) {
    return res.status(400).json({ error: 'Review each selected headline and provide its source before export.' });
  }
  try {
    const buffer = await createReportDocx({ title: String(req.body.title ?? '').slice(0, 120), articles, sourceOutcomes: Array.isArray(req.body.sourceOutcomes) ? req.body.sourceOutcomes : [] });
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${reportFilename(req.body)}"`);
    res.send(Buffer.from(buffer));
  } catch (error) { res.status(500).json({ error: `Could not create report: ${error.message}` }); }
});

if (process.env.NODE_ENV === 'production') app.use(express.static(join(root, 'dist')));
if (process.env.NODE_ENV === 'production') app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')));

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log(`Signal Desk server listening on ${port}`));
