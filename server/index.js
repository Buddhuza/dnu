import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, articleArray, fallbackListingUrl, normalizeArticles, parseWords, scrapeHeadlines, scrapeArticle, searchSourceArticles, undatedCandidates, reviewedArticle, reviewedArticleCheck, candidatePage, customSourceFromRequest } from './news.js';
import { collectFeed, collectFallbackFeed, FEED_URLS } from './feeds.js';
import { createReportDocx } from './report.js';
import { currentDailyUpdate } from './daily.js';
import { reportFilename } from '../src/reportFilename.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const sourceById = new Map(sources.map(source => [source.id, source]));
const dailySnapshot = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-13.json'), 'utf8'));
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
  let source = sourceById.get(req.body?.sourceId) ?? customSourceFromRequest(req.body?.customSource);
  if (source?.id !== req.body?.sourceId) return res.status(400).json({ error: 'Choose a valid source from the list.' });
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  if (req.body?.listingUrlOverride && sourceById.has(source.id)) {
    try {
      const alternate = new URL(String(req.body.listingUrlOverride));
      if (alternate.protocol !== 'https:' || alternate.origin !== new URL(source.url).origin || alternate.username || alternate.password) throw new Error();
      source = { ...source, listingUrl: alternate.href };
    } catch { return res.status(400).json({ error: 'Use an HTTPS news-section URL on the source website.' }); }
  }
  const include = parseWords(req.body?.include);
  const exclude = parseWords(req.body?.exclude);
  const fallback = req.body?.fallback === true;
  const search = req.body?.search === true;
  if (fallback && search) return res.status(400).json({ error: 'Choose one collection method.' });
  const alternateUrl = fallbackListingUrl(source);
  if ((fallback || search) && !process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Firecrawl is required to check alternate links.' });
  const cacheKey = JSON.stringify([source.id, source.url, source.listingUrl, include, fallback, search]);
  const continuingScan = req.body?.fullScan === true && Number(req.body?.cursor) > 0;
  try {
    let entry = cache.get(cacheKey);
    if (continuingScan && !entry) return res.status(409).json({ error: 'This source scan expired. Start it again from the first page.' });
    if (!entry || (!continuingScan && Date.now() - entry.at > 5 * 60 * 1000)) {
      let payload = null;
      if (search) payload = await searchSourceArticles(source, include, process.env.FIRECRAWL_API_KEY);
      if (!fallback && !search) try { payload = await collectFeed(source); } catch { /* Fall through to Firecrawl when a feed is unavailable. */ }
      if (fallback) try {
        payload = await collectFallbackFeed(source, fetch, feed => normalizeArticles(feed, source, Date.now(), include, exclude, true).length > 0);
      } catch { /* A publisher feed may not exist. */ }
      if (!payload) {
        if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'No usable feed was available. Set FIRECRAWL_API_KEY on the server to collect this source.' });
        if (fallback && !alternateUrl) return res.status(422).json({ error: 'No matching dated publisher feed or alternate listing page was found. Add a working news-section URL for this source.' });
        payload = await scrapeHeadlines(fallback ? { ...source, listingUrl: alternateUrl } : source, include, process.env.FIRECRAWL_API_KEY);
      }
      entry = { at: Date.now(), payload };
      cache.set(cacheKey, entry);
    }
    const fromFeed = entry.payload.collectionMethod === 'feed';
    const fullScan = req.body?.fullScan === true;
    const feedHeadlines = fromFeed ? normalizeArticles(entry.payload, source, Date.now(), include, exclude, true) : [];
    const verifyFeedArticles = fromFeed && fullScan && Boolean(process.env.FIRECRAWL_API_KEY);
    const headlines = verifyFeedArticles ? [] : feedHeadlines;
    const candidates = verifyFeedArticles ? feedHeadlines.map(item => ({ title: item.title, url: item.url, feedArticle: item })) : fromFeed ? [] : undatedCandidates(entry.payload, source, include, exclude, true);
    const page = candidatePage(candidates, req.body?.cursor, fullScan, req.body?.deepScan === true);
    let checked = 0;
    const rejectionCounts = { pageError: 0, missingHeadlineOrTime: 0, outsideWindow: 0, outsideScope: 0, nonEnglish: 0 };
    const pageErrors = [];
    for (const candidate of page.items) {
        checked++;
        try {
          let article = articleCache.get(candidate.url);
          if (!article || Date.now() - article.at > 10 * 60 * 1000) {
            article = { at: Date.now(), payload: await scrapeArticle(candidate.url, process.env.FIRECRAWL_API_KEY) };
            articleCache.set(candidate.url, article);
          }
          const check = reviewedArticleCheck(article.payload, source, candidate.url);
          const reviewed = check.article;
          if (!reviewed) { rejectionCounts[check.reason]++; continue; }
          const matched = normalizeArticles({ data: { json: { articles: [reviewed] } } }, source, Date.now(), include, exclude, true);
          if (!matched.length) rejectionCounts.outsideScope++;
          headlines.push(...matched);
        } catch (error) { rejectionCounts.pageError++; if (pageErrors.length < 3) pageErrors.push(`${candidate.url}: ${error.message}`); /* Other candidates may still be verifiable. */ }
    }
    const nextCursor = fromFeed && !verifyFeedArticles ? null : page.nextCursor;
    res.json({ source, headlines: headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date(entry.at).toISOString(), listedCount: articleArray(entry.payload).length, candidatesFound: candidates.length, candidatesChecked: checked, rejectionCounts, pageErrors, nextCursor, collectionMethod: verifyFeedArticles ? 'feed+firecrawl' : fromFeed ? 'feed' : entry.payload.collectionMethod || 'firecrawl', listingUrl: entry.payload.feedUrl || entry.payload.searchQuery || (fallback ? alternateUrl : source.listingUrl || source.url), note: verifyFeedArticles ? 'Publisher feed entries were checked against their original article pages.' : fromFeed ? 'Headlines and dates came from the publisher feed. Article pages were not independently checked.' : nextCursor === null && fullScan ? 'All relevant article links returned from this listing were checked; listings can still omit stories.' : 'Only some article pages were checked. No result is not proof that the source had no relevant news.' });
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
    const check = reviewedArticleCheck(entry.payload, source, articleUrl.href);
    if (!check.article) {
      const reasons = { nonEnglish: 'The article is not in English.', outsideScope: 'This Russian outlet can only be used for Russia-focused reporting.', outsideWindow: 'The article is outside the last 48 hours.', missingHeadlineOrTime: 'The article has no verifiable headline or publication time.' };
      return res.status(422).json({ error: reasons[check.reason] || 'The article could not be reviewed.' });
    }
    res.json(check.article);
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
app.listen(port, '0.0.0.0', () => console.log(`DNU server listening on ${port}`));
