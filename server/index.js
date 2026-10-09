import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DEFAULT_INCLUDE, DEFAULT_EXCLUDE, normalizeArticles, parseWords, scrapeHeadlines } from './news.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = [
  { id: 'google-news', name: 'Google News', group: 'Google News', url: 'https://news.google.com/' },
  ...JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'))
];
const sourceById = new Map(sources.map(source => [source.id, source]));
const cache = new Map();
const app = express();
app.use(express.json({ limit: '16kb' }));

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

if (process.env.NODE_ENV === 'production') app.use(express.static(join(root, 'dist')));
if (process.env.NODE_ENV === 'production') app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')));

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log(`Signal Desk server listening on ${port}`));
