import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';
import { blockedPlacementReason } from '../src/sourcePolicy.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { canonicalArticleUrl } from '../src/siteConfig.js';
import { appendEditionStories } from '../src/editionActions.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const auditPath = process.env.FEEDRUN_AUDIT_PATH;
const selectionPath = process.env.FEEDRUN_SELECTION_PATH;
if (!auditPath || !selectionPath) throw new Error('Set FEEDRUN_AUDIT_PATH and FEEDRUN_SELECTION_PATH explicitly.');
const audit = JSON.parse(readFileSync(join(root, auditPath), 'utf8'));
const selected = JSON.parse(readFileSync(join(root, selectionPath), 'utf8'));
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const sourceById = new Map(sources.map(source => [source.id, source]));
const candidates = new Map(audit.articles.map(article => [article.title, article]));
const seen = new Set();
const articles = selected.map(row => {
  const item = candidates.get(row.title);
  if (!item || item.status !== 'verified' || !item.pageDateMatchesFeed || !item.body || Date.parse(item.pageDate) < Date.parse(audit.windowStart) || Date.parse(item.pageDate) > Date.parse(audit.windowEnd))
    throw new Error(`Story lacks a verified original page inside the window: ${row.title}`);
  const key = canonicalArticleUrl(item.url);
  if (seen.has(key)) throw new Error(`Repeated article URL: ${item.url}`);
  seen.add(key);
  const source = sourceById.get(item.sourceId);
  const article = {
    id: item.url, url: item.url, sourceId: item.sourceId, sourceName: item.sourceName,
    group: source.group, title: item.title, summary: String(row.summary || '').trim(),
    publishedAt: item.pageDate, section: row.section, subsection: row.subsection,
    country: row.country || '', reviewed: true
  };
  if (!article.summary || excludedHeadlineReason(article.title, article.summary, article.url) || blockedPlacementReason(article))
    throw new Error(`Selected story fails editorial checks: ${row.title}`);
  return article;
});

const counts = new Map();
for (const article of articles) counts.set(article.sourceId, (counts.get(article.sourceId) || 0) + 1);
const feedsById = new Map(audit.feeds.map(feed => [feed.sourceId, feed]));
const sourceOutcomes = sources.map(source => {
  const feed = feedsById.get(source.id);
  if (!feed) return { ...source, status: 'not-checked', reason: 'Outside this FEEDRUN direct-feed source set.' };
  const checked = audit.articles.filter(article => article.sourceId === source.id);
  const verified = checked.filter(article => article.status === 'verified' && article.pageDateMatchesFeed && Date.parse(article.pageDate) >= Date.parse(audit.windowStart) && Date.parse(article.pageDate) <= Date.parse(audit.windowEnd)).length;
  const failures = checked.filter(article => article.status === 'failed').length;
  const incomplete = checked.filter(article => article.status === 'incomplete' || article.status === 'verified' && !article.pageDateMatchesFeed).length;
  const selectedCount = counts.get(source.id) || 0;
  const details = feed.attempts?.map(attempt => `${attempt.feedUrl}: ${attempt.error}`).join('; ');
  return { ...source, status: selectedCount ? 'collected' : feed.status === 'failed' ? 'failed' : 'checked', reason: `${feed.inWindow} dated feed items within the window; ${verified} verified article pages, ${failures} failed page fetches, ${incomplete} incomplete pages; ${selectedCount} selected.${feed.newestItemAt ? ` Newest feed item: ${feed.newestItemAt}.` : ''}${details ? ` Feed attempts: ${details}.` : ''}` };
});

const previousPath = join(root, 'data/prepared-update.json');
const previous = existsSync(previousPath) ? JSON.parse(readFileSync(previousPath, 'utf8')) : {};
if (existsSync(previousPath)) {
  if (previous.checkedAt) {
    const archive = join(root, `data/daily-update-${previous.checkedAt.replace(/[:.]/g, '-')}.json`);
    if (!existsSync(archive)) writeFileSync(archive, `${JSON.stringify(previous, null, 2)}\n`);
  }
}
const checkedAt = new Date().toISOString();
const fresh = { title: 'DAILY NEWS UPDATE', checkedAt, windowHours: 24, windowStart: audit.windowStart, windowEnd: audit.windowEnd,
  articles, latestCollectionArticleUrls: articles.map(article => article.url), sourceOutcomes,
  emptyPrepared: false, importedFromSpreadsheet: false };
const edition = appendEditionStories(previous, fresh);
writeFileSync(previousPath, `${JSON.stringify(edition, null, 2)}\n`);
writeFileSync(join(root, `data/daily-update-${checkedAt.replace(/[:.]/g, '-')}.json`), `${JSON.stringify(edition, null, 2)}\n`);

const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
for (const article of articles) {
  if (extractArticleBody(cache.get(article.url)?.page, article.title).split(/\s+/).length >= 25) continue;
  const body = candidates.get(article.title).body;
  cache.putPage(article.url, { markdown: body, metadata: { title: article.title, sourceURL: article.url, publishedTime: article.publishedAt } });
}
console.log(JSON.stringify({ selected: articles.length, added: edition.articles.length - (previous.articles?.length || 0), retained: previous.articles?.length || 0, total: edition.articles.length,
  checkedFeedOutlets: audit.feeds.length, verifiedPages: audit.articles.filter(article => article.status === 'verified' && article.pageDateMatchesFeed && Date.parse(article.pageDate) >= Date.parse(audit.windowStart) && Date.parse(article.pageDate) <= Date.parse(audit.windowEnd)).length, checkedAt }));
