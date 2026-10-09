import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const words = text => [...new Set(text.split(/[,\n]/).map(x => x.trim()).filter(Boolean))].slice(0, 25);
const dateLabel = iso => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function App() {
  const [config, setConfig] = useState(null);
  const [activeId, setActiveId] = useState('google-news');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All sources');
  const [includeText, setIncludeText] = useState(() => readStored('signal-include', 'security, politics, defense, diplomacy, election, conflict'));
  const [excludeText, setExcludeText] = useState(() => readStored('signal-exclude', ''));
  const [scope, setScope] = useState(() => ({ include: words(readStored('signal-include', 'security, politics, defense, diplomacy, election, conflict')), exclude: words(readStored('signal-exclude', '')) }));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => readStored('signal-selected', []));
  const [reportTitle, setReportTitle] = useState(() => readStored('signal-title', 'Security & politics briefing'));
  const [toast, setToast] = useState('');

  useEffect(() => { fetch('/api/config').then(r => r.json()).then(setConfig).catch(() => setError('The server is unavailable. Start the API and refresh.')); }, []);
  useEffect(() => { localStorage.setItem('signal-selected', JSON.stringify(selected)); }, [selected]);
  useEffect(() => { localStorage.setItem('signal-title', JSON.stringify(reportTitle)); }, [reportTitle]);
  const sources = config?.sources ?? [];
  const active = sources.find(x => x.id === activeId);
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const selectedIds = useMemo(() => new Set(selected.map(x => x.id)), [selected]);

  function applyScope() {
    const next = { include: words(includeText), exclude: words(excludeText) };
    localStorage.setItem('signal-include', JSON.stringify(includeText));
    localStorage.setItem('signal-exclude', JSON.stringify(excludeText));
    setScope(next);
    setResult(null);
    setError('');
    setToast('Scope updated. Refresh a source to collect matching headlines.');
  }
  async function loadSource(id = activeId) {
    setBatchProgress(null);
    setActiveId(id);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: id, ...scope }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Collection failed');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function loadVisible() {
    if (!visibleSources.length) return;
    setLoading(true);
    setError('');
    setResult({ headlines: [], fetchedAt: new Date().toISOString(), batch: true });
    setBatchProgress({ done: 0, total: visibleSources.length, failed: 0 });
    let cursor = 0, done = 0, failed = 0;
    const gathered = [];
    const worker = async () => {
      while (cursor < visibleSources.length) {
        const source = visibleSources[cursor++];
        try {
          const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: source.id, ...scope }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          gathered.push(...data.headlines);
          setResult({ headlines: [...gathered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date().toISOString(), batch: true });
        } catch { failed++; }
        done++;
        setBatchProgress({ done, total: visibleSources.length, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, visibleSources.length) }, worker));
    setLoading(false);
    if (failed) setError(`${failed} source${failed === 1 ? '' : 's'} could not be collected. Other results are shown below.`);
  }
  function toggle(item) { setSelected(current => selectedIds.has(item.id) ? current.filter(x => x.id !== item.id) : [...current, item]); }
  const markdown = `# ${reportTitle.trim() || 'News briefing'}\n\nPrepared ${new Date().toLocaleString()}\n\n${selected.map((x, i) => `## ${i + 1}. ${x.title}\n\n- Source: ${x.sourceName}\n- Published: ${dateLabel(x.publishedAt)}\n- Link: ${x.url}${x.summary ? `\n\n${x.summary}` : ''}`).join('\n\n')}\n`;
  function downloadReport() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `signal-desk-${new Date().toISOString().slice(0, 10)}.md`; a.click();
    URL.revokeObjectURL(url);
  }

  return <div className="app-shell">
    <header className="topbar"><div className="brand-mark">S<span>✳</span></div><div className="brand-text"><strong>SIGNAL DESK</strong><small>NEWS MONITORING WORKSPACE</small></div><span className="topbar-spacer"/><div className="live-pill"><span/> LIVE WORKSPACE</div><div className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">DISCOVER</span><h2>Sources <em>{sources.length}</em></h2><p>Browse the outlets in your monitoring list.</p></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${activeId === x.id ? 'active' : ''}`} onClick={() => { setActiveId(x.id); setResult(null); setError(''); }}><span className="source-icon">{x.id === 'google-news' ? 'G' : x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong><small>{x.group}</small></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length - 1} curated outlets · Google News</div>
      </aside>
      <main className="main-panel">
        <div className="hero"><div><span className="eyebrow">INTELLIGENCE / DAILY BRIEF</span><h1>Find the stories<br/><i>that matter.</i></h1><p>Review timely coverage from your trusted sources. Keep the signal, leave the noise.</p></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-globe">✳</div><span className="art-label">MONITORING<br/>IN PROGRESS</span></div></div>
        <section className="scope-card"><div className="section-title"><div><span className="eyebrow">01 / REFINE</span><h2>Your coverage scope</h2></div><span className="scope-hint">Comma-separated phrases</span></div><div className="scope-inputs"><label><span className="input-label"><b className="include-dot"/> INCLUDE KEYWORDS</span><textarea value={includeText} onChange={e => setIncludeText(e.target.value)} rows="2" placeholder="security, politics, election"/></label><label><span className="input-label"><b className="exclude-dot"/> EXCLUDE KEYWORDS</span><textarea value={excludeText} onChange={e => setExcludeText(e.target.value)} rows="2" placeholder="sports, entertainment, opinion"/></label></div><div className="scope-bottom"><span>Matches any included phrase in the headline or summary. Exclusions always apply.</span><button className="dark-button" onClick={applyScope}>Apply scope <span>↗</span></button></div></section>
        <section className="headlines-section"><div className="section-title"><div><span className="eyebrow">02 / REVIEW</span><h2>Latest headlines</h2></div><span className="time-filter">◷ &nbsp; LAST 24 HOURS</span></div><div className="source-banner"><div className="banner-icon">{active?.id === 'google-news' ? 'G' : active?.name?.[0] || 'S'}</div><div><strong>{active?.name || 'Select a source'}</strong><small>{active?.url || 'Choose an outlet from the left'}</small></div><button onClick={() => loadSource()} disabled={loading || !active}>{loading ? 'Collecting…' : 'Collect headlines'} <span>↗</span></button></div><div className="batch-row"><span>Or collect from every source currently shown in the sidebar. Firecrawl usage scales with the source count.</span><button onClick={loadVisible} disabled={loading || !config?.firecrawlConfigured || !visibleSources.length}>Collect visible sources ({visibleSources.length})</button></div>
          {!config?.firecrawlConfigured && <div className="notice"><strong>Firecrawl connection needed</strong><p>Add <code>FIRECRAWL_API_KEY</code> to the server environment to collect live headlines. See the README for setup.</p></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {loading && <div className="loading-box"><div className="spinner"/> {batchProgress ? `Collected ${batchProgress.done} of ${batchProgress.total} sources${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}` : 'Scraping and checking publication times…'}</div>}
          {result && <><div className="result-meta">{result.headlines.length} verified headlines · Checked {dateLabel(result.fetchedAt)}</div>{result.headlines.length ? <div className="headline-list">{result.headlines.map(item => <article className="headline-card" key={item.id}><div className="headline-top"><span className="category-label">{item.sourceName}</span><span>{dateLabel(item.publishedAt)}</span></div><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3>{item.summary && <p>{item.summary}</p>}<button className={`select-button ${selectedIds.has(item.id) ? 'selected' : ''}`} onClick={() => toggle(item)}>{selectedIds.has(item.id) ? '✓ Added to report' : '＋ Add to report'}</button></article>)}</div> : <div className="empty-result">No matching headlines with verified publication times in the last 24 hours. Try broader keywords or a different source.</div>}</>}
          {!loading && !result && !error && <div className="empty-result"><span className="empty-symbol">◎</span><strong>Your next story starts here.</strong><p>Choose a source or collect all visible sources. Results are filtered to the past 24 hours.</p></div>}
        </section>
      </main>
      <aside className="report-panel"><div className="report-header"><span className="eyebrow">03 / COMPOSE</span><h2>Your report <em>{selected.length}</em></h2><p>Handpick the stories worth sharing.</p></div><label className="report-title-label">REPORT TITLE<input value={reportTitle} onChange={e => setReportTitle(e.target.value)} maxLength="100"/></label><div className="selected-list">{selected.length ? selected.map((item, i) => <div className="selected-item" key={item.id}><span className="selected-index">{String(i + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.sourceName} · {dateLabel(item.publishedAt)}</small></div><button aria-label={`Remove ${item.title}`} onClick={() => toggle(item)}>×</button></div>) : <div className="report-empty"><div>▤</div><strong>A clear desk, for now.</strong><p>Headlines you add will appear here, ready for your report.</p></div>}</div><div className="report-bottom"><div className="report-count"><span>SELECTED STORIES</span><strong>{String(selected.length).padStart(2, '0')}</strong></div><button className="export-button" disabled={!selected.length} onClick={downloadReport}>Download report <span>↓</span></button><small>Exports a Markdown file with links and source details.</small></div></aside>
    </div>{toast && <div className="toast" onClick={() => setToast('')}>{toast} ×</div>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
