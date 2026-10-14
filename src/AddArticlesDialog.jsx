import React, { useState } from 'react';
import { formatViennaDateTime } from './viennaTime.js';
import { MISCELLANEOUS_COUNTRIES } from './newsSections.js';

export default function AddArticlesDialog({ serverAvailable, sources, sections, existingUrls, remainingSlots, onAdd, onClose }) {
  const [value, setValue] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [results, setResults] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const availableSections = sections.filter(section => section.visible);

  function changeDraft(id, change) {
    setDrafts(current => current.map(draft => draft.id === id ? { ...draft, ...change } : draft));
  }

  function addDraft(draft) {
    const section = availableSections.find(item => item.id === draft.sectionId);
    if (!section || (section.subsections.length && !section.subsections.includes(draft.subsection)) ||
      (draft.sectionId === 'Miscellaneous' && !(MISCELLANEOUS_COUNTRIES[draft.subsection]?.includes(draft.country) || (!MISCELLANEOUS_COUNTRIES[draft.subsection] && draft.country.trim()))) ||
      (draft.russianSource && (draft.sectionId !== 'Miscellaneous' || draft.subsection !== 'RUSSIA / EURASIA')) || remainingSlots < 1) return;
    const { added, russianSource, ...story } = draft;
    onAdd(story);
    changeDraft(draft.id, { added: true });
  }

  async function importUrls(event) {
    event.preventDefault();
    const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    if (!lines.length) { setResults([{ url: '', message: 'Paste at least one article URL.' }]); return; }
    if (lines.length > 10) { setResults([{ url: '', message: 'Import up to 10 URLs at a time.' }]); return; }
    setBusy(true);
    const next = [];
    const pending = [];
    const seen = new Set([...existingUrls, ...drafts.map(draft => draft.url)]);
    const pendingCount = drafts.filter(draft => !draft.added).length;
    let lastDirectStart = 0;
    for (const [index, line] of lines.entries()) {
      setProgress(`Checking ${index + 1} of ${lines.length}…`);
      let url;
      try { url = new URL(line); if (url.protocol !== 'https:') throw new Error(); }
      catch { next.push({ url: line, message: 'Use a full HTTPS article URL.' }); continue; }
      if (seen.has(url.href)) { next.push({ url: line, message: 'Already in the update.' }); continue; }
      if (pendingCount + pending.length >= remainingSlots) { next.push({ url: line, message: 'The browser has reached its 100 custom-story limit.' }); continue; }
      try {
        let result;
        if (serverAvailable) {
          const response = await fetch('/api/import-article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.href, allowUnplaced: true }) });
          result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Could not scrape this article.');
        } else {
          const delay = Math.max(0, 6500 - (Date.now() - lastDirectStart));
          if (delay) await new Promise(resolve => setTimeout(resolve, delay));
          lastDirectStart = Date.now();
          const { importDirectArticle } = await import('./importClient.js');
          result = await importDirectArticle(url.href, apiKey.trim(), sources, fetch, { allowUnplaced: true });
        }
        pending.push({ ...result, added: false });
        seen.add(url.href);
      } catch (error) { next.push({ url: line, message: error.message || 'Could not add this article.' }); }
    }
    setDrafts(current => [...current, ...pending]);
    setResults(next);
    setProgress('');
    setBusy(false);
  }

  return <div className="add-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog" role="dialog" aria-modal="true" aria-labelledby="add-dialog-title">
      <div className="add-dialog-heading"><h2 id="add-dialog-title">Add articles to the update</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close Add articles">×</button></div>
      <p>Paste one English-language article URL per line. Review the suggested section and country for each scraped story before adding it. Articles of any age can be added. If the page lacks an exact publication time, Add estimates it from the article or URL; if no date is found, it stamps the import time. Times are shown in Vienna time (CET/CEST).</p>
      {!serverAvailable && <p className="add-unavailable">This static page needs your Firecrawl API key to scrape articles. It is sent directly to Firecrawl for this import and is not saved by the site.</p>}
      {remainingSlots < 1 && <p className="add-unavailable" role="status">The browser has reached its 100 custom-story limit. Remove an added story in Manage site → Stories before importing another.</p>}
      <form onSubmit={importUrls}>{!serverAvailable && <><label htmlFor="add-api-key">Firecrawl API key</label><input id="add-api-key" type="password" autoComplete="off" value={apiKey} onChange={event => setApiKey(event.target.value)} placeholder="fc-…" disabled={busy}/></>}<label htmlFor="add-urls">Article URLs</label><textarea id="add-urls" rows="7" value={value} onChange={event => setValue(event.target.value)} placeholder={'https://example.com/article-one\nhttps://example.com/article-two'} autoFocus disabled={busy}/><div className="add-dialog-actions"><button type="button" onClick={onClose} disabled={busy}>Close</button><button type="submit" disabled={(!serverAvailable && !apiKey.trim()) || busy || remainingSlots < 1}>{busy ? progress : 'Scrape articles'}</button></div></form>
      {drafts.length > 0 && <div className="add-drafts" aria-live="polite"><h3>Review placement</h3>{drafts.map(draft => {
        const section = availableSections.find(item => item.id === draft.sectionId);
        const subsections = section?.subsections || [];
        const countries = draft.sectionId === 'Miscellaneous' ? MISCELLANEOUS_COUNTRIES[draft.subsection] || [] : [];
        const valid = section && (!subsections.length || subsections.includes(draft.subsection)) && (draft.sectionId !== 'Miscellaneous' || countries.includes(draft.country) || (!MISCELLANEOUS_COUNTRIES[draft.subsection] && draft.country.trim())) && (!draft.russianSource || (draft.sectionId === 'Miscellaneous' && draft.subsection === 'RUSSIA / EURASIA'));
        return <div className="add-draft" key={draft.id}><strong>{draft.title}</strong><small>{draft.sourceName} · {formatViennaDateTime(draft.publishedAt)}{draft.timeSource !== 'page' ? ' · estimated' : ''}</small><div className="add-placement">
          <label>Section<select value={draft.sectionId} onChange={event => changeDraft(draft.id, { sectionId: event.target.value, subsection: '', country: '' })} disabled={draft.added}><option value="">Choose section</option>{availableSections.filter(item => !draft.russianSource || item.id === 'Miscellaneous').map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>{draft.sectionId === 'Miscellaneous' ? 'Subsection' : 'Country / topic'}<select value={draft.subsection} onChange={event => changeDraft(draft.id, { subsection: event.target.value, country: '' })} disabled={draft.added || !section}><option value="">{subsections.length ? 'Choose location' : 'No subsection'}</option>{subsections.filter(name => !draft.russianSource || name === 'RUSSIA / EURASIA').map(name => <option key={name} value={name}>{name}</option>)}</select></label>
          {draft.sectionId === 'Miscellaneous' && <label>Country / organisation{MISCELLANEOUS_COUNTRIES[draft.subsection] ? <select value={draft.country} onChange={event => changeDraft(draft.id, { country: event.target.value })} disabled={draft.added || !countries.length}><option value="">Choose country or organisation</option>{countries.map(name => <option key={name} value={name}>{name}</option>)}</select> : <input value={draft.country} maxLength={100} onChange={event => changeDraft(draft.id, { country: event.target.value })} disabled={draft.added || !draft.subsection} placeholder="Country or organisation"/>}</label>}
        </div><button type="button" onClick={() => addDraft(draft)} disabled={draft.added || !valid || remainingSlots < 1}>{draft.added ? 'Added to update' : 'Add to update'}</button></div>;
      })}</div>}
      {results.length > 0 && <ul className="add-results" aria-live="polite">{results.map((result, index) => <li key={`${result.url}-${index}`} className={result.success ? 'success' : 'failure'}><strong>{result.url}</strong><span>{result.message}</span></li>)}</ul>}
    </section>
  </div>;
}
