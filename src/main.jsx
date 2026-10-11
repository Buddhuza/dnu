import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import preparedUpdate from '../data/daily-update-2026-10-11.json';
import preparedSources from '../sources.json';
import publishedSiteConfig from '../data/site-config.json';
import SiteManager from './SiteManager.jsx';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources } from './siteConfig.js';
import { orderedSubsections } from './newsSections.js';
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
  const [activeId, setActiveId] = useState(preparedSources[0]?.id || '');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All sources');
  const [includeText, setIncludeText] = useState(() => readStored('signal-include', defaultScope));
  const [excludeText, setExcludeText] = useState(() => readStored('signal-exclude', ''));
  const [scope, setScope] = useState(() => ({ include: words(readStored('signal-include', defaultScope)), exclude: words(readStored('signal-exclude', '')) }));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [managing, setManaging] = useState(false);
  const [siteConfig, setSiteConfig] = useState(() => {
    const stored = readStored('signal-site-settings-v1', publishedSiteConfig);
    const shouldIncrease = !readStored('signal-font-increase-v1', false) && stored.fontSize === 14;
    localStorage.setItem('signal-font-increase-v1', JSON.stringify(true));
    return normalizeSiteConfig({ ...stored, fontSize: shouldIncrease ? 18 : stored.fontSize }, preparedUpdate.articles);
  });

  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(setConfig).catch(() => setConfig({ sources: preparedSources, firecrawlConfigured: false })); }, []);
  useEffect(() => {
    const refresh = () => fetch('/api/daily-update').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(data => { setDaily(data); setStaticPreview(false); }).catch(() => { setDaily(preparedUpdate); setStaticPreview(true); });
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('signal-site-settings-v1', JSON.stringify(siteConfig)); document.title = siteConfig.brandName || 'Signal Desk'; }, [siteConfig]);
  const sources = useMemo(() => displaySources(config?.sources ?? [], siteConfig), [config, siteConfig]);
  const active = sources.find(x => x.id === activeId);
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const displayedArticles = useMemo(() => displaySiteContent(daily?.articles ?? [], siteConfig), [daily, siteConfig]);
  const activeTheme = siteConfig.darkMode ? siteConfig.darkTheme : siteConfig.theme;
  const themeStyle = {
    '--site-primary': activeTheme.primary, '--site-accent': activeTheme.accent,
    '--site-bg': activeTheme.background, '--site-surface': activeTheme.surface,
    '--site-text': activeTheme.text, '--site-section': activeTheme.section,
    '--site-font': activeTheme.font === 'Georgia' ? 'Georgia, serif' : `'${activeTheme.font}', sans-serif`,
    '--site-body-size': `${siteConfig.fontSize}px`,
    '--section-heading-size': `${siteConfig.sectionHeadingSize}px`,
    '--update-width': `${siteConfig.updateWidth}px`
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
    return [...sections].map(([section, subsections]) => ({
      section,
      subsections: orderedSubsections(siteConfig.sections.find(item => item.name === section), subsections.keys()).map(label => [label, subsections.get(label)])
    }));
  }, [displayedArticles, siteConfig.sections]);
  const blockedDailySources = daily?.sourceOutcomes?.filter(x => /failed|unreadable|could not be fetched|not verified/i.test(x.status)) ?? [];
  const selectedSourceStories = displayedArticles.filter(item => item.sourceId === activeId);
  const sourceRequest = source => ({ sourceId: source.id, ...(source.id.startsWith('manual-source-') ? { customSource: source } : {}), ...scope });

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
    const source = sources.find(item => item.id === id);
    if (!source) return;
    setBatchProgress(null);
    setActiveId(id);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sourceRequest(source), deepScan }) });
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
          const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sourceRequest(source)) });
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
  async function downloadManagedDocx() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}daily-update-template.docx`);
      if (!response.ok) throw new Error('The Word template is unavailable.');
      const templateBytes = await response.arrayBuffer();
      const title = siteConfig.updateTitle === 'Daily news update' ? daily?.title : siteConfig.updateTitle;
      const coverageNote = `Customised website copy based on the update prepared ${daily?.checkedAt || 'earlier'}. Headlines, summaries, sections, and manually added stories may have been edited in this browser; check their original articles before sharing.`;
      const file = await createReportDocxFromTemplate(templateBytes, { title, articles: displayedArticles, sourceOutcomes: daily?.sourceOutcomes ?? [], coverageNote });
      const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a'); a.href = url; a.download = 'daily-news-update.docx'; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setToast(error.message || 'Could not create the Word update.'); }
  }

  return <div className="app-shell" data-mode={siteConfig.darkMode ? 'dark' : 'light'} style={themeStyle}>
    <header className="topbar"><div className="brand-mark">{siteConfig.brandName?.[0] || 'S'}<span>✳</span></div><div className="brand-text"><strong>{siteConfig.brandName}</strong><small>{siteConfig.brandTagline}</small></div><span className="topbar-spacer"/><button className="mode-button" aria-pressed={siteConfig.darkMode} onClick={() => setSiteConfig(current => ({ ...current, darkMode: !current.darkMode }))}>{siteConfig.darkMode ? '☀ Light mode' : '☾ Dark mode'}</button><button className="manage-button" onClick={() => setManaging(true)}>⚙ Manage site</button><div className="live-pill"><span/> LIVE WORKSPACE</div><div className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div></header>
    <div className={`workspace ${siteConfig.showSources ? '' : 'no-sidebar'}`}>
      {siteConfig.showSources && <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">DISCOVER</span><h2>Sources <em>{sources.length}</em></h2><p>Browse the outlets in your monitoring list.</p></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${activeId === x.id ? 'active' : ''}`} onClick={() => { setActiveId(x.id); setResult(null); setError(''); if (config?.firecrawlConfigured) loadSource(x.id); else document.getElementById('latest-headlines')?.scrollIntoView({ behavior: 'smooth' }); }}><span className="source-icon">{x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong><small>{x.group}</small></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length} visible sources</div>
      </aside>}
      <main className="main-panel">
        {siteConfig.showHero && <div className="hero"><div><span className="eyebrow">{siteConfig.eyebrow}</span><h1>{siteConfig.heroTitle}<br/><i>{siteConfig.heroAccent}</i></h1><p>{siteConfig.heroDescription}</p></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-globe">✳</div><span className="art-label">MONITORING<br/>IN PROGRESS</span></div></div>}
        {siteConfig.showUpdate && <section className={`daily-update ${siteConfig.sectionHeadingUppercase ? 'uppercase-headings' : ''}`} aria-labelledby="daily-update-title">
          <div className="daily-heading"><h2 id="daily-update-title">{siteConfig.updateTitle === 'Daily news update' ? daily?.title ?? siteConfig.updateTitle : siteConfig.updateTitle}</h2>{daily?.articles?.length > 0 && <button className="daily-download" disabled={!displayedArticles.length} onClick={downloadManagedDocx}>Download report</button>}</div>
          {daily && <>{dailySections.map(({ section, subsections }) => <div className="daily-section" key={section}><h3>{section}</h3>{subsections.map(([subsection, items]) => <div key={subsection}>{subsection && <h4>{subsection}</h4>}{items.map((item, index) => <React.Fragment key={item.id}>{item.country && (index === 0 || items[index - 1].country !== item.country) && <h5 className="daily-country">{item.country}</h5>}<article className="daily-story"><p><strong>{item.title}{/[.!?]$/.test(item.title) ? '' : '.'}</strong> {item.summary} (<a href={item.url} target="_blank" rel="noopener noreferrer">{item.sourceName}</a>)</p></article></React.Fragment>)}</div>)}</div>)}{!displayedArticles.length && <p className="daily-empty">There are no visible stories in this update. Use Manage site to show or add content.</p>}{blockedDailySources.length > 0 && <details className="daily-sources"><summary>Sources without verified coverage ({blockedDailySources.length})</summary><ul>{blockedDailySources.map((item, i) => <li key={`${item.name}-${i}`}>{item.name}: {item.status}</li>)}</ul></details>}{siteConfig.showCoverage && <p className="daily-coverage">{siteConfig.coverageText || (staticPreview ? `Prepared ${dateLabel(daily.checkedAt)} from verified reporting in the preceding ${daily.windowHours || 48} hours. Only selected sources were checked, and this static snapshot does not refresh automatically.` : `Prepared ${dateLabel(daily.checkedAt)} from verified reporting in the preceding ${daily.windowHours || 48} hours. Only selected sources were checked.`)}</p>}</>}
        </section>}
        {siteConfig.showLatest && <section className="headlines-section" id="latest-headlines"><div className="section-title"><div><h2>Latest headlines</h2></div><span className="time-filter">◷ &nbsp; LAST 48 HOURS</span></div><div className="source-banner"><div className="banner-icon">{active?.name?.[0] || 'S'}</div><div><strong>{active?.name || 'Select a source'}</strong><small>{active?.url || 'Choose an outlet from the left'}</small></div><button onClick={() => loadSource()} disabled={loading || !active || !config?.firecrawlConfigured}>{loading ? 'Collecting…' : 'Collect headlines'} <span>↗</span></button></div><div className="batch-row"><span>Check up to three article pages when dates need verification; Internazionale Reuters stories are always checked this way. Deep scan checks up to ten. Firecrawl usage scales with the article count.</span><button onClick={() => loadSource(activeId, true)} disabled={loading || !config?.firecrawlConfigured || !active}>Deep scan source</button><button onClick={loadVisible} disabled={loading || !config?.firecrawlConfigured || !visibleSources.length}>Collect visible sources ({visibleSources.length})</button></div>
          {!config?.firecrawlConfigured && <div className="notice"><p>{staticPreview ? 'This published page shows the prepared update. Select a source to see any stories from it in this update. Live collection requires the server app with Firecrawl.' : <>Add <code>FIRECRAWL_API_KEY</code> to the server environment to collect live headlines. See the README for setup.</>}</p></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {loading && <div className="loading-box"><div className="spinner"/> {batchProgress ? `Collected ${batchProgress.done} of ${batchProgress.total} sources${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}` : 'Scraping and checking publication times…'}</div>}
          {result && <><div className="result-meta">{result.headlines.length} verified headlines · Checked {dateLabel(result.fetchedAt)}{!result.batch && result.candidatesFound ? ` · ${result.candidatesChecked} of ${result.candidatesFound} article candidates checked` : ''}</div>{result.headlines.length ? <div className="headline-list">{result.headlines.map(item => <article className="headline-card" key={item.id}><div className="headline-top"><span className="category-label">{item.sourceName}</span><span>{dateLabel(item.publishedAt)}</span></div><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3>{item.summary && <p>{item.summary}</p>}</article>)}</div> : <div className="empty-result">No matching headline was verified in this scan. This does not mean the source had no relevant news. Try Deep scan source or broader keywords.</div>}</>}
          {!loading && !result && !error && (staticPreview ? <div className="snapshot-results"><p>{selectedSourceStories.length ? `${selectedSourceStories.length} prepared update stories from ${active?.name}` : `No ${active?.name || 'source'} stories were selected for this prepared update.`}</p>{selectedSourceStories.map(item => <article className="headline-card" key={item.id}><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3><p>{item.summary}</p></article>)}</div> : <div className="empty-result"><span className="empty-symbol">◎</span><strong>Your next story starts here.</strong><p>Choose a source or collect all visible sources. Results are filtered to the past 48 hours.</p></div>)}
        </section>}
      </main>
    </div>{toast && <div className="toast" onClick={() => setToast('')}>{toast} ×</div>}
    {managing && <SiteManager config={siteConfig} setConfig={setSiteConfig} articles={daily?.articles ?? preparedUpdate.articles} baseSources={config?.sources ?? []} includeText={includeText} setIncludeText={setIncludeText} excludeText={excludeText} setExcludeText={setExcludeText} applyScope={applyScope} onClose={() => setManaging(false)} onReset={() => setSiteConfig(defaultSiteConfig(daily?.articles ?? preparedUpdate.articles))}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
