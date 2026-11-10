import express from 'express';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createReportDocx } from './report.js';
import { reportFilename } from '../src/reportFilename.js';
import { publicArticleUrl } from './importArticle.js';
import { readCompletedEdition, storedArticle, storedBody } from './nativeEdition.js';
import { authorisedEditor, collectionStatus, startNativeCollection } from './nativeCollection.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sources = JSON.parse(readFileSync(join(root, 'sources.json'), 'utf8'));
const sourceById = new Map(sources.map(source => [source.id, source]));
const app = express();
app.use(express.json({ limit: '256kb' }));

function editionOrError(res) {
  try { return readCompletedEdition(); }
  catch (error) { res.status(503).json({ error: 'Completed edition unavailable: ' + error.message }); return null; }
}

app.get('/api/config', (_req, res) => res.json({
  sources, collector: 'node', collectionAvailable: Boolean((process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) && (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY))
}));

app.get('/api/daily-update', (_req, res) => {
  const edition = editionOrError(res);
  if (edition) res.json(edition);
});

app.get('/api/daily-update.docx', async (_req, res) => {
  const edition = editionOrError(res);
  if (!edition) return;
  if (!edition.articles.length) return res.status(410).json({ error: 'The completed edition has no stories.' });
  try {
    const buffer = await createReportDocx(edition);
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="' + reportFilename(edition) + '"');
    res.send(Buffer.from(buffer));
  } catch (error) { res.status(500).json({ error: 'Could not create daily update: ' + error.message }); }
});

app.get('/api/collection', (_req, res) => res.json(collectionStatus()));
app.post('/api/collection', async (req, res) => {
  try {
    if (!await authorisedEditor(req.get('Authorization'))) return res.status(403).json({ error: 'Editor sign-in is required to start collection.' });
    if (collectionStatus().state === 'running') return res.status(409).json(collectionStatus());
    res.status(202).json(startNativeCollection({ cwd: root }));
  } catch (error) { res.status(503).json({ error: 'Could not verify editor: ' + error.message }); }
});

// These routes read completed JSON; none requests a publisher page or scraper service.
app.post('/api/headlines', (req, res) => {
  const source = sourceById.get(req.body?.sourceId);
  if (!source) return res.status(400).json({ error: 'Choose a source from the list.' });
  const edition = editionOrError(res);
  if (!edition) return;
  const headlines = edition.articles.filter(article => article.sourceId === source.id || source.legacySourceIds?.includes(article.sourceId));
  res.json({ source, headlines, fetchedAt: edition.checkedAt, collectionMethod: 'completed-json', note: 'Read from the completed Node collector edition.' });
});

function articleRequest(req, res) {
  const url = publicArticleUrl(req.body?.url);
  if (!url) { res.status(400).json({ error: 'Enter a public HTTPS article URL.' }); return null; }
  const edition = editionOrError(res);
  if (!edition) return null;
  const article = storedArticle(edition, url.href);
  if (!article) { res.status(404).json({ error: 'This URL is not in the completed edition. Add it manually in the editor.' }); return null; }
  return article;
}

app.post('/api/article', (req, res) => {
  const article = articleRequest(req, res);
  if (article) res.json(article);
});
app.post('/api/import-article', (req, res) => {
  const article = articleRequest(req, res);
  if (article) res.json(article);
});
app.post('/api/article-body', (req, res) => {
  const article = articleRequest(req, res);
  if (!article) return;
  const body = storedBody(article);
  if (!body) return res.status(404).json({ error: 'The completed JSON has no full article text for this story.' });
  res.json(body);
});

app.post('/api/report.docx', async (req, res) => {
  const articles = Array.isArray(req.body?.articles) ? req.body.articles.slice(0, 300) : [];
  if (!articles.length || articles.some(article => !article.reviewed || !article.title?.trim() || !article.sourceName?.trim() || !publicArticleUrl(article.url)))
    return res.status(400).json({ error: 'Review each selected headline and provide its source before export.' });
  try {
    const buffer = await createReportDocx({ title: String(req.body.title ?? '').slice(0, 120), articles, sourceOutcomes: Array.isArray(req.body.sourceOutcomes) ? req.body.sourceOutcomes : [] });
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', 'attachment; filename="' + reportFilename(req.body) + '"');
    res.send(Buffer.from(buffer));
  } catch (error) { res.status(500).json({ error: 'Could not create report: ' + error.message }); }
});

if (process.env.NODE_ENV === 'production') app.use(express.static(join(root, 'dist')));
if (process.env.NODE_ENV === 'production') app.get('*', (_req, res) => res.sendFile(join(root, 'dist', 'index.html')));

const port = Number(process.env.PORT || 3001);
app.listen(port, '0.0.0.0', () => console.log('DNU server listening on ' + port));
