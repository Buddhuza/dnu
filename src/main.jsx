import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import preparedUpdate from '../data/daily-update-2026-10-13.json';
import preparedSources from '../sources.json';
import publishedSiteConfig from '../data/site-config.json';
import SiteManager from './SiteManager.jsx';
import AddArticlesDialog from './AddArticlesDialog.jsx';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources, moveArticleInConfig } from './siteConfig.js';
import { orderedSubsections } from './newsSections.js';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import { reportFilename } from './reportFilename.js';
import { reportDateLabel } from './reportDate.js';
import { reportStoryText } from './reportText.js';
import { disclaimerFirst, disclaimerSecond } from './disclaimer.js';
import { sourceAudit } from './collectionAudit.js';
import { formatViennaDateTime, formatViennaCompactDateTime } from './viennaTime.js';
import './styles.css';

const readStored = (key, fallback, legacyKey) => {
  try { return JSON.parse(localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null)) ?? fallback; } catch { return fallback; }
};
const words = text => [...new Set(text.split(/[,\n]/).map(x => x.trim()).filter(Boolean))].slice(0, 40);
const defaultScope = 'OSCE, cooperation, diplomacy, bilateral, foreign policy, talks, summit, peace, sanctions, NATO, EU, UN, security, defense, defence, conflict, war, terrorism, military, politics, political, election, Russia, Ukraine';
const dateLabel = formatViennaDateTime;

function App() {
  const [currentTime, setCurrentTime] = useState(() => new Date());
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
  const [auditRows, setAuditRows] = useState(() => { const saved = readStored('dnu-source-audit-v1', []); return Array.isArray(saved) ? saved : []; });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [managing, setManaging] = useState(false);
  const [editingStories, setEditingStories] = useState(false);
  const [dropTarget, setDropTarget] = useState('');
  const pointerDragRef = useRef(null);
  const [addingArticles, setAddingArticles] = useState(false);
  const [updateSearchOpen, setUpdateSearchOpen] = useState(false);
  const [updateSearchText, setUpdateSearchText] = useState('');
  const [activeSearchResult, setActiveSearchResult] = useState(0);
  const [excludedStoryIds, setExcludedStoryIds] = useState(() => {
    const saved = readStored('dnu-excluded-story-ids-v1', []);
    return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
  });
  const [managerTab, setManagerTab] = useState('Content');
  const [siteConfig, setSiteConfig] = useState(() => {
    const stored = readStored('dnu-site-settings-v1', publishedSiteConfig, 'signal-site-settings-v1');
    const shouldIncrease = !readStored('dnu-font-increase-v1', false, 'signal-font-increase-v1') && stored.fontSize === 14;
    localStorage.setItem('dnu-font-increase-v1', JSON.stringify(true));
    return normalizeSiteConfig({ ...stored, fontSize: shouldIncrease ? 18 : stored.fontSize }, preparedUpdate.articles);
  });

  useEffect(() => { fetch('/api/config').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(setConfig).catch(() => setConfig({ sources: preparedSources, firecrawlConfigured: false })); }, []);
  useEffect(() => {
    let timer;
    const refreshClock = () => {
      setCurrentTime(new Date());
      timer = setTimeout(refreshClock, 60_000 - Date.now() % 60_000 + 50);
    };
    timer = setTimeout(refreshClock, 60_000 - Date.now() % 60_000 + 50);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    const refresh = () => fetch('/api/daily-update').then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(data => { setDaily(data); setStaticPreview(false); }).catch(() => { setDaily(preparedUpdate); setStaticPreview(true); });
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('dnu-site-settings-v1', JSON.stringify(siteConfig)); document.title = siteConfig.brandName || 'SITUATION ROOM'; }, [siteConfig]);
  useEffect(() => { localStorage.setItem('dnu-source-audit-v1', JSON.stringify(auditRows)); }, [auditRows]);
  useEffect(() => { localStorage.setItem('dnu-excluded-story-ids-v1', JSON.stringify([...excludedStoryIds])); }, [excludedStoryIds]);
  const configuredSources = useMemo(() => displaySources(config?.sources ?? [], { ...siteConfig, hiddenSourceIds: [] }), [config, siteConfig]);
  const sources = useMemo(() => displaySources(config?.sources ?? [], siteConfig), [config, siteConfig]);
  const active = configuredSources.find(x => x.id === activeId);
  const websiteSource = sources.find(x => x.id === websiteSourceId);
  const canCollect = Boolean(config?.firecrawlConfigured || config?.feedSourceIds?.includes(activeId));
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const collectionSources = useMemo(() => [...visibleSources].sort((a, b) => Number(config?.feedSourceIds?.includes(b.id)) - Number(config?.feedSourceIds?.includes(a.id))), [visibleSources, config]);
  const displayedArticles = useMemo(() => displaySiteContent(daily?.articles ?? [], siteConfig), [daily, siteConfig]);
  const selectedArticles = useMemo(() => displayedArticles.filter(item => !excludedStoryIds.has(item.id)), [displayedArticles, excludedStoryIds]);
  const readingArticles = editingStories ? displayedArticles : selectedArticles;
  const updateSearchQuery = updateSearchText.trim().toLocaleLowerCase();
  const updateSearchResults = useMemo(() => updateSearchQuery ? readingArticles.filter(item => {
    const story = reportStoryText(item);
    return [item.section, item.subsection, item.country, story.headline, story.summary, item.sourceName, formatViennaCompactDateTime(item.publishedAt)]
      .some(value => String(value || '').toLocaleLowerCase().includes(updateSearchQuery));
  }) : [], [readingArticles, updateSearchQuery]);
  const updateSearchIds = useMemo(() => new Set(updateSearchResults.map(item => item.id)), [updateSearchResults]);
  useEffect(() => { setActiveSearchResult(0); }, [updateSearchQuery]);
  useEffect(() => {
    if (!updateSearchOpen || !updateSearchResults.length) return;
    const item = updateSearchResults[Math.min(activeSearchResult, updateSearchResults.length - 1)];
    const target = [...document.querySelectorAll('.daily-scroll .daily-story')].find(node => node.dataset.storyId === item.id);
    if (!target) return;
    const scroller = target.closest('.daily-scroll');
    scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 20, behavior: 'smooth' });
  }, [updateSearchOpen, updateSearchResults, activeSearchResult]);
  const reportWindow = useMemo(() => {
    if (!daily) return null;
    const times = selectedArticles.map(item => Date.parse(item.publishedAt)).filter(Number.isFinite);
    return { ...daily, windowStart: new Date(Math.min(Date.parse(daily.windowStart), ...times)).toISOString(), windowEnd: new Date(Math.max(Date.parse(daily.windowEnd), ...times)).toISOString() };
  }, [daily, selectedArticles]);
  const coverageNote = !daily ? '' : siteConfig.coverageText || (reportWindow?.windowStart
    ? `Coverage: ${dateLabel(reportWindow.windowStart)} to ${dateLabel(reportWindow.windowEnd)}. Original snapshot prepared ${dateLabel(daily.checkedAt)} from selected article pages.${selectedArticles.some(item => item.id.startsWith('manual-')) ? ' Includes articles added in this browser.' : ''}${selectedArticles.some(item => item.timeSource === 'inferred' || item.timeSource === 'current') ? ' Some added articles have inferred dates or were stamped when added.' : ''} The original snapshot does not refresh automatically.`
    : `Prepared ${dateLabel(daily?.checkedAt)} from selected reporting in the preceding ${daily?.windowHours || 48} hours.`);
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
    for (const item of readingArticles) {
      const sectionId = item.sectionId || item.section;
      if (!sections.has(sectionId)) sections.set(sectionId, new Map());
      const subsections = sections.get(sectionId);
      const label = item.subsection || '';
      if (!subsections.has(label)) subsections.set(label, []);
      subsections.get(label).push(item);
    }
    if (editingStories) for (const section of siteConfig.sections.filter(item => item.visible)) {
      if (!sections.has(section.id)) sections.set(section.id, new Map());
      const subsections = sections.get(section.id);
      for (const label of section.subsections ?? []) if (!subsections.has(label)) subsections.set(label, []);
      if (!subsections.size) subsections.set('', []);
    }
    const sectionOrder = new Map(siteConfig.sections.map((section, index) => [section.id, index]));
    return [...sections].sort(([a], [b]) => (sectionOrder.get(a) ?? 999) - (sectionOrder.get(b) ?? 999)).map(([sectionId, subsections]) => ({
      sectionId,
      section: siteConfig.sections.find(item => item.id === sectionId)?.name || sectionId,
      subsections: orderedSubsections(siteConfig.sections.find(item => item.id === sectionId), subsections.keys()).map(label => [label, subsections.get(label)])
    }));
  }, [readingArticles, siteConfig.sections, editingStories]);
  const selectedSourceStories = selectedArticles.filter(item => item.sourceId === activeId);
  const sourceRequest = source => ({ sourceId: source.id, ...(source.id.startsWith('manual-source-') ? { customSource: source } : {}), ...(source.listingUrl ? { listingUrlOverride: source.listingUrl } : {}), ...scope });

  async function scanSource(source, fullScan, onPage = () => {}) {
    const headlines = [];
    const attempts = [];
    const errors = [];
    for (const strategy of ['primary', 'alternate', 'search']) {
      if (strategy !== 'primary' && !config?.firecrawlConfigured) break;
      if (strategy !== 'primary' && headlines.length) break;
      let cursor = 0;
      do {
        try {
          const response = await fetch('/api/headlines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...sourceRequest(source), fullScan, cursor, fallback: strategy === 'alternate', search: strategy === 'search' }) });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Collection failed');
          headlines.push(...data.headlines);
          attempts.push({ ...data, headlines: data.headlines.length });
          cursor = data.nextCursor;
          onPage(headlines, data);
        } catch (error) { errors.push(error.message); cursor = null; }
      } while (fullScan && cursor !== null);
    }
    return { headlines: [...new Map(headlines.map(item => [item.url, item])).values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), audit: sourceAudit(source, attempts, errors), lastPage: attempts.at(-1) };
  }

  function saveAudit(row) {
    setAuditRows(current => [row, ...current.filter(item => item.sourceId !== row.sourceId)]);
  }

  function rememberWorkingListing(source, audit) {
    const working = audit.attempts?.find(attempt => attempt.headlines > 0 && attempt.collectionMethod === 'firecrawl' && attempt.listingUrl && attempt.listingUrl !== (source.listingUrl || source.url));
    if (!working || !/^source-\d+$/.test(source.id)) return;
    setSiteConfig(current => ({ ...current, sourceListingOverrides: { ...current.sourceListingOverrides, [source.id]: working.listingUrl } }));
  }

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
    const source = configuredSources.find(item => item.id === id);
    if (!source) return;
    setBatchProgress(null);
    setActiveId(id);
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const scan = await scanSource(source, fullScan, (headlines, page) => setResult({ ...page, headlines: [...headlines] }));
      saveAudit(scan.audit);
      rememberWorkingListing(source, scan.audit);
      setResult(scan.lastPage ? { ...scan.lastPage, headlines: scan.headlines } : null);
      if (scan.audit.status === 'failed') setError(scan.audit.reason);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function loadVisible(targetSources = collectionSources) {
    if (!targetSources.length) return;
    setLoading(true);
    setError('');
    setResult({ headlines: [], fetchedAt: new Date().toISOString(), batch: true });
    setBatchProgress({ done: 0, total: targetSources.length, failed: 0 });
    let done = 0, failed = 0;
    const gathered = [];
    setAuditRows([]);
    const collectGroup = async groupSources => {
      let cursor = 0;
      const worker = async () => {
      while (cursor < groupSources.length) {
        const source = groupSources[cursor++];
        try {
          if (!config?.firecrawlConfigured && !config?.feedSourceIds?.includes(source.id)) {
            saveAudit({ sourceId: source.id, name: source.name, status: 'unavailable', reason: 'No publisher feed is configured and Firecrawl is not connected to the server.', remedy: 'Set FIRECRAWL_API_KEY on the server, then retry this source.', attempts: [], errors: [] });
          } else {
            const scan = await scanSource(source, true, (headlines, page) => {
              const previous = gathered.filter(item => item.sourceId !== source.id);
              setResult({ headlines: [...previous, ...headlines].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date().toISOString(), batch: true });
            });
            gathered.push(...scan.headlines);
            saveAudit(scan.audit);
            rememberWorkingListing(source, scan.audit);
            if (scan.audit.status === 'failed') failed++;
            setResult({ headlines: [...gathered].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)), fetchedAt: new Date().toISOString(), batch: true });
          }
        } catch (error) { failed++; saveAudit(sourceAudit(source, [], [error.message])); }
        done++;
        setBatchProgress({ done, total: targetSources.length, failed });
      }
    };
      await Promise.all(Array.from({ length: Math.min(4, groupSources.length) }, worker));
    };
    await collectGroup(targetSources.filter(source => config?.feedSourceIds?.includes(source.id)));
    await collectGroup(targetSources.filter(source => !config?.feedSourceIds?.includes(source.id)));
    setLoading(false);
    if (failed) setError(`${failed} source${failed === 1 ? '' : 's'} could not be collected. Other results are shown below.`);
  }
  async function downloadManagedDocx() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}daily-update-template.docx`);
      if (!response.ok) throw new Error('The Word template is unavailable.');
      const templateBytes = await response.arrayBuffer();
      const file = await createReportDocxFromTemplate(templateBytes, { title: siteConfig.updateTitle, windowStart: reportWindow?.windowStart, windowEnd: reportWindow?.windowEnd, articles: selectedArticles, sourceOutcomes: daily?.sourceOutcomes ?? [] });
      const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a'); a.href = url; a.download = reportFilename(reportWindow); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setToast(error.message || 'Could not create the Word update.'); }
  }

  const updateControls = () => daily?.articles?.length > 0 && <div className="daily-downloads"><button className="daily-download" disabled={!selectedArticles.length} onClick={downloadManagedDocx}>Download</button><button className="daily-edit" type="button" aria-pressed={editingStories} onClick={() => setEditingStories(current => !current)}>{editingStories ? 'Save' : 'Edit'}</button><button className="daily-edit" type="button" onClick={() => setAddingArticles(true)}>Add</button><button className="daily-edit daily-search-toggle" type="button" aria-label="Search update" aria-expanded={updateSearchOpen} onClick={() => setUpdateSearchOpen(current => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></svg></button></div>;
  const highlightSearch = value => {
    const text = String(value || '');
    if (!updateSearchOpen || !updateSearchQuery) return text;
    const lower = text.toLocaleLowerCase();
    const parts = [];
    let from = 0;
    let match = lower.indexOf(updateSearchQuery, from);
    while (match !== -1) {
      parts.push(text.slice(from, match), <mark key={match}>{text.slice(match, match + updateSearchQuery.length)}</mark>);
      from = match + updateSearchQuery.length;
      match = lower.indexOf(updateSearchQuery, from);
    }
    parts.push(text.slice(from));
    return parts;
  };
  const jumpToSection = (event, index) => {
    const target = document.getElementById(`daily-section-${index}`);
    if (!target) return;
    event.preventDefault();
    const scroller = target.closest('.daily-scroll');
    scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 12, behavior: 'smooth' });
    history.replaceState(null, '', `#daily-section-${index}`);
  };
  const dropAtPoint = (x, y, movedId) => {
    const element = document.elementFromPoint(x, y)?.closest('[data-drop-kind]');
    if (!element) return null;
    const { dropKind, sectionId, subsection = '', country = '', storyId } = element.dataset;
    if (dropKind === 'story') {
      if (storyId === movedId) return null;
      const after = y > element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2;
      return { key: `story:${storyId}:${after ? 'after' : 'before'}`, destination: { sectionId, subsection, country, anchorId: storyId, after } };
    }
    const key = dropKind === 'section' ? `section:${sectionId}` : `${dropKind}:${sectionId}:${subsection}${dropKind === 'country' ? `:${country}` : ''}`;
    return { key, destination: { sectionId, subsection, country } };
  };
  const movePointerStory = event => {
    if (!pointerDragRef.current) return;
    event.preventDefault();
    const hit = dropAtPoint(event.clientX, event.clientY, pointerDragRef.current);
    setDropTarget(hit?.key || '');
    const scroller = document.querySelector('.daily-scroll');
    if (scroller) {
      const box = scroller.getBoundingClientRect();
      if (event.clientY < box.top + 48) scroller.scrollTop -= 18;
      if (event.clientY > box.bottom - 48) scroller.scrollTop += 18;
    }
  };
  const finishPointerStory = event => {
    if (!pointerDragRef.current) return;
    const movedId = pointerDragRef.current;
    const hit = dropAtPoint(event.clientX, event.clientY, movedId);
    if (hit) setSiteConfig(current => moveArticleInConfig(current, daily?.articles ?? [], movedId, hit.destination));
    pointerDragRef.current = null;
    setDropTarget('');
  };

  const collectionPanel = (
        <section className="headlines-section" id="live-collection"><div className="section-title"><div><h2>Live collection</h2></div><span className="time-filter">◷ &nbsp; LAST 48 HOURS</span></div><div className="source-banner"><div className="banner-icon">{active?.name?.[0] || 'S'}</div><div><strong>{active?.name || 'Select a source'}</strong><small>{active?.url || 'Choose an outlet from the left'}</small></div><button onClick={() => loadSource()} disabled={loading || !active || !canCollect || staticPreview}>{loading ? 'Collecting…' : 'Collect headlines'} <span>↗</span></button></div><div className="batch-row"><span>Each scan checks the extracted articles for every source, then tries an alternate feed, listing page, and recent site search if needed. Sources still without articles receive a reason and next step. Complete scans may take hours and use many Firecrawl credits.</span><button onClick={() => loadSource(activeId, true)} disabled={loading || !canCollect || !active || staticPreview}>Scan all listed articles</button><button onClick={() => loadVisible(collectionSources)} disabled={loading || !collectionSources.length || staticPreview}>Verify visible sources ({collectionSources.length})</button><button onClick={() => loadVisible(configuredSources)} disabled={loading || !configuredSources.length || staticPreview}>Verify all sources ({configuredSources.length})</button></div>
          {!config?.firecrawlConfigured && <div className="notice"><p>{staticPreview ? 'This published page shows the prepared update. Live collection requires the server app; feeds work without Firecrawl, while other sources need an API key.' : <>Feed sources can be collected without an API key. Add <code>FIRECRAWL_API_KEY</code> for other sources.</>}</p></div>}
          {error && <div className="error-box" role="alert">{error}</div>}
          {loading && <div className="loading-box"><div className="spinner"/> {batchProgress ? `Collected ${batchProgress.done} of ${batchProgress.total} sources${batchProgress.failed ? ` · ${batchProgress.failed} failed` : ''}` : 'Collecting headlines and checking publication times…'}</div>}
          {result && <><div className="result-meta">{result.headlines.length} headlines · Checked {dateLabel(result.fetchedAt)}{result.collectionMethod ? ` · ${result.collectionMethod === 'feed' ? 'Publisher feed, 0 Firecrawl credits' : 'Firecrawl'}` : ''}{!result.batch && result.candidatesFound ? ` · ${result.candidatesChecked} of ${result.candidatesFound} article candidates checked` : ''}</div>{result.headlines.length ? <div className="headline-list">{result.headlines.map(item => <article className="headline-card" key={item.id}><div className="headline-top"><span className="category-label">{item.sourceName}</span><span>{dateLabel(item.publishedAt)}</span></div><p><strong>{reportStoryText(item).headline}</strong>{item.summary && <> {reportStoryText(item).summary}</>} (<a href={item.url} target="_blank" rel="noopener noreferrer">{item.sourceName}</a>)</p></article>)}</div> : <div className="empty-result">No matching headline was found in this scan. This does not mean the source had no relevant news. Try broader keywords.</div>}</>}
          {auditRows.length > 0 && <section className="collection-audit" aria-label="Source verification"><h3>Source verification</h3><p>{auditRows.filter(row => row.status === 'extracted').length} of {auditRows.length} checked sources yielded articles. The remaining rows explain what was checked and what to try next.</p><div className="collection-audit-list">{auditRows.map(row => <details key={row.sourceId}><summary><strong>{row.name}</strong><span>{row.status === 'extracted' ? 'Articles extracted' : row.status === 'unavailable' ? 'Needs server access' : 'Needs follow-up'}</span></summary><p>{row.reason}</p>{row.attempts?.length > 0 && <p>Checked: {row.attempts.map(item => `${item.collectionMethod === 'feed' ? 'publisher feed' : item.listingUrl} (${item.listedCount ?? 0} listed, ${item.candidatesChecked ?? 0} article pages checked)`).join('; ')}.</p>}{row.errors?.length > 0 && <p>Errors: {row.errors.join('; ')}</p>}{row.attempts?.some(item => item.pageErrors?.length) && <p>Article errors: {row.attempts.flatMap(item => item.pageErrors || []).slice(0, 3).join('; ')}</p>}{row.remedy && <p>Next step: {row.remedy}</p>}<button onClick={() => loadSource(row.sourceId, true)} disabled={loading || staticPreview || (!config?.firecrawlConfigured && !config?.feedSourceIds?.includes(row.sourceId))}>Retry complete scan</button></details>)}</div></section>}
          {!loading && !result && !error && (staticPreview ? <div className="snapshot-results"><p>{selectedSourceStories.length ? `${selectedSourceStories.length} prepared update stories from ${active?.name}` : `No ${active?.name || 'source'} stories were selected for this prepared update.`}</p>{selectedSourceStories.map(item => <article className="headline-card" key={item.id}><h3><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title} ↗</a></h3></article>)}</div> : <div className="empty-result"><span className="empty-symbol">◎</span><strong>Your next story starts here.</strong><p>Choose a source or collect all visible sources. Results are filtered to the past 48 hours.</p></div>)}
        </section>
  );

  return <div className="app-shell" data-mode={siteConfig.darkMode ? 'dark' : 'light'} style={themeStyle}>
    <header className="topbar"><div className="brand-text"><strong>{siteConfig.brandName}</strong><small>{siteConfig.brandTagline}</small></div><span className="topbar-spacer"/><button className="mode-button" aria-pressed={siteConfig.darkMode} onClick={() => setSiteConfig(current => ({ ...current, darkMode: !current.darkMode }))}>{siteConfig.darkMode ? '☀ Light mode' : '☾ Dark mode'}</button><button className="manage-button" onClick={() => { setManagerTab('Content'); setManaging(true); }}>⚙ Manage site</button><time className="topbar-date" dateTime={currentTime.toISOString()} title="Vienna time">{formatViennaCompactDateTime(currentTime)}</time></header>
    <div className={`workspace ${siteConfig.showSources ? '' : 'no-sidebar'}`}>
      {siteConfig.showSources && <aside className="sidebar">
        <div className="sidebar-heading"><span className="eyebrow">DISCOVER</span><h2>Sources <em>{sources.length}</em></h2></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${websiteSourceId === x.id ? 'active' : ''}`} onClick={() => { setActiveId(x.id); setWebsiteSourceId(x.id); setResult(null); setError(''); }} aria-label={`Show ${x.name} website beside the daily news update`}><span className="source-icon">{x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length} visible sources</div>
      </aside>}
      <main className={`main-panel ${websiteSource ? 'with-website' : ''}`}>
        <div className={`reading-layout ${websiteSource ? 'website-open' : ''}`}>
        {siteConfig.showUpdate && <section className={`daily-update ${siteConfig.sectionHeadingUppercase ? 'uppercase-headings' : ''}`} aria-labelledby="daily-update-title">
          <div className="daily-heading"><div className="daily-heading-main"><div className="daily-title-row"><h2 id="daily-update-title">{siteConfig.updateTitle}</h2>{reportWindow?.windowStart && reportWindow?.windowEnd && <p className="report-date">{reportDateLabel(reportWindow.windowStart, reportWindow.windowEnd)}</p>}</div>{updateControls()}</div>{updateSearchOpen && <div className="update-search" role="search" aria-label="Search update"><input autoFocus type="search" value={updateSearchText} onChange={event => setUpdateSearchText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setUpdateSearchOpen(false); if (event.key === 'Enter' && updateSearchResults.length) { event.preventDefault(); setActiveSearchResult(current => (current + (event.shiftKey ? -1 : 1) + updateSearchResults.length) % updateSearchResults.length); } }} placeholder="Find text in update" aria-label="Find text in update"/><span role="status">{updateSearchQuery ? updateSearchResults.length ? `${Math.min(activeSearchResult + 1, updateSearchResults.length)} of ${updateSearchResults.length} stories` : 'No matches' : 'Search headlines, summaries, sources and sections'}</span><button type="button" aria-label="Previous match" disabled={!updateSearchResults.length} onClick={() => setActiveSearchResult(current => (current - 1 + updateSearchResults.length) % updateSearchResults.length)}>↑</button><button type="button" aria-label="Next match" disabled={!updateSearchResults.length} onClick={() => setActiveSearchResult(current => (current + 1) % updateSearchResults.length)}>↓</button><button type="button" aria-label="Close search" onClick={() => setUpdateSearchOpen(false)}>×</button></div>}{dailySections.length > 0 && <nav className="daily-section-nav" aria-label="Update sections" style={{ '--section-count': Math.min(dailySections.length, 6) }}>{dailySections.map(({ section }, index) => <a key={section} href={`#daily-section-${index}`} onClick={event => jumpToSection(event, index)}>{section}</a>)}</nav>}</div>
          {daily && <div className="daily-scroll" role="region" aria-label="Daily update stories" tabIndex={0}>
            {dailySections.map(({ sectionId, section, subsections }, sectionIndex) => <div className="daily-section" id={`daily-section-${sectionIndex}`} key={sectionId}>
              <h3 data-drop-kind="section" data-section-id={sectionId} data-subsection={subsections[0]?.[0] || ''} className={dropTarget === `section:${sectionId}` ? 'story-drop-target' : ''}>{highlightSearch(section)}</h3>
              {subsections.map(([subsection, items]) => <div key={subsection || 'direct'}>
                {subsection && <h4 data-drop-kind="subsection" data-section-id={sectionId} data-subsection={subsection} className={`${section === 'Miscellaneous' ? 'plain-topic' : ''} ${dropTarget === `subsection:${sectionId}:${subsection}` ? 'story-drop-target' : ''}`}>{highlightSearch(subsection)}</h4>}
                {editingStories && !items.length && <div data-drop-kind="empty" data-section-id={sectionId} data-subsection={subsection} className={`daily-empty-drop ${dropTarget === `empty:${sectionId}:${subsection}` ? 'story-drop-target' : ''}`}>Drag a story here</div>}
                {items.map((item, index) => <React.Fragment key={item.id}>
                  {item.country && (index === 0 || items[index - 1].country !== item.country) && <h5 data-drop-kind="country" data-section-id={sectionId} data-subsection={subsection} data-country={item.country} className={`daily-country ${dropTarget === `country:${sectionId}:${subsection}:${item.country}` ? 'story-drop-target' : ''}`}>{highlightSearch(item.country)}</h5>}
                  <article data-drop-kind="story" data-section-id={item.sectionId} data-subsection={item.subsection || ''} data-country={item.country || ''} data-story-id={item.id} className={`daily-story ${editingStories ? 'daily-story-editing' : ''} ${updateSearchOpen && updateSearchIds.has(item.id) ? 'search-match' : ''} ${updateSearchOpen && updateSearchResults[Math.min(activeSearchResult, updateSearchResults.length - 1)]?.id === item.id ? 'active-search-match' : ''} ${dropTarget === `story:${item.id}:before` ? 'story-drop-before' : ''} ${dropTarget === `story:${item.id}:after` ? 'story-drop-after' : ''}`}
                    onPointerDown={event => { if (!editingStories || event.target.closest('input,a') || (event.pointerType !== 'mouse' && !event.target.closest('.story-drag-handle'))) return; event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); pointerDragRef.current = item.id; }}
                    onPointerMove={movePointerStory} onPointerUp={finishPointerStory} onPointerCancel={() => { pointerDragRef.current = null; setDropTarget(''); }}>
                    {editingStories && <><input className="daily-story-checkbox" type="checkbox" checked={!excludedStoryIds.has(item.id)} aria-label={`Include story: ${item.title}`} onChange={event => setExcludedStoryIds(current => { const next = new Set(current); if (event.target.checked) next.delete(item.id); else next.add(item.id); return next; })}/><button type="button" className="story-drag-handle" aria-label={`Drag story: ${item.title}`} title="Drag to reorder or move">⋮⋮</button></>}
                    <div className="daily-story-content"><p><strong>{highlightSearch(reportStoryText(item).headline)}</strong>{item.summary && <> {highlightSearch(reportStoryText(item).summary)}</>} (<a href={item.url} target="_blank" rel="noopener noreferrer">{highlightSearch(item.sourceName)}</a>){Number.isFinite(Date.parse(item.publishedAt)) && <> <time className="daily-story-time" dateTime={item.publishedAt} title={dateLabel(item.publishedAt)}>{highlightSearch(formatViennaCompactDateTime(item.publishedAt))}{(item.timeSource === 'inferred' || item.timeSource === 'current') && ' · estimated'}</time></>}</p></div>
                  </article>
                </React.Fragment>)}
              </div>)}
            </div>)}
            {!readingArticles.length && <p className="daily-empty">{displayedArticles.length ? 'No stories are selected. Press Edit to choose stories for this update.' : 'There are no visible stories in this update. Use Manage site to show or add content.'}</p>}
            <div className="daily-disclaimer"><p><strong>Disclaimer:</strong> {disclaimerFirst}</p><p>{disclaimerSecond}</p></div>
            {siteConfig.showCoverage && <p className="daily-coverage">{coverageNote}</p>}
          </div>}
        </section>}
        {websiteSource && <section className="website-panel" aria-label={`${websiteSource.name} website`}><div className="website-panel-heading"><div><span className="eyebrow">SOURCE WEBSITE</span><h2>{websiteSource.name}</h2></div><button onClick={() => setWebsiteSourceId('')} aria-label="Close source website">×</button></div><div className="website-panel-actions"><a href={websiteSource.url} target="_blank" rel="noopener noreferrer">Open website in new tab ↗</a><button onClick={() => { setManagerTab('Collect'); setManaging(true); }}>Collect headlines</button></div><p>Some publishers block display inside other websites. Use the link above if this panel stays blank.</p><iframe key={websiteSource.id} src={websiteSource.url} title={`${websiteSource.name} website`} referrerPolicy="no-referrer" loading="lazy"/></section>}
        </div>

      </main>
    </div>{toast && <div className="toast" onClick={() => setToast('')}>{toast} ×</div>}
    {managing && <SiteManager initialTab={managerTab} collectionPanel={collectionPanel} config={siteConfig} setConfig={setSiteConfig} articles={daily?.articles ?? preparedUpdate.articles} baseSources={config?.sources ?? []} includeText={includeText} setIncludeText={setIncludeText} excludeText={excludeText} setExcludeText={setExcludeText} applyScope={applyScope} onClose={() => setManaging(false)} onReset={() => setSiteConfig(defaultSiteConfig(daily?.articles ?? preparedUpdate.articles))}/>}
    {addingArticles && <AddArticlesDialog serverAvailable={!staticPreview && Boolean(config?.firecrawlConfigured)} sources={configuredSources} sections={siteConfig.sections} existingUrls={[...(daily?.articles ?? []).map(item => item.url), ...siteConfig.customArticles.map(item => item.url)]} remainingSlots={100 - siteConfig.customArticles.length} onAdd={article => setSiteConfig(current => current.customArticles.some(item => item.url === article.url) ? current : { ...current, customArticles: [...current.customArticles, article] })} onClose={() => setAddingArticles(false)}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
