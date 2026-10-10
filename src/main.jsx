import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import preparedUpdate from '../data/daily-update-2026-10-09.json';
import preparedSources from '../sources.json';
import publishedSiteConfig from '../data/site-config.json';
import SiteManager from './SiteManager.jsx';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent } from './siteConfig.js';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import './styles.css';

const readStored = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const words = text => [...new Set(text.split(/[,\n]/).map(x => x.trim()).filter(Boolean))].slice(0, 25);
const defaultScope = 'security, politics, political, defense, diplomacy, election, conflict, war, terrorism, parliament, government, minister, president, police, military, NATO, Russia, Ukraine, attack, sanctions, protest';
const dateLabel = iso => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function App() {
  const [config, setConfig] = useState(null);
  const [daily, setDaily] = useState(null);
  const [staticPreview, setStaticPreview] = useState(false);
  const [activeId, setActiveId] = useState('google-news');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All sources');
  const [includeText, setIncludeText] = useState(() => readStored('signal-include', defaultScope));
  const [excludeText, setExcludeText] = useState(() => readStored('signal-exclude', ''));
  const [scope, setScope] = useState(() => ({ include: words(readStored('signal-include', defaultScope)), exclude: words(readStored('signal-exclude', '')) }));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(() => readStored('signal-selected', []));
  const [reviewingId, setReviewingId] = useState('');
  const [reviewErrors, setReviewErrors] = useState({});
  const [sourceOutcomes, setSourceOutcomes] = useState({});
  const [reportTitle, setReportTitle] = useState(() => readStored('signal-title', 'Security & politics briefing'));
  const [toast, setToast] = useState('');
  const [managing, setManaging] = useState(false);
  const [siteConfig, setSiteConfig] = useState(() => normalizeSiteConfig(readStored('signal-site-settings-v1', publishedSiteConfig), preparedUpdate.articles));

  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(setConfig).catch(() => setConfig({ sources: [{ id: 'google-news', name: 'Google News', group: 'Google News', url: 'https://news.google.com/' }, ...preparedSources], firecrawlConfigured: false })); }, []);
  useEffect(() => {
    const refresh = () => fetch('/api/daily-update').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(data => { setDaily(data); setStaticPreview(false); }).catch(() => { setDaily(preparedUpdate); setStaticPreview(true); });
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('signal-selected', JSON.stringify(selected)); }, [selected]);
  useEffect(() => { localStorage.setItem('signal-title', JSON.stringify(reportTitle)); }, [reportTitle]);
  useEffect(() => { localStorage.setItem('signal-site-settings-v1', JSON.stringify(siteConfig)); document.title = siteConfig.brandName || 'Signal Desk'; }, [siteConfig]);
  const sources = config?.sources ?? [];
  const active = sources.find(x => x.id === activeId);
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const selectedIds = useMemo(() => new Set(selected.map(x => x.id)), [selected]);
  const displayedArticles = useMemo(() => displaySiteContent(daily?.articles ?? [], siteConfig), [daily, siteConfig]);
  const themeStyle = {
    '--site-primary': siteConfig.theme.primary, '--site-accent': siteConfig.theme.accent,
    '--site-bg': siteConfig.theme.background, '--site-surface': siteConfig.theme.surface,
    '--site-text': siteConfig.theme.text, '--site-section': siteConfig.theme.section,
    '--site-font': siteConfig.theme.font === 'Georgia' ? 'Georgia, serif' : `'${siteConfig.theme.font}', sans-serif`
  };
  const dailySections = useMemo(() => {
    const sections = new Map();
    for (const item of displayedArticles) {
      if (!sections.has(item.section)) sections.set(item.section, new Map());
      const subsections = sections.get(item.section);
      const label = item.subsection || '';
      if (!subsections.has(label)) subsections.set(label, []);
      subsections.get(label).push(item);
    }
    return [...sections].map(([section, subsections]) => ({ section, subsections: [...subsections] }));
  }, [displayedArticles]);
  const blockedDailySources = daily?.sourceOutcomes?.filter(x => /failed|unreadable|could not be fetched/i.test(x.status)) ?? [];

  function applyScope() {
    const next = { include: words(includeText), exclude: words(excludeText) };
    localStorage.setItem('signal-include', JSON.stringify(includeText));
    localStorage.setItem('signal-exclude', JSON.stringify(excludeText));
    setScope(next);
    setResult(null);
    setError('');
    setToast('Scope updated. Refresh a source to collect matching headlines.');
  }
  async function loadSource(id = activeId, deepScan = false) {
    setBatchProgress(null);
    setActiveId(id);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: id, deepScan, ...scope }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Collection failed');
      setResult(data);
      setSourceOutcomes(current => ({ ...current, [id]: data.headlines.length ? 'collected' : `no verified headline in this scan (${data.candidatesChecked} of ${data.candidatesFound} undated candidates checked)` }));
    } catch (e) { setError(e.message); setSourceOutcomes(current => ({ ...current, [id]: 'collection failed' })); }
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
          setSourceOutcomes(current => ({ ...current, [source.id]: data.headlines.length ? 'collected' : `no verified headline in this scan (${data.candidatesChecked} of ${data.candidatesFound} undated candidates checked)` }));
          setResult({ headlines: [...gathered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date().toISOString(), batch: true });
        } catch { failed++; setSourceOutcomes(current => ({ ...current, [source.id]: 'collection failed' })); }
        done++;
        setBatchProgress({ done, total: visibleSources.length, failed });
      }
    };
    await Promise.all(Array.from({ length: Math.min(4, visibleSources.length) }, worker));
    setLoading(false);
    if (failed) setError(`${failed} source${failed === 1 ? '' : 's'} could not be collected. Other results are shown below.`);
  }
  function toggle(item) { setSelected(current => selectedIds.has(item.id) ? current.filter(x => x.id !== item.id) : [...current, { ...item, section: item.section || item.group, subsection: item.subsection || '', reviewed: Boolean(item.reviewed) }]); }
  async function reviewArticle(item) {
    setReviewingId(item.id);
    setReviewErrors(current => ({ ...current, [item.id]: '' }));
    try {
      const response = await fetch('/api/article', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId: item.sourceId, url: item.url }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Article review failed');
      setSelected(current => current.map(x => x.id === item.id ? { ...x, ...data, reviewed: true, section: x.section || item.group, subsection: x.subsection || '' } : x));
    } catch (e) { setReviewErrors(current => ({ ...current, [item.id]: e.message })); }
    finally { setReviewingId(''); }
  }
  function updateSelected(id, field, value) { setSelected(current => current.map(x => x.id === id ? { ...x, [field]: value } : x)); }
  const missingSources = sources.filter(x => x.id !== 'google-news' && sourceOutcomes[x.id] && sourceOutcomes[x.id] !== 'collected');
  const grouped = new Map();
  for (const item of selected) {
    const section = item.section?.trim() || item.group || 'Miscellaneous';
    if (!grouped.has(section)) grouped.set(section, []);
    grouped.get(section).push(item);
  }
  const reportBody = [...grouped].map(([section, items]) => `## ${section.toUpperCase()}\n\n${items.map(x => `${x.subsection?.trim() ? `### ${x.subsection.trim().toUpperCase()}\n\n` : ''}${x.title.replace(/[.!?]$/, '')}. ${x.summary.trim()} ([${x.sourceName}](${x.url}))`).join('\n\n')}`).join('\n\n');
  const blockedSources = missingSources.filter(x => /failed|unreadable|could not be fetched/i.test(sourceOutcomes[x.id]));
  const unselectedSources = missingSources.filter(x => !/failed|unreadable|could not be fetched/i.test(sourceOutcomes[x.id]));
  const missingBody = `${blockedSources.length ? `\n\n## SOURCES THAT COULD NOT BE READ\n\n${blockedSources.map(x => `- ${x.name}: ${sourceOutcomes[x.id]}`).join('\n')}` : ''}${unselectedSources.length ? `\n\n## OTHER SOURCES WITHOUT A SELECTED ARTICLE\n\nThese pages were fetched, but this selected roundup did not assess every article on them.\n\n${unselectedSources.map(x => `- ${x.name}`).join('\n')}` : ''}`;
  const markdown = `# ${reportTitle.trim() || 'Daily news update'}\n\nPrepared ${new Date().toLocaleString()} · last 24 hours\n\n${reportBody}${missingBody}\n`;
  const reportReady = selected.length > 0 && selected.every(x => x.reviewed && x.summary?.trim());
  function downloadReport() {
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `signal-desk-${new Date().toISOString().slice(0, 10)}.md`; a.click();
    URL.revokeObjectURL(url);
  }
  async function downloadDocx() {
    try {
      const sourceOutcomesList = sources.filter(x => x.id !== 'google-news' && sourceOutcomes[x.id]).map(x => ({ name: x.name, group: x.group, url: x.url, status: sourceOutcomes[x.id] }));
      const response = await fetch('/api/report.docx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: reportTitle, articles: selected, sourceOutcomes: sourceOutcomesList, coverageNote: `${selected.length} selected articles. ${sourceOutcomesList.length} of ${sources.length - 1} listed source pages attempted in this session. Fetched pages without a selected article were not assessed exhaustively and may have other relevant coverage.` }) });
      if (!response.ok) throw new Error((await response.json()).error || 'Report export failed');
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement('a'); a.href = url; a.download = `daily-news-update-${new Date().toISOString().slice(0, 10)}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setToast(e.message); }
  }
  async function downloadManagedDocx() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}daily-update-template.docx`);
      if (!response.ok) throw new Error('The Word template is unavailable.');
      const templateBytes = await response.arrayBuffer();
      const title = siteConfig.updateTitle === 'Daily news update' ? daily?.title : siteConfig.updateTitle;
      const coverageNote = `Customised website copy based on the update prepared ${daily?.checkedAt || 'earlier'}. Headlines, summaries, sections, and manually added stories may have been edited in this browser; check their original articles before sharing.`;
      const file = await createReportDocxFromTemplate(templateBytes, { title, articles: displayedArticles, sourceOutcomes: daily?.sourceOutcomes ?? [], coverageNote });
      const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a'); a.href = url; a.download = 'customised-daily-news-update.docx'; a.click();
      URL.revokeObjectURL(url);
    } catch (error) { setToast(error.message || 'Could not create the Word update.'); }
  }

  return <div className="app-shell" style={themeStyle}>
    <header className="topbar"><div className="brand-mark">{siteConfig.brandName?.[0] || 'S'}<span>✳</span></div><div className="brand-text"><strong>{siteConfig.brandName}</strong><small>{siteConfig.brandTagline}</small></div><span className="topbar-spacer"/><button className="manage-button" onClick={() => setManaging(true)}>⚙ Manage site</button><div className="live-pill"><span/> LIVE WORKSPACE</div><div className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div></header>
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">DISCOVER</span><h2>Sources <em>{sources.length}</em></h2><p>Browse the outlets in your monitoring list.</p></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${activeId === x.id ? 'active' : ''}`} onClick={() => { setActiveId(x.id); setResult(null); setError(''); }}><span className="source-icon">{x.id === 'google-news' ? 'G' : x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong><small>{x.group}</small></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length - 1} curated outlets · Google News</div>
      </aside>
      <main className="main-panel">
        {siteConfig.showHero && <div className="hero"><div><span className="eyebrow">{siteConfig.eyebrow}</span><h1>{siteConfig.heroTitle}<br/><i>{siteConfig.heroAccent}</i></h1><p>{siteConfig.heroDescription}</p></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-globe">✳</div><span className="art-label">MONITORING<br/>IN PROGRESS</span></div></div>}
        <section className="daily-update" aria-labelledby="daily-update-title">
          <div className="daily-heading"><div><span className="eyebrow">TODAY'S ROUNDUP</span><h2 id="daily-update-title">{siteConfig.updateTitle}</h2><p>{daily ? `${displayedArticles.length} displayed articles · ${new Set(displayedArticles.map(x => x.sourceName)).size} agencies · Prepared ${dateLabel(daily.checkedAt)}` : 'Loading the latest prepared update…'}</p></div>{daily?.articles?.length > 0 && <div className="daily-downloads"><button className="daily-download" disabled={!displayedArticles.length} onClick={downloadManagedDocx}>Download customised Word ↓</button><a className="daily-original" href={staticPreview ? `${import.meta.env.BASE_URL}daily-news-update-2026-10-09.docx` : '/api/daily-update.docx'}>Original update</a></div>}</div>
          {daily && <>{siteConfig.showCoverage && <p className="daily-coverage">{siteConfig.coverageText || (staticPreview ? 'Prepared snapshot for 9 October 2026. Stories were within the prior 24 hours when this update was made; this archive does not refresh automatically.' : 'Stories shown here have publication times within the past 24 hours. This is a selected roundup; accessible sources were not reviewed exhaustively. Older stories leave the stream as the window moves.')}</p>}{dailySections.map(({ section, subsections }) => <div className="daily-section" key={section}><h3>{section}</h3>{subsections.map(([subsection, items]) => <div key={subsection}>{subsection && <h4>{subsection}</h4>}{items.map(item => <article className="daily-story" key={item.id}><p><strong>{item.title}{/[.!?]$/.test(item.title) ? '' : '.'}</strong> {item.summary} (<a href={item.url} target="_blank" rel="noopener noreferrer">{item.sourceName}</a>)</p><button onClick={() => toggle(item)}>{selectedIds.has(item.id) ? 'Remove from report' : 'Add to report'}</button></article>)}</div>)}</div>)}{!displayedArticles.length && <p className="daily-empty">There are no visible stories in this update. Use Manage site to show or add content.</p>}{blockedDailySources.length > 0 && <details className="daily-sources"><summary>Sources we could not read ({blockedDailySources.length})</summary><ul>{blockedDailySources.map((item, i) => <li key={`${item.name}-${i}`}>{item.name}: {item.status}</li>)}</ul></details>}</>}
        </section>
        <section className="scope-card"><div className="section-title"><div><span className="eyebrow">01 / REFINE</span><h2>Your coverage scope</h2></div><span className="scope-hint">Comma-separated phrases</span></div><div className="scope-inputs"><label><span className="input-label"><b className="include-dot"/> INCLUDE KEYWORDS</span><textarea value={includeText} onChange={e => setIncludeText(e.target.value)} rows="2" placeholder="security, politics, election"/></label><label><span className="input-label"><b className="exclude-dot"/> EXCLUDE KEYWORDS</span><textarea value={excludeText} onChange={e => setExcludeText(e.target.value)} rows="2" placeholder="sports, entertainment, opinion"/></label></div><div className="scope-bottom"><span>Matches any included phrase in the headline or summary. Exclusions always apply.</span><button className="dark-button" onClick={applyScope}>Apply scope <span>↗</span></button></div></section>
        <section className="headlines-section"><div className="section-title"><div><span className="eyebrow">02 / REVIEW</span><h2>Latest headlines</h2></div><span className="time-filter">◷ &nbsp; LAST 24 HOURS</span></div><div className="source-banner"><div className="banner-icon">{active?.id === 'google-news' ? 'G' : active?.name?.[0] || 'S'}</div><div><strong>{active?.name || 'Select a source'}</strong><small>{active?.url || 'Choose an outlet from the left'}</small></div><button onClick={() => loadSource()} disabled={loading || !active || !config?.firecrawlConfigured}>{loading ? 'Collecting…' : 'Collect headlines'} <span>↗</span></button></div><div className="batch-row"><span>Check up to three undated articles per source, or investigate up to ten for the selected source. Firecrawl usage scales with the article count.</span><button onClick={() => loadSource(activeId, true)} disabled={loading || !config?.firecrawlConfigured || !active || activeId === 'google-news'}>Deep scan source</button><button onClick={loadVisible} disabled={loading || !config?.firecrawlConfigured || !visibleSources.length}>Collect visible sources ({visibleSources.length})</button></div>
          {!config?.firecrawlConfigured && <div className="notice"><strong>{staticPreview ? 'Preview of the prepared update' : 'Firecrawl connection needed'}</strong><p>{staticPreview ? 'The news stream above works without a server. Live collection needs the full app with its Firecrawl connection.' : <>Add <code>FIRECRAWL_API_KEY</code> to the server environment to collect live headlines. See the README for setup.</>}</p></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {loading && <div className="loading-box"><div className="spinner"/> {batchProgress ? `Collected ${batchProgress.done} of ${batchProgress.total} sources${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}` : 'Scraping and checking publication times…'}</div>}
          {result && <><div className="result-meta">{result.headlines.length} verified headlines · Checked {dateLabel(result.fetchedAt)}{!result.batch && result.candidatesFound ? ` · ${result.candidatesChecked} of ${result.candidatesFound} undated candidates checked` : ''}</div>{result.headlines.length ? <div className="headline-list">{result.headlines.map(item => <article className="headline-card" key={item.id}><div className="headline-top"><span className="category-label">{item.sourceName}</span><span>{dateLabel(item.publishedAt)}</span></div><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3>{item.summary && <p>{item.summary}</p>}<button className={`select-button ${selectedIds.has(item.id) ? 'selected' : ''}`} onClick={() => toggle(item)}>{selectedIds.has(item.id) ? '✓ Added to report' : '＋ Add to report'}</button></article>)}</div> : <div className="empty-result">No matching headline was verified in this scan. This does not mean the source had no relevant news. Try Deep scan source or broader keywords.</div>}</>}
          {!loading && !result && !error && <div className="empty-result"><span className="empty-symbol">◎</span><strong>Your next story starts here.</strong><p>Choose a source or collect all visible sources. Results are filtered to the past 24 hours.</p></div>}
        </section>
      </main>
      <aside className="report-panel"><div className="report-header"><span className="eyebrow">03 / COMPOSE</span><h2>Your report <em>{selected.length}</em></h2><p>Handpick and verify stories before export.</p></div><label className="report-title-label">REPORT TITLE<input value={reportTitle} onChange={e => setReportTitle(e.target.value)} maxLength="100"/></label><div className="selected-list">{selected.length ? selected.map((item, i) => <div className="selected-item" key={item.id}><span className="selected-index">{String(i + 1).padStart(2, '0')}</span><div className="selected-content"><strong>{item.title}</strong><small>{item.sourceName} · {dateLabel(item.publishedAt)}</small>{!item.reviewed && <button className="review-button" disabled={reviewingId === item.id} onClick={() => reviewArticle(item)}>{reviewingId === item.id ? 'Reviewing…' : 'Review full article'}</button>}{reviewErrors[item.id] && <small className="review-error">{reviewErrors[item.id]}</small>}{item.reviewed && <><label>SECTION<input value={item.section || ''} onChange={e => updateSelected(item.id, 'section', e.target.value)}/></label><label>COUNTRY / TOPIC<input value={item.subsection || ''} onChange={e => updateSelected(item.id, 'subsection', e.target.value)}/></label><label>ONE-SENTENCE SUMMARY<textarea rows="3" value={item.summary || ''} onChange={e => updateSelected(item.id, 'summary', e.target.value)}/></label></>}</div><button className="remove-button" aria-label={`Remove ${item.title}`} onClick={() => toggle(item)}>×</button></div>) : <div className="report-empty"><div>▤</div><strong>A clear desk, for now.</strong><p>Headlines you add will appear here, ready for your report.</p></div>}</div><div className="report-bottom"><div className="report-count"><span>SELECTED STORIES</span><strong>{String(selected.length).padStart(2, '0')}</strong></div><button className="export-button" disabled={!reportReady || staticPreview} onClick={downloadDocx}>Download Word report <span>↓</span></button><button className="markdown-button" disabled={!reportReady} onClick={downloadReport}>Download Markdown</button><small>{staticPreview ? 'Custom Word export needs the full app. The prepared Word update is available above.' : reportReady ? 'Includes linked agencies and source outcomes.' : 'Review every selected article and complete its summary to export.'}</small></div></aside>
    </div>{toast && <div className="toast" onClick={() => setToast('')}>{toast} ×</div>}
    {managing && <SiteManager config={siteConfig} setConfig={setSiteConfig} articles={daily?.articles ?? preparedUpdate.articles} onClose={() => setManaging(false)} onReset={() => setSiteConfig(defaultSiteConfig(daily?.articles ?? preparedUpdate.articles))}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
