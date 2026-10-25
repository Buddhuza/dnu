import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { collectFeed } from '../server/feeds.js';
import { articleArray, DEFAULT_INCLUDE, fallbackListingUrl, normalizeArticles, scrapeHeadlines, shortlistCandidates, undatedCandidates, reviewedArticleCheck } from '../server/news.js';
import { previousCoverageIndex, previousCoverageReason } from '../server/previousCoverage.js';
import { createAutoScrapeHistory } from '../server/autoScrapeHistory.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const previous = JSON.parse(readFileSync(join(root, 'data/daily-update-2026-10-14-15.json'), 'utf8'));
const priorIndex = previousCoverageIndex(previous.articles);
const scrapeHistory = createAutoScrapeHistory(join(root, 'data/auto-scrape-history.jsonl'));
const batchId = `comparison-${new Date().toISOString()}`;
const key = process.env.FIRECRAWL_API_KEY;
if (!key) throw new Error('FIRECRAWL_API_KEY is required for the comparison.');
const ids = (process.env.EXPERIMENT_SOURCE_IDS || 'source-2,source-32,source-47,source-60,source-71,source-83,source-97,source-98,source-104,source-122').split(',').map(id => id.trim());
const selectedSources = ids.map(id => sources.find(source => source.id === id));
if (selectedSources.some(source => !source)) throw new Error('EXPERIMENT_SOURCE_IDS contains an unknown source.');
const end = Date.now();
const start = end - 24 * 60 * 60 * 1000;
const output = process.env.EXPERIMENT_OUTPUT || '/tmp/dnu-headline-first-comparison.json';
const result = { windowStart: new Date(start).toISOString(), windowEnd: new Date(end).toISOString(), previousEdition: 'data/daily-update-2026-10-14-15.json', sources: [], errors: [] };
const save = () => writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
const headers = { Authorization: `Bearer ${key}` };
const usage = async () => {
  const response = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', { headers, signal: AbortSignal.timeout(15000) });
  const payload = await response.json();
  if (!response.ok || !Number.isFinite(payload.data?.remainingCredits)) throw new Error(payload.error || 'Could not read Firecrawl credit usage.');
  return payload.data.remainingCredits;
};
const inWindow = value => { const time = Date.parse(value); return Number.isFinite(time) && time >= start && time < end; };
const listedDate = article => String(article.publishedAt || article.published_at || article.date || '');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function batchScrape(urls) {
  if (!urls.length) return [];
  const response = await fetch('https://api.firecrawl.dev/v2/batch/scrape', {
    method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ urls, formats: ['markdown', 'html', { type: 'json', prompt: 'Extract the exact English headline, the explicit publication time with timezone if present, and one short factual summary sentence from the first substantive paragraph, especially its first few sentences. Do not invent dates or facts.' }], onlyMainContent: true, timeout: 30000 }),
    signal: AbortSignal.timeout(45000)
  });
  const created = await response.json();
  if (!response.ok || !created.id) throw new Error(created.error || `Batch scrape returned HTTP ${response.status}`);
  const pages = new Map();
  for (let attempt = 0; attempt < 40; attempt++) {
    await sleep(3000);
    const poll = await fetch(`https://api.firecrawl.dev/v2/batch/scrape/${created.id}`, { headers, signal: AbortSignal.timeout(45000) });
    const status = await poll.json();
    if (!poll.ok) throw new Error(status.error || `Batch status returned HTTP ${poll.status}`);
    for (const page of status.data || []) {
      const url = page.metadata?.sourceURL || page.metadata?.url;
      if (url) pages.set(url, page);
    }
    if (status.status === 'completed' || status.completed >= status.total) return urls.map(url => pages.get(url) || null);
    if (status.status === 'failed') throw new Error(status.error || 'Batch scrape failed');
  }
  throw new Error('Batch scrape timed out.');
}

result.creditsBefore = await usage();
save();
for (const source of selectedSources) {
  const record = { id: source.id, name: source.name, method: '', listed: 0, relevantCandidates: 0, previouslyCovered: 0, previouslyScraped: 0, outsideWindowOnListing: 0, weakListingCandidates: 0, selectedForArticleScrape: 0, articlePagesRequested: 0, verifiedInWindow: 0, accepted: [], errors: [] };
  result.sources.push(record);
  try {
    record.creditsAtStart = await usage();
    let feed = null;
    try { feed = await collectFeed(source); } catch (error) { record.errors.push(`Feed: ${error.message}`); }
    const feedArticles = feed ? normalizeArticles(feed, source, end, DEFAULT_INCLUDE, [], true).filter(article => inWindow(article.publishedAt)) : [];
    record.previouslyCovered += feedArticles.filter(article => previousCoverageReason(article, priorIndex)).length;
    const uncoveredFeed = feedArticles.filter(article => !previousCoverageReason(article, priorIndex));
    record.previouslyScraped += uncoveredFeed.filter(article => scrapeHistory.reason(article, source.id)).length;
    const freshFeed = [];
    for (const article of uncoveredFeed) {
      const claim = await scrapeHistory.claim(article, { batchId, sourceId: source.id });
      if (claim.claimed) freshFeed.push(article);
    }
    if (freshFeed.length) {
      record.method = 'publisher feed';
      record.listed = articleArray(feed).length;
      record.relevantCandidates = freshFeed.length;
      record.verifiedInWindow = freshFeed.length;
      record.accepted = freshFeed.map(article => ({ title: article.title, url: article.url, publishedAt: article.publishedAt }));
      record.creditsAtEnd = await usage();
      console.log(`${source.name}: ${freshFeed.length} feed stories, 0 Firecrawl pages`);
      save();
      continue;
    }
    let listing = null;
    for (const [method, target] of [['primary listing', source], ['alternate listing', fallbackListingUrl(source) && { ...source, listingUrl: fallbackListingUrl(source) }]]) {
      if (!target) continue;
      try {
        listing = await scrapeHeadlines(target, DEFAULT_INCLUDE, key);
        record.method = method;
        if (articleArray(listing).length) break;
      } catch (error) { record.errors.push(`${method}: ${error.message}`); }
    }
    if (!listing) { save(); continue; }
    const listed = articleArray(listing);
    record.listed = listed.length;
    const times = new Map(listed.map(article => [String(article.url || article.absoluteUrl || article.link), listedDate(article)]));
    const allCandidates = undatedCandidates(listing, source, [], [], true);
    record.deepComparisonPages = allCandidates.filter(article => {
      if (previousCoverageReason(article, priorIndex) || scrapeHistory.reason(article, source.id)) return false;
      const time = Date.parse(times.get(article.url));
      return !Number.isFinite(time) || inWindow(times.get(article.url));
    }).length;
    const candidates = undatedCandidates(listing, source, DEFAULT_INCLUDE, [], true);
    record.relevantCandidates = candidates.length;
    record.previouslyCovered += candidates.filter(article => previousCoverageReason(article, priorIndex)).length;
    const uncovered = candidates.filter(article => !previousCoverageReason(article, priorIndex));
    record.previouslyScraped += uncovered.filter(article => scrapeHistory.reason(article, source.id)).length;
    const fresh = uncovered.filter(article => !scrapeHistory.reason(article, source.id));
    record.outsideWindowOnListing = fresh.filter(article => { const time = Date.parse(times.get(article.url)); return Number.isFinite(time) && !inWindow(times.get(article.url)); }).length;
    const eligible = fresh.filter(article => { const time = Date.parse(times.get(article.url)); return !Number.isFinite(time) || inWindow(times.get(article.url)); });
    record.creditsAfterListing = await usage();
    const shortlist = shortlistCandidates(eligible);
    record.weakListingCandidates = eligible.filter(article => article.listingPriority != null && article.listingPriority < 3).length;
    record.selectedForArticleScrape = shortlist.length;
    for (let offset = 0; offset < shortlist.length; offset += 6) {
      const group = [];
      for (const candidate of shortlist.slice(offset, offset + 6)) {
        const claim = await scrapeHistory.claim(candidate, { batchId, sourceId: source.id });
        if (claim.claimed) group.push(candidate);
        else record.previouslyScraped++;
      }
      if (!group.length) continue;
      const pages = await batchScrape(group.map(article => article.url));
      record.articlePagesRequested += group.length;
      for (const [index, page] of pages.entries()) {
        if (!page) { record.errors.push(`No page returned: ${group[index].url}`); continue; }
        const check = reviewedArticleCheck({ data: page }, source, group[index].url, end);
        if (!check.article || !inWindow(check.article.publishedAt)) continue;
        record.verifiedInWindow++;
        if (!normalizeArticles({ data: { json: { articles: [check.article] } } }, source, end, DEFAULT_INCLUDE, [], true).length) continue;
        record.accepted.push({ title: check.article.title, url: check.article.url, publishedAt: check.article.publishedAt });
      }
      if (record.accepted.length >= 2) break;
    }
    record.creditsAtEnd = await usage();
    console.log(`${source.name}: ${record.accepted.length} stories; selective ${record.articlePagesRequested} article pages, deep ${eligible.length}`);
  } catch (error) { record.errors.push(error.message); console.log(`${source.name}: ${error.message}`); }
  save();
}
await sleep(3000);
result.creditsAfter = await usage();
result.creditsUsed = result.creditsBefore - result.creditsAfter;
result.totals = result.sources.reduce((totals, source) => {
  for (const key of ['listed', 'relevantCandidates', 'previouslyCovered', 'previouslyScraped', 'outsideWindowOnListing', 'weakListingCandidates', 'articlePagesRequested', 'deepComparisonPages', 'verifiedInWindow']) totals[key] = (totals[key] || 0) + (source[key] || 0);
  totals.accepted = (totals.accepted || 0) + source.accepted.length;
  return totals;
}, {});
save();
console.log(JSON.stringify({ output, creditsUsed: result.creditsUsed, totals: result.totals }));
