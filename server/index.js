import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, articleArray, fallbackListingUrl, normalizeArticles, parseWords, scrapeHeadlines, scrapeArticle, scrapeImportedArticle, searchSourceArticles, undatedCandidates, reviewedArticle, reviewedArticleCheck, candidatePage, shortlistCandidates, customSourceFromRequest } from './news.js';
import { importedArticle, publicArticleUrl, sourceForArticle } from './importArticle.js';
import { collectFeed, collectFallbackFeed, FEED_URLS } from './feeds.js';
import { createReportDocx } from './report.js';
import { currentDailyUpdate } from './daily.js';
import { reportFilename } from '../src/reportFilename.js';
import { createAutoScrapeHistory } from './autoScrapeHistory.js';
import { createArticleCache } from './articleCache.js';
import { extractArticleBody } from './articleBody.js';
import { articleJson } from '../src/articleTranslation.js';
import { load as loadHtml } from 'cheerio';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const sourceById = new Map(sources.map(source => [source.id, source]));
const dailySnapshot = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const autoScrapeHistory = createAutoScrapeHistory(join(root, 'data/auto-scrape-history.jsonl'));
const cache = new Map();
const articleCache = createArticleCache(join(root, 'data/article-cache.jsonl'));
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
  const cacheKey = JSON.stringify([source.id, source.url, source.listingUrl, include, exclude, fallback, search]);
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
    const selective = req.body?.selective === true;
    const manualRescrape = fullScan && !selective && req.body?.manualRescrape === true;
    const feedEntries = fromFeed ? normalizeArticles(entry.payload, source, Date.now(), include, exclude, true) : [];
    const uncoveredFeed = feedEntries;
    const feedHeadlines = [];
    let previouslyProcessedFeed = 0;
    for (const item of uncoveredFeed) {
      feedHeadlines.push(item);
    }
    const verifyFeedArticles = fromFeed && manualRescrape && Boolean(process.env.FIRECRAWL_API_KEY);
    const headlines = verifyFeedArticles ? [] : feedHeadlines;
    const listedCandidates = fromFeed ? [] : undatedCandidates(entry.payload, source, include, exclude, true);
    const candidates = verifyFeedArticles ? feedHeadlines.map(item => ({ title: item.title, url: item.url, feedArticle: item })) : fromFeed ? [] : listedCandidates;
    const previouslyCovered = feedEntries.length - feedHeadlines.length + listedCandidates.length - (fromFeed ? 0 : candidates.length);
    const selectionKey = JSON.stringify([fullScan, selective, req.body?.deepScan === true, manualRescrape]);
    entry.selections ??= new Map();
    if (continuingScan && !entry.selections.has(selectionKey)) return res.status(409).json({ error: 'This source scan expired. Start it again from the first page.' });
    if (!continuingScan) {
      entry.selections.set(selectionKey, { candidates: selective ? shortlistCandidates(candidates) : candidates, previouslyScraped: candidates.filter(item => { const cached = articleCache.get(item.url); return cached?.page || cached?.article; }).length });
    }
    const { candidates: selectedCandidates, previouslyScraped } = entry.selections.get(selectionKey);
    const page = candidatePage(selectedCandidates, req.body?.cursor, fullScan, req.body?.deepScan === true, selective);
    let checked = 0;
    let skippedSinceSelection = 0;
    const rejectionCounts = { pageError: 0, missingHeadlineOrTime: 0, outsideWindow: 0, outsideScope: 0, translationUnavailable: 0 };
    const pageErrors = [];
    for (const candidate of page.items) {
        try {
          checked++;
          let cached = manualRescrape ? null : articleCache.get(candidate.url);
          if (cached?.article) {
            const matched = normalizeArticles({ data: { json: { articles: [cached.article] } } }, source, Date.now(), include, exclude, true);
            if (!matched.length) rejectionCounts.outsideScope++;
            headlines.push(...matched);
            continue;
          }
          if (cached?.retryAfter > Date.now()) { skippedSinceSelection++; continue; }
          if (!cached?.page) {
            await autoScrapeHistory.claim(candidate, { batchId: String(req.body?.batchId || 'api-automatic').slice(0, 100), sourceId: source.id, force: true });
            const payload = await scrapeArticle(candidate.url, process.env.FIRECRAWL_API_KEY);
            articleCache.putPage(candidate.url, payload.data);
            cached = articleCache.get(candidate.url);
          }
          let check = reviewedArticleCheck({ data: cached.page }, source, candidate.url);
          if (check.reason === 'translationUnavailable' && cached.extractionVersion !== 2 && process.env.FIRECRAWL_API_KEY) {
            articleCache.putPage(candidate.url, (await scrapeArticle(candidate.url, process.env.FIRECRAWL_API_KEY)).data);
            cached = articleCache.get(candidate.url);
            check = reviewedArticleCheck({ data: cached.page }, source, candidate.url);
          }
          const reviewed = check.article;
          if (!reviewed) { rejectionCounts[check.reason]++; continue; }
          const matched = normalizeArticles({ data: { json: { articles: [reviewed] } } }, source, Date.now(), include, exclude, true);
          if (!matched.length) rejectionCounts.outsideScope++;
          headlines.push(...matched);
        } catch (error) { articleCache.putFailure(candidate.url); rejectionCounts.pageError++; if (pageErrors.length < 3) pageErrors.push(`${candidate.url}: ${error.message}`); /* Other candidates may still be verifiable. */ }
    }
    const nextCursor = fromFeed && !verifyFeedArticles ? null : page.nextCursor;
    res.json({ source, headlines: headlines.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date(entry.at).toISOString(), listedCount: articleArray(entry.payload).length, previouslyCovered, previouslyScraped: previouslyScraped + previouslyProcessedFeed + skippedSinceSelection, candidatesFound: candidates.length + (verifyFeedArticles ? 0 : uncoveredFeed.length), candidatesSelected: selectedCandidates.length + (verifyFeedArticles ? 0 : feedHeadlines.length), candidatesChecked: checked, rejectionCounts, pageErrors, nextCursor, collectionMethod: verifyFeedArticles ? 'feed+firecrawl' : fromFeed ? 'feed' : entry.payload.collectionMethod || 'firecrawl', listingUrl: entry.payload.feedUrl || entry.payload.searchQuery || (fallback ? alternateUrl : source.listingUrl || source.url), note: verifyFeedArticles ? 'Publisher feed entries were checked against their original article pages.' : fromFeed ? `Headlines and dates came from the publisher feed without opening article pages; ${previouslyProcessedFeed} previously seen entries were skipped.` : selective ? `Checking up to ${selectedCandidates.length} ranked headline links, three at a time; ${Math.max(0, candidates.length - previouslyScraped - selectedCandidates.length)} lower-priority links are outside this scan; ${previouslyScraped + skippedSinceSelection} previously scraped links were skipped.` : nextCursor === null && fullScan ? 'All relevant article links returned from this listing were checked; listings can still omit stories.' : 'Only some article pages were checked. No result is not proof that the source had no relevant news.' });
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
    if (!entry?.page) {
      await autoScrapeHistory.claim({ url: articleUrl.href }, { batchId: 'manual-review', sourceId: source.id, force: true });
      articleCache.putPage(articleUrl.href, (await scrapeArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY)).data);
      entry = articleCache.get(articleUrl.href);
    }
    let check = reviewedArticleCheck({ data: entry.page }, source, articleUrl.href);
    if (check.reason === 'translationUnavailable' && entry.extractionVersion !== 2) {
      articleCache.putPage(articleUrl.href, (await scrapeArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY)).data);
      entry = articleCache.get(articleUrl.href);
      check = reviewedArticleCheck({ data: entry.page }, source, articleUrl.href);
    }
    if (!check.article) {
      const reasons = { translationUnavailable: 'The non-English article could not be translated into English.', outsideScope: 'This Russian outlet can only be used for Russia-focused reporting.', outsideWindow: 'The article is outside the last 48 hours.', missingHeadlineOrTime: 'The article has no verifiable headline or publication time.' };
      return res.status(422).json({ error: reasons[check.reason] || 'The article could not be reviewed.' });
    }
    res.json(check.article);
  } catch (error) { res.status(502).json({ error: `Could not review article: ${error.message}` }); }
});

app.post('/api/import-article', async (req, res) => {
  const articleUrl = publicArticleUrl(req.body?.url);
  if (!articleUrl) return res.status(400).json({ error: 'Enter a public HTTPS article URL.' });
  if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Firecrawl is not configured on this server.' });
  try {
    let entry = articleCache.get(articleUrl.href);
    if (!entry?.page) {
      await autoScrapeHistory.claim({ url: articleUrl.href }, { batchId: 'manual-add', sourceId: sourceForArticle(articleUrl, sources)?.id || '', force: true });
      articleCache.putPage(articleUrl.href, (await scrapeImportedArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY)).data);
      entry = articleCache.get(articleUrl.href);
    }
    let article;
    try { article = importedArticle({ data: entry.page }, articleUrl, sourceForArticle(articleUrl, sources), { allowUnplaced: req.body?.allowUnplaced === true }); }
    catch (error) {
      if (!/could not be translated/.test(error.message) || entry.extractionVersion === 2) throw error;
      articleCache.putPage(articleUrl.href, (await scrapeImportedArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY)).data);
      entry = articleCache.get(articleUrl.href);
      article = importedArticle({ data: entry.page }, articleUrl, sourceForArticle(articleUrl, sources), { allowUnplaced: req.body?.allowUnplaced === true });
    }
    res.json(article);
  } catch (error) { res.status(422).json({ error: error.message || 'The article could not be imported.' }); }
});

app.post('/api/article-body', async (req, res) => {
  const articleUrl = publicArticleUrl(req.body?.url);
  if (!articleUrl) return res.status(400).json({ error: 'Enter a public HTTPS article URL.' });
  try {
    let entry = articleCache.get(articleUrl.href);
    if (!entry?.page || req.body?.translated === true && !articleJson(entry.page).translatedHeadline) {
      if (!process.env.FIRECRAWL_API_KEY) return res.status(503).json({ error: 'Firecrawl is not configured and this page is not cached.' });
      articleCache.putPage(articleUrl.href, (await scrapeImportedArticle(articleUrl.href, process.env.FIRECRAWL_API_KEY)).data);
      entry = articleCache.get(articleUrl.href);
    }
    const body = extractArticleBody(entry.page, String(articleJson(entry.page).exactHeadline || entry.article?.title || ''));
    if (body.split(/\s+/).length < 25) return res.status(422).json({ error: req.body?.translated === true ? 'The publisher page did not provide a complete English translation of the article body.' : 'The publisher page did not provide a full readable article body.' });
    const $ = loadHtml(entry.page?.html || '');
    const headingCandidates = $('h1').map((_index, node) => $(node).text().replace(/\s+/g, ' ').trim()).get();
    const expected = String(entry.article?.title || '').toLowerCase().match(/[a-z]{5,}/g) || [];
    const heading = headingCandidates.find(value => value.length > 15 && expected.filter(word => value.toLowerCase().includes(word)).length >= Math.min(2, expected.length))
      || entry.page?.metadata?.title || articleJson(entry.page).exactHeadline || entry.article?.title || '';
    res.json({ heading: String(heading).trim(), body, translated: Boolean(articleJson(entry.page).translatedHeadline) });
  } catch (error) { res.status(502).json({ error: `Could not collect full article: ${error.message}` }); }
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
