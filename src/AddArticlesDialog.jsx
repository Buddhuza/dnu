import React, { useState } from 'react';
import { formatViennaDateTime } from './viennaTime.js';

export default function AddArticlesDialog({ serverAvailable, sources, existingUrls, remainingSlots, onAdd, onClose }) {
  const [value, setValue] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState([]);

  async function importUrls(event) {
    event.preventDefault();
    const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) { setResults([{ url: '', message: 'Paste at least one article URL.' }]); return; }
    if (lines.length > 10) { setResults([{ url: '', message: 'Import up to 10 URLs at a time.' }]); return; }
    setBusy(true);
    const next = [];
    const seen = new Set(existingUrls);
    let added = 0;
    let lastDirectStart = 0;
    for (const [index, line] of lines.entries()) {
      setProgress(`Checking ${index + 1} of ${lines.length}…`);
      let url;
      try { url = new URL(line); if (url.protocol !== 'https:') throw new Error(); }
      catch { next.push({ url: line, message: 'Use a full HTTPS article URL.' }); continue; }
      if (seen.has(url.href)) { next.push({ url: line, message: 'Already in the update.' }); continue; }
      if (added >= remainingSlots) { next.push({ url: line, message: 'The browser has reached its 100 custom-story limit.' }); continue; }
      try {
        let result;
        if (serverAvailable) {
          const response = await fetch('/api/import-article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href }) });
          result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not scrape this article.');
        } else {
          const delay = Math.max(0, 6500 - (Date.now() - lastDirectStart));
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          lastDirectStart = Date.now();
          const { importDirectArticle } = await import('./importClient.js');
          result = await importDirectArticle(url.href, apiKey.trim(), sources);
        }
        onAdd(result);
        added++;
        seen.add(url.href);
        const timeLabel = result.timeSource === 'current' ? 'No article date found; stamped when added' : result.timeSource === 'inferred' ? 'Date/time inferred from article' : 'Article date/time';
        next.push({ url: line, message: `Added: ${result.title} → ${result.sectionId} / ${result.subsection}${result.country ? ` / ${result.country}` : ''}. ${timeLabel}: ${formatViennaDateTime(result.publishedAt)}.`, success: true });
      } catch (error) { next.push({ url: line, message: error.message || 'Could not add this article.' }); }
    }
    setResults(next);
    setProgress('');
    setBusy(false);
  }

  return <div className="add-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
      <div className="add-dialog-heading"><h2 id="add-dialog-title">Add articles to the update</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close Add articles">×</button></div>
      <p>Paste one English-language article URL per line. Articles of any age can be added. If the page lacks an exact publication time, Add estimates it from the article or URL; if no date is found, it stamps the import time. Times are shown in Vienna time (CET/CEST).</p>
      {!serverAvailable && <p className="add-unavailable">This static page needs your Firecrawl API key to scrape articles. It is sent directly to Firecrawl for this import and is not saved by the site.</p>}
      {remainingSlots < 1 && <p className="add-unavailable" role="status">The browser has reached its 100 custom-story limit. Remove an added story in Manage site → Stories before importing another.</p>}
      <form onSubmit={importUrls}>{!serverAvailable && <><label htmlFor="add-api-key">Firecrawl API key</label><input id="add-api-key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="fc-…" disabled={busy}/></>}<label htmlFor="add-urls">Article URLs</label><textarea id="add-urls" rows="7" value={value} onChange={event => setValue(event.target.value)} placeholder={'https://example.com/article-one\nhttps://example.com/article-two'} autoFocus disabled={busy}/><div className="add-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Close</button><button type="submit" disabled={(!serverAvailable && !apiKey.trim()) || busy || remainingSlots < 1}>{busy ? progress : 'Scrape and add'}</button></div></form>
      {results.length > 0 && <ul className="add-results" aria-live="polite">{results.map((result, index) => <li key={`${result.url}-${index}`} className={result.success ? 'success' : 'failure'}><strong>{result.url}</strong><span>{result.message}</span></li>)}</ul>}
    </section>
  </div>;
}
