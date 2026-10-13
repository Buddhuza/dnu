import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import preparedUpdate from '../data/daily-update-2026-10-13.json';
import preparedSources from '../sources.json';
import publishedSiteConfig from '../data/site-config.json';
import SiteManager from './SiteManager.jsx';
import SourceCoverage from './SourceCoverage.jsx';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources } from './siteConfig.js';
import { orderedSubsections } from './newsSections.js';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import { reportFilename } from './reportFilename.js';
import { reportDateLabel } from './reportDate.js';
import './styles.css';

const readStored = (key, fallback, legacyKey) => {
  try { return JSON.parse(localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null)) ?? fallback; } catch { return fallback; }
};
const words = text => [...new Set(text.split(/[,\n]/).map(x => x.trim()).filter(Boolean))].slice(0, 40);
const defaultScope = 'security, politics, political, defense, diplomacy, election, conflict, war, terrorism, parliament, government, minister, president, police, military, NATO, Russia, Ukraine, attack, sanctions, protest, полит, воен, войн, террор, санкц, росси, украин, атак, задерж';
const dateLabel = iso => new Intl.DateTimeFormat(undefined, { timeZone: 'Europe/Vienna', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));

function App() {
  const [config, setConfig] = useState(null);
  const [daily, setDaily] = useState(null);
  const [staticPreview, setStaticPreview] = useState(false);
  const [activeId, setActiveId] = useState(preparedSources[0]?.id || '');
  const [websiteSourceId, setWebsiteSourceId] = useState('');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All sources');
  const [includeText, setIncludeText] = useState(() => readStored('dnu-include', defaultScope, 'signal-include'));
  const [excludeText, setExcludeText] = useState(() => readStored('dnu-exclude', '', 'signal-exclude'));
  const [scope, setScope] = useState(() => ({ include: words(readStored('dnu-include', defaultScope, 'signal-include')), exclude: words(readStored('dnu-exclude', '', 'signal-exclude')) }));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [managing, setManaging] = useState(false);
  const [managerTab, setManagerTab] = useState('Content');
  const [siteConfig, setSiteConfig] = useState(() => {
    const stored = readStored('dnu-site-settings-v1', publishedSiteConfig, 'signal-site-settings-v1');
    const shouldIncrease = !readStored('dnu-font-increase-v1', false, 'signal-font-increase-v1') && stored.fontSize === 14;
    localStorage.setItem('dnu-font-increase-v1', JSON.stringify(true));
    return normalizeSiteConfig({ ...stored, fontSize: shouldIncrease ? 18 : stored.fontSize }, preparedUpdate.articles);
  });

  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(setConfig).catch(() => setConfig({ sources: preparedSources, firecrawlConfigured: false })); }, []);
  useEffect(() => {
    const refresh = () => fetch('/api/daily-update').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(data => { setDaily(data); setStaticPreview(false); }).catch(() => { setDaily(preparedUpdate); setStaticPreview(true); });
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('dnu-site-settings-v1', JSON.stringify(siteConfig)); document.title = siteConfig.brandName || 'SITUATION ROOM'; }, [siteConfig]);
  const sources = useMemo(() => displaySources(config?.sources ?? [], siteConfig), [config, siteConfig]);
  const active = sources.find(x => x.id === activeId);
  const websiteSource = sources.find(x => x.id === websiteSourceId);
  const canCollect = Boolean(config?.firecrawlConfigured || config?.feedSourceIds?.includes(activeId));
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const collectionSources = useMemo(() => visibleSources.filter(x => config?.firecrawlConfigured || config?.feedSourceIds?.includes(x.id)).sort((a, b) => Number(config?.feedSourceIds?.includes(b.id)) - Number(config?.feedSourceIds?.includes(a.id))), [visibleSources, config]);
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
  const blockedDailySources = daily?.sourceOutcomes?.filter(x => /failed|unreadable|could not be fetched/i.test(x.status)) ?? [];
  const selectedSourceStories = displayedArticles.filter(item => item.sourceId === activeId);
  const sourceRequest = source => ({ sourceId: source.id, ...(source.id.startsWith('manual-source-') ? { customSource: source } : {}), ...scope });

  function applyScope() {
    const next = { include: words(includeText), exclude: words(excludeText) };
    localStorage.setItem('dnu-include', JSON.stringify(includeText));
    localStorage.setItem('dnu-exclude', JSON.stringify(excludeText));
    setScope(next);
    setResult(null);
    setError('');
    setToast('Scope updated. Refresh a source to collect matching headlines.');
  }
  async function loadSource(id = activeId, fullScan = false) {
    const source = sources.find(item => item.id === id);
    if (!source) return;
    setBatchProgress(null);
    setActiveId(id);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const headlines = [];
      let cursor = 0;
      do {
        const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sourceRequest(source), fullScan, cursor }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Collection failed');
        headlines.push(...data.headlines);
        cursor = data.nextCursor;
        setResult({ ...data, headlines: [...headlines].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), candidatesChecked: fullScan ? cursor ?? data.candidatesFound : data.candidatesChecked });
      } while (fullScan && cursor !== null);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function loadVisible() {
    if (!collectionSources.length) return;
    setLoading(true);
    setError('');
    setResult({ headlines: [], fetchedAt: new Date().toISOString(), batch: true });
    setBatchProgress({ done: 0, total: collectionSources.length, failed: 0 });
    let done = 0, failed = 0;
    const gathered = [];
    const collectGroup = async groupSources => {
      let cursor = 0;
      const worker = async () => {
      while (cursor < groupSources.length) {
        const source = groupSources[cursor++];
        try {
          let cursor = 0;
          do {
            const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sourceRequest(source), fullScan: true, cursor }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            gathered.push(...data.headlines);
            setResult({ headlines: [...gathered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date().toISOString(), batch: true });
            cursor = data.nextCursor;
          } while (cursor !== null);
        } catch { failed++; }
        done++;
        setBatchProgress({ done, total: collectionSources.length, failed });
      }
    };
      await Promise.all(Array.from({ length: Math.min(4, groupSources.length) }, worker));
    };
    await collectGroup(collectionSources.filter(source => config?.feedSourceIds?.includes(source.id)));
    await collectGroup(collectionSources.filter(source => !config?.feedSourceIds?.includes(source.id)));
    setLoading(false);
    if (failed) setError(`${failed} source${failed === 1 ? '' : 's'} could not be collected. Other results are shown below.`);
  }
  async function downloadManagedDocx() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}daily-update-template.docx`);
      if (!response.ok) throw new Error('The Word template is unavailable.');
      const templateBytes = await response.arrayBuffer();
      const file = await createReportDocxFromTemplate(templateBytes, { title: siteConfig.updateTitle, windowStart: daily?.windowStart, windowEnd: daily?.windowEnd, articles: displayedArticles, sourceOutcomes: daily?.sourceOutcomes ?? [] });
      const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a'); a.href = url; a.download = reportFilename(daily); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setToast(error.message || 'Could not create the Word update.'); }
  }

  const collectionPanel = (
        <section className="headlines-section" id="live-collection"><div className="section-title"><div><h2>Live collection</h2></div><span className="time-filter">◷ &nbsp; LAST 48 HOURS</span></div><div className="source-banner"><div className="banner-icon">{active?.name?.[0] || 'S'}</div><div><strong>{active?.name || 'Select a source'}</strong><small>{active?.url || 'Choose an outlet from the left'}</small></div><button onClick={() => loadSource()} disabled={loading || !active || !canCollect}>{loading ? 'Collecting…' : 'Collect headlines'} <span>↗</span></button></div><div className="batch-row"><span>Publisher feeds are checked first at no Firecrawl cost. A quick source check opens three matching article pages. A complete scan checks every matching link returned by the listing and may take longer or use many credits.</span><button onClick={() => loadSource(activeId, true)} disabled={loading || !config?.firecrawlConfigured || !active}>Scan all listed articles</button><button onClick={loadVisible} disabled={loading || !collectionSources.length}>Scan visible sources fully ({collectionSources.length})</button></div>
          {!config?.firecrawlConfigured && <div className="notice"><p>{staticPreview ? 'This published page shows the prepared update. Live collection requires the server app; feeds work without Firecrawl, while other sources need an API key.' : <>Feed sources can be collected without an API key. Add <code>FIRECRAWL_API_KEY</code> for other sources.</>}</p></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {loading && <div className="loading-box"><div className="spinner"/> {batchProgress ? `Collected ${batchProgress.done} of ${batchProgress.total} sources${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}` : 'Collecting headlines and checking publication times…'}</div>}
          {result && <><div className="result-meta">{result.headlines.length} headlines · Checked {dateLabel(result.fetchedAt)}{result.collectionMethod ? ` · ${result.collectionMethod === 'feed' ? 'Publisher feed, 0 Firecrawl credits' : 'Firecrawl'}` : ''}{!result.batch && result.candidatesFound ? ` · ${result.candidatesChecked} of ${result.candidatesFound} article candidates checked` : ''}</div>{result.headlines.length ? <div className="headline-list">{result.headlines.map(item => <article className="headline-card" key={item.id}><div className="headline-top"><span className="category-label">{item.sourceName}</span><span>{dateLabel(item.publishedAt)}</span></div><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3></article>)}</div> : <div className="empty-result">No matching headline was found in this scan. This does not mean the source had no relevant news. Try broader keywords.</div>}</>}
          {!loading && !result && !error && (staticPreview ? <div className="snapshot-results"><p>{selectedSourceStories.length ? `${selectedSourceStories.length} prepared update stories from ${active?.name}` : `No ${active?.name || 'source'} stories were selected for this prepared update.`}</p>{selectedSourceStories.map(item => <article className="headline-card" key={item.id}><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3></article>)}</div> : <div className="empty-result"><span className="empty-symbol">◎</span><strong>Your next story starts here.</strong><p>Choose a source or collect all visible sources. Results are filtered to the past 48 hours.</p></div>)}
        </section>
  );

  return <div className="app-shell" data-mode={siteConfig.darkMode ? 'dark' : 'light'} style={themeStyle}>
    <header className="topbar"><div className="brand-text"><strong>{siteConfig.brandName}</strong><small>{siteConfig.brandTagline}</small></div><span className="topbar-spacer"/><button className="mode-button" aria-pressed={siteConfig.darkMode} onClick={() => setSiteConfig(current => ({ ...current, darkMode: !current.darkMode }))}>{siteConfig.darkMode ? '☀ Light mode' : '☾ Dark mode'}</button><button className="manage-button" onClick={() => { setManagerTab('Content'); setManaging(true); }}>⚙ Manage site</button><div className="live-pill"><span/> LIVE WORKSPACE</div><div className="topbar-date">{new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())}</div></header>
    <div className={`workspace ${siteConfig.showSources ? '' : 'no-sidebar'}`}>
      {siteConfig.showSources && <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">DISCOVER</span><h2>Sources <em>{sources.length}</em></h2><p>Browse the outlets in your monitoring list. Source categories do not limit report placement.</p></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${websiteSourceId === x.id ? 'active' : ''}`} onClick={() => { setActiveId(x.id); setWebsiteSourceId(x.id); setResult(null); setError(''); }} aria-label={`Show ${x.name} website beside the daily news update`}><span className="source-icon">{x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong><small>{x.group}</small></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length} visible sources</div>
      </aside>}
      <main className={`main-panel ${websiteSource ? 'with-website' : ''}`}>
        <div className={`reading-layout ${websiteSource ? 'website-open' : ''}`}>
        {siteConfig.showUpdate && <section className={`daily-update ${siteConfig.sectionHeadingUppercase ? 'uppercase-headings' : ''}`} aria-labelledby="daily-update-title">
          <div className="daily-heading"><div><h2 id="daily-update-title">{siteConfig.updateTitle}</h2>{daily?.windowStart && daily?.windowEnd && <p className="report-date">{reportDateLabel(daily.windowStart, daily.windowEnd)}</p>}</div>{daily?.articles?.length > 0 && <button className="daily-download" disabled={!displayedArticles.length} onClick={downloadManagedDocx}>Download report</button>}</div>
          {daily && <>{dailySections.map(({ section, subsections }) => <div className="daily-section" key={section}><h3>{section}</h3>{subsections.map(([subsection, items]) => <div key={subsection}>{subsection && <h4 className={section === 'Miscellaneous' ? 'plain-topic' : undefined}>{subsection}</h4>}{items.map((item, index) => <React.Fragment key={item.id}>{item.country && (index === 0 || items[index - 1].country !== item.country) && <h5 className="daily-country">{item.country}</h5>}<article className="daily-story"><p><strong>{item.title}</strong> (<a href={item.url} target="_blank" rel="noopener noreferrer">{item.sourceName}</a>)</p></article></React.Fragment>)}</div>)}</div>)}{!displayedArticles.length && <p className="daily-empty">There are no visible stories in this update. Use Manage site to show or add content.</p>}{blockedDailySources.length > 0 && <details className="daily-sources"><summary>Source access issues ({blockedDailySources.length})</summary><ul>{blockedDailySources.map((item, i) => <li key={`${item.name}-${i}`}>{item.name}: {item.reason || item.status}</li>)}</ul></details>}{siteConfig.showCoverage && <p className="daily-coverage">{siteConfig.coverageText || (daily.windowStart ? `Coverage: ${dateLabel(daily.windowStart)} to ${dateLabel(daily.windowEnd)} (Vienna time). Prepared ${dateLabel(daily.checkedAt)} from selected original articles. This static snapshot does not refresh automatically.` : `Prepared ${dateLabel(daily.checkedAt)} from selected reporting in the preceding ${daily.windowHours || 48} hours.`)}</p>}</>}
        </section>}
        {websiteSource && <section className="website-panel" aria-label={`${websiteSource.name} website`}><div className="website-panel-heading"><div><span className="eyebrow">SOURCE WEBSITE</span><h2>{websiteSource.name}</h2></div><button onClick={() => setWebsiteSourceId('')} aria-label="Close source website">×</button></div><div className="website-panel-actions"><a href={websiteSource.url} target="_blank" rel="noopener noreferrer">Open website in new tab ↗</a><button onClick={() => { setManagerTab('Collect'); setManaging(true); }}>Collect headlines</button></div><p>Some publishers block display inside other websites. Use the link above if this panel stays blank.</p><iframe key={websiteSource.id} src={websiteSource.url} title={`${websiteSource.name} website`} referrerPolicy="no-referrer" loading="lazy"/></section>}
        </div>
        {siteConfig.showLatest && <SourceCoverage sources={[...(config?.sources ?? preparedSources), ...siteConfig.customSources]} articles={displayedArticles} outcomes={daily?.sourceOutcomes ?? []} extraChecks={daily?.sourceChecks ?? []} selectedId={activeId}/>}
      </main>
    </div>{toast && <div className="toast" onClick={() => setToast('')}>{toast} ×</div>}
    {managing && <SiteManager initialTab={managerTab} collectionPanel={collectionPanel} config={siteConfig} setConfig={setSiteConfig} articles={daily?.articles ?? preparedUpdate.articles} baseSources={config?.sources ?? []} includeText={includeText} setIncludeText={setIncludeText} excludeText={excludeText} setExcludeText={setExcludeText} applyScope={applyScope} onClose={() => setManaging(false)} onReset={() => setSiteConfig(defaultSiteConfig(daily?.articles ?? preparedUpdate.articles))}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
