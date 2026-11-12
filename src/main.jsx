import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import preparedUpdate from '../data/prepared-update.json';
import archivedImportReference from '../data/daily-update-2026-10-24.json';
import preparedSources from '../sources.json';
import publishedSiteConfig from '../data/site-config.json';
import SiteManager from './SiteManager.jsx';
import NativeCollection from './NativeCollection.jsx';
import AddArticlesDialog from './AddArticlesDialog.jsx';
import ImportSpreadsheetDialog from './ImportSpreadsheetDialog.jsx';
import EditorLoginDialog from './EditorLoginDialog.jsx';
import MoveStoryDialog from './MoveStoryDialog.jsx';
import { defaultSiteConfig, normalizeSiteConfig, displaySiteContent, displaySources, moveArticleInConfig, toggleLeadStoryInConfig, addCustomArticleInConfig, extendSiteConfigForImportedPlacements, canonicalArticleUrl } from './siteConfig.js';
import { mergeImportedArticles, removeStoryFromEdition, removeStoryFromConfig } from './editionActions.js';
import { orderedSubsections, leadRegionalHeadings } from './newsSections.js';
import { createReportDocxFromTemplate } from './docxBuilder.js';
import { reportFilename } from './reportFilename.js';
import { reportEndDateLabel, reportShortDateLabel } from './reportDate.js';
import { parseEditedArticleDate } from './articleDateEdit.js';
import { reportStoryText } from './reportText.js';
import { duplicateGroups, duplicateGroupHue } from './storyDuplicates.js';
import { storyOrigin } from './storyOrigin.js';
import { disclaimerFirst, disclaimerSecond } from './disclaimer.js';
import { countCoveredCountries } from './collectionSummary.js';
import { formatViennaDateTime } from './viennaTime.js';
import { emailSubject, emailUpdateHtml, emailUpdateText } from './emailUpdate.js';
import { loadFullArticle } from './articleBodyClient.js';
import { getStoredArticleBody, storeArticleBodies } from './articleBodyStore.js';
import { editorEmail, loadSharedBody, loadSharedEdition, publishSharedEdition, sharedClient, sharedPayload } from './sharedEdition.js';
import { emptyEdition } from './emptyEdition.js';
import { createSpreadsheet, spreadsheetRow } from './spreadsheetExport.js';
import { reportHeadingLabel } from './reportLabels.js';
import { useEscapeToClose } from './useEscapeToClose.js';
import { apiUrl } from './apiUrl.js';
import { fetchGithubDraft, githubCollectionStatus } from './githubCollection.js';
import './styles.css';

const readStored = (key, fallback, legacyKey) => {
  try { return JSON.parse(localStorage.getItem(key) ?? (legacyKey ? localStorage.getItem(legacyKey) : null)) ?? fallback; } catch { return fallback; }
};
const defaultScope = 'OSCE, cooperation, diplomacy, bilateral, foreign policy, talks, summit, peace, sanctions, NATO, EU, UN, security, defense, defence, conflict, war, terrorism, military, politics, political, election, Russia, Ukraine';
const dateLabel = formatViennaDateTime;
const sharedEnabled = Boolean(sharedClient);
const githubCollectionMode = typeof window !== 'undefined' && window.DNU_COLLECTION_MODE === 'github';
const importedUpdateKey = 'dnu-imported-update-v1';
const importBackupKey = 'dnu-before-import-v1';
const blankEditionResetKey = `dnu-empty-edition-reset-${preparedUpdate.checkedAt}`;
if (!sharedEnabled && preparedUpdate.emptyPrepared && !localStorage.getItem(blankEditionResetKey)) {
  localStorage.removeItem(importedUpdateKey);
  localStorage.removeItem(importBackupKey);
  localStorage.removeItem('dnu-excluded-story-ids-v1');
  localStorage.removeItem('dnu-current-edition-v1');
  const savedSettings = readStored('dnu-site-settings-v1', null);
  if (savedSettings) localStorage.setItem('dnu-site-settings-v1', JSON.stringify({
    ...savedSettings, showUpdate: true, customArticles: [], articleEdits: {}, articleOrder: [], leadOrigins: {}
  }));
  localStorage.setItem(blankEditionResetKey, '1');
}
const compactSectionLabels = {
  'Lead stories': 'LEAD',
  'South Eastern Europe': 'SEE',
  'Eastern Europe': 'EE',
  'South Caucasus': 'SC',
  'Central Asia': 'CA',
  Miscellaneous: 'MISCL'
};

function scrollReportTo(target, gap) {
  const scroller = target.closest('.daily-scroll');
  if (!scroller) return;
  if (getComputedStyle(scroller).overflowY === 'visible') {
    const headingHeight = document.querySelector('.daily-heading')?.getBoundingClientRect().height || 0;
    window.scrollTo({ top: window.scrollY + target.getBoundingClientRect().top - headingHeight - gap, behavior: 'smooth' });
  } else {
    scroller.scrollTo({ top: scroller.scrollTop + target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - gap, behavior: 'smooth' });
  }
}

function App() {
  const [compiledAt, setCompiledAt] = useState(() => sharedEnabled ? preparedUpdate.checkedAt : readStored(importedUpdateKey, null)?.checkedAt || preparedUpdate.checkedAt || new Date().toISOString());
  const [config, setConfig] = useState(null);
  const [daily, setDaily] = useState(() => sharedEnabled ? null : readStored(importedUpdateKey, null));
  const [importedMode, setImportedMode] = useState(() => !sharedEnabled && Boolean(readStored(importedUpdateKey, null)?.importedFromSpreadsheet));
  const [editorUser, setEditorUser] = useState(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [sharedReady, setSharedReady] = useState(!sharedEnabled);
  const [sharedError, setSharedError] = useState('');
  const [saveStatus, setSaveStatus] = useState('');
  const [nativeDraftMode, setNativeDraftMode] = useState(false);
  const sharedRevisionRef = useRef(0);
  const savedPayloadRef = useRef('');
  const pendingBodiesRef = useRef(null);
  const pendingPublishNoticeRef = useRef(null);
  const savingRef = useRef(false);
  const syncAgainRef = useRef(false);
  const [syncTick, setSyncTick] = useState(0);
  const importedModeRef = useRef(importedMode);
  const restoringImportRef = useRef(false);
  const [staticPreview, setStaticPreview] = useState(false);
  const [websiteSourceId, setWebsiteSourceId] = useState('');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All sources');
  const [includeText, setIncludeText] = useState(() => readStored('dnu-include', defaultScope, 'signal-include'));
  const [excludeText, setExcludeText] = useState(() => readStored('dnu-exclude', '', 'signal-exclude'));
  const [toast, setToast] = useState('');
  const [exportingSheet, setExportingSheet] = useState(false);
  const [spreadsheetResults, setSpreadsheetResults] = useState(null);
  useEscapeToClose('spreadsheet-results-title', () => setSpreadsheetResults(null), Boolean(spreadsheetResults));
  const [managing, setManaging] = useState(false);
  const [scrapingOpen, setScrapingOpen] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState(null);
  useEscapeToClose('scrape-dialog-title', () => setScrapingOpen(false), scrapingOpen);
  const [editingStories, setEditingStories] = useState(false);
  const [headlineOnly, setHeadlineOnly] = useState(() => readStored('dnu-headline-only-v1', false) === true);
  const [moveStoryId, setMoveStoryId] = useState('');
  const [dropTarget, setDropTarget] = useState('');
  const pointerDragRef = useRef(null);
  const pendingReadingPositionRef = useRef(null);
  const [addingArticles, setAddingArticles] = useState(false);
  const [importingSpreadsheet, setImportingSpreadsheet] = useState(false);
  const [updateSearchOpen, setUpdateSearchOpen] = useState(false);
  const [updateSearchText, setUpdateSearchText] = useState('');
  const [activeSearchResult, setActiveSearchResult] = useState(0);
  const [excludedStoryIds, setExcludedStoryIds] = useState(() => {
    if (sharedEnabled) return new Set();
    const saved = readStored('dnu-excluded-story-ids-v1', []);
    return new Set(Array.isArray(saved) ? saved.filter(id => typeof id === 'string') : []);
  });
  const [managerTab, setManagerTab] = useState('Content');
  const [siteConfig, setSiteConfig] = useState(() => {
    const stored = sharedEnabled ? { ...publishedSiteConfig, darkMode: readStored('dnu-site-settings-v1', publishedSiteConfig)?.darkMode === true }
      : readStored('dnu-site-settings-v1', publishedSiteConfig, 'signal-site-settings-v1');
    const shouldIncrease = !readStored('dnu-font-increase-v1', false, 'signal-font-increase-v1') && stored.fontSize === 14;
    localStorage.setItem('dnu-font-increase-v1', JSON.stringify(true));
    return normalizeSiteConfig({ ...stored, fontSize: shouldIncrease ? 18 : stored.fontSize }, preparedUpdate.articles);
  });
  const isEditor = Boolean(editorUser && sharedReady);
  const managementEnabled = isEditor;

  useEffect(() => { fetch(apiUrl('/api/config')).then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(setConfig).catch(() => setConfig({ sources: preparedSources, firecrawlConfigured: false })); }, []);

  useEffect(() => {
    if (!isEditor) { setScrapeStatus(null); return; }
    let active = true;
    const refresh = async () => {
      try {
        let result;
        if (githubCollectionMode) result = await githubCollectionStatus();
        else {
          const response = await fetch(apiUrl('/api/collection'), { cache: 'no-store' });
          if (!response.ok) return;
          result = await response.json();
        }
        if (active) setScrapeStatus(result);
      } catch { /* The separate collection server may not be deployed yet. */ }
    };
    refresh();
    const timer = setInterval(refresh, githubCollectionMode ? 20_000 : 5000);
    return () => { active = false; clearInterval(timer); };
  }, [isEditor]);

  useEffect(() => {
    if (!sharedClient) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const record = await loadSharedEdition();
        if (cancelled) return;
        const edition = record.edition?.articles ? record.edition : preparedUpdate;
        const settings = record.settings?.sections ? record.settings : publishedSiteConfig;
        const excluded = new Set(Array.isArray(record.excluded_story_ids) ? record.excluded_story_ids : []);
        const date = record.edition?.articles ? record.compiled_at : edition.checkedAt;
        const normalized = normalizeSiteConfig({ ...settings, darkMode: readStored('dnu-site-settings-v1', publishedSiteConfig)?.darkMode === true }, edition.articles);
        sharedRevisionRef.current = Number(record.revision);
        savedPayloadRef.current = JSON.stringify(sharedPayload(edition, normalized, excluded, date));
        setDaily(edition);
        setSiteConfig(normalized);
        setExcludedStoryIds(excluded);
        setCompiledAt(date);
        setImportedMode(edition.importedFromSpreadsheet === true);
        setStaticPreview(true);
        setSharedError('');
        setSharedReady(true);
      } catch (failure) {
        if (cancelled) return;
        setSharedReady(false);
        setSharedError(`The shared update is unavailable: ${failure.message}`);
        setDaily(null);
        setStaticPreview(true);
      }
    };
    if (!editorUser || !sharedReady) refresh();
    const timer = setInterval(() => { if (!editorUser) refresh(); }, 20_000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [editorUser]);

  useEffect(() => {
    if (!sharedClient) return;
    sharedClient.auth.getUser().then(({ data, error }) => {
      if (!error && data.user?.email?.toLowerCase() === editorEmail) setEditorUser(data.user);
    });
    const { data } = sharedClient.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') return;
      setEditorUser(session?.user?.email?.toLowerCase() === editorEmail ? session.user : null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (sharedEnabled) return;
    const refresh = () => {
      if (importedModeRef.current) return;
      fetch(apiUrl('/api/daily-update')).then(r => { if (!r.ok) throw new Error('API unavailable'); return r.json(); }).then(data => { if (importedModeRef.current) return; setDaily(data); setCompiledAt(data.checkedAt || new Date().toISOString()); setStaticPreview(false); }).catch(() => { if (importedModeRef.current) return; setDaily(preparedUpdate); setCompiledAt(preparedUpdate.checkedAt || new Date().toISOString()); setStaticPreview(true); });
    };
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { localStorage.setItem('dnu-site-settings-v1', JSON.stringify(siteConfig)); document.title = siteConfig.brandName || 'SITUATION ROOM'; }, [siteConfig]);
  useEffect(() => {
    if (sharedEnabled) return;
    if (!daily) return;
    const editionId = JSON.stringify([daily.windowStart, daily.windowEnd, daily.checkedAt]);
    if (localStorage.getItem('dnu-current-edition-v1') === editionId) return;
    if (daily.importedFromSpreadsheet || restoringImportRef.current) {
      restoringImportRef.current = false;
      localStorage.setItem('dnu-current-edition-v1', editionId);
      return;
    }
    localStorage.setItem('dnu-current-edition-v1', editionId);
  }, [daily?.windowStart, daily?.windowEnd, daily?.checkedAt]);
  useEffect(() => { if (!sharedEnabled) localStorage.setItem('dnu-excluded-story-ids-v1', JSON.stringify([...excludedStoryIds])); }, [excludedStoryIds]);
  useEffect(() => { if (!sharedEnabled && importedModeRef.current && daily?.importedFromSpreadsheet) localStorage.setItem(importedUpdateKey, JSON.stringify(daily)); }, [daily]);
  useEffect(() => { localStorage.setItem('dnu-headline-only-v1', JSON.stringify(headlineOnly)); }, [headlineOnly]);
  useEffect(() => {
    if (!sharedClient || !editorUser || !sharedReady || !daily || editingStories || nativeDraftMode) return;
    const payload = sharedPayload(daily, siteConfig, excludedStoryIds, compiledAt);
    const fingerprint = JSON.stringify(payload);
    if (fingerprint === savedPayloadRef.current && !pendingBodiesRef.current) return;
    const timer = setTimeout(async () => {
      if (savingRef.current) { syncAgainRef.current = true; return; }
      savingRef.current = true;
      setSaveStatus('Saving…');
      const pending = pendingBodiesRef.current;
      const notice = pendingPublishNoticeRef.current;
      try {
        const bodies = [...(pending?.bodies || [])];
        const bodyUrls = new Set(bodies.map(item => item.url));
        for (const item of siteConfig.customArticles || []) {
          if (bodyUrls.has(item.url)) continue;
          const stored = await getStoredArticleBody(item.url);
          if (stored?.body) bodies.push({ url: item.url, ...stored });
        }
        const revision = await publishSharedEdition(sharedRevisionRef.current, payload,
          pending || bodies.length ? { replace: pending?.replace === true, bodies } : null);
        sharedRevisionRef.current = revision;
        savedPayloadRef.current = fingerprint;
        if (pendingBodiesRef.current === pending) pendingBodiesRef.current = null;
        setSaveStatus('Saved for everyone');
        if (notice && pendingPublishNoticeRef.current === notice) {
          setToast(notice);
          pendingPublishNoticeRef.current = null;
        }
      } catch (failure) {
        setSaveStatus(`Not published: ${failure.message}`);
        if (notice && pendingPublishNoticeRef.current === notice) setToast(`Not published: ${failure.message}`);
      }
      finally {
        savingRef.current = false;
        if (syncAgainRef.current) { syncAgainRef.current = false; setSyncTick(value => value + 1); }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [editorUser, sharedReady, daily, siteConfig, excludedStoryIds, compiledAt, editingStories, nativeDraftMode, syncTick]);
  useLayoutEffect(() => {
    const position = pendingReadingPositionRef.current;
    if (!position) return;
    pendingReadingPositionRef.current = null;
    const scroller = document.querySelector('.daily-scroll');
    const anchor = [...(scroller?.querySelectorAll('.daily-story') || [])].find(story => story.dataset.storyId === position.storyId);
    if (anchor) {
      const shift = anchor.getBoundingClientRect().top - position.anchorTop;
      if (position.pageScroll) window.scrollBy(0, shift);
      else scroller.scrollTop += shift;
    } else if (position.pageScroll) window.scrollTo(0, position.scrollTop);
    else if (scroller) scroller.scrollTop = position.scrollTop;
  }, [editingStories, headlineOnly]);
  const configuredSources = useMemo(() => displaySources(config?.sources ?? [], { ...siteConfig, hiddenSourceIds: [] }), [config, siteConfig]);
  const sources = useMemo(() => displaySources(config?.sources ?? [], siteConfig), [config, siteConfig]);
  const websiteSource = sources.find(x => x.id === websiteSourceId);
  const groups = ['All sources', ...new Set(sources.map(x => x.group))];
  const visibleSources = useMemo(() => sources.filter(x => (group === 'All sources' || x.group === group) && `${x.name} ${x.group} ${x.url}`.toLowerCase().includes(search.toLowerCase())), [sources, group, search]);
  const displayedArticles = useMemo(() => displaySiteContent(daily?.articles ?? [], siteConfig, excludedStoryIds, daily?.importedFromSpreadsheet === true), [daily, siteConfig, excludedStoryIds]);
  const storyToMove = displayedArticles.find(item => item.id === moveStoryId);
  const selectedArticles = useMemo(() => displayedArticles.filter(item => !excludedStoryIds.has(item.id)), [displayedArticles, excludedStoryIds]);
  const coveredCountries = useMemo(() => countCoveredCountries(selectedArticles), [selectedArticles]);
  const readingArticles = editingStories ? displayedArticles : selectedArticles;
  const duplicateMatches = useMemo(() => isEditor ? duplicateGroups(selectedArticles) : new Map(), [selectedArticles, isEditor]);
  const updateSearchQuery = updateSearchText.trim().toLocaleLowerCase();
  const updateSearchResults = useMemo(() => updateSearchQuery ? readingArticles.filter(item => {
    const story = reportStoryText(item);
    return [item.section, item.subsection, item.country, reportHeadingLabel(item.subsection), reportHeadingLabel(item.country), story.headline, ...(headlineOnly && !editingStories ? [] : [story.summary]), item.sourceName, reportShortDateLabel(item.publishedAt)]
      .some(value => String(value || '').toLocaleLowerCase().includes(updateSearchQuery));
  }) : [], [readingArticles, updateSearchQuery, headlineOnly, editingStories]);
  const updateSearchIds = useMemo(() => new Set(updateSearchResults.map(item => item.id)), [updateSearchResults]);
  useEffect(() => { setActiveSearchResult(0); }, [updateSearchQuery]);
  useEffect(() => {
    if (!updateSearchOpen || !updateSearchResults.length) return;
    const item = updateSearchResults[Math.min(activeSearchResult, updateSearchResults.length - 1)];
    const target = [...document.querySelectorAll('.daily-scroll .daily-story')].find(node => node.dataset.storyId === item.id);
    if (!target) return;
    scrollReportTo(target, 20);
  }, [updateSearchOpen, updateSearchResults, activeSearchResult]);
  const reportWindow = useMemo(() => {
    if (!daily) return null;
    const times = selectedArticles.map(item => Date.parse(item.publishedAt)).filter(Number.isFinite);
    return { ...daily, windowStart: new Date(Math.min(Date.parse(daily.windowStart), ...times)).toISOString(), windowEnd: new Date(Math.max(Date.parse(daily.windowEnd), ...times)).toISOString() };
  }, [daily, selectedArticles]);
  const coverageDetails = `${selectedArticles.length} ${selectedArticles.length === 1 ? 'story' : 'stories'} included · ${coveredCountries} ${coveredCountries === 1 ? 'country' : 'countries'} represented${reportWindow?.windowStart && reportWindow?.windowEnd ? ` · Coverage period: ${dateLabel(reportWindow.windowStart)} – ${dateLabel(reportWindow.windowEnd)}` : ''}.`;
  const coverageDescription = !daily ? '' : daily.emptyPrepared
    ? selectedArticles.length ? sharedEnabled ? 'This update contains stories added by the editor.' : 'This update contains stories added in this browser; the published edition is empty.' : ''
    : daily.importedFromSpreadsheet
    ? `Imported from ${daily.importedFileName || 'a spreadsheet'}${sharedEnabled ? ' for the shared update.' : ' in this browser. The public edition has not changed.'}`
    : siteConfig.coverageText || (reportWindow?.windowStart
    ? `Original snapshot prepared ${dateLabel(daily.checkedAt)} from selected article pages.${selectedArticles.some(item => item.id.startsWith('manual-')) ? ' Includes articles added in this browser.' : ''}${selectedArticles.some(item => item.timeSource === 'inferred' || item.timeSource === 'current') ? ' Some added articles have inferred dates or were stamped when added.' : ''} The original snapshot does not refresh automatically.`
    : `Prepared ${dateLabel(daily?.checkedAt)} from selected reporting in the preceding ${daily?.windowHours || 48} hours.`);
  const coverageNote = daily ? `${coverageDescription ? `${coverageDescription.trim()} ` : ''}${coverageDetails}` : '';
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
    const sectionOrder = new Map(siteConfig.sections.map((section, index) => [section.id, index]));
    const extraRegionalHeadings = leadRegionalHeadings(readingArticles, siteConfig.leadOrigins);
    return [...sections].sort(([a], [b]) => (sectionOrder.get(a) ?? 999) - (sectionOrder.get(b) ?? 999)).map(([sectionId, subsections]) => ({
      sectionId,
      section: siteConfig.sections.find(item => item.id === sectionId)?.name || sectionId,
      subsections: orderedSubsections(siteConfig.sections.find(item => item.id === sectionId), subsections.keys(), extraRegionalHeadings).map(label => [label, subsections.get(label)])
    }));
  }, [readingArticles, siteConfig.sections, siteConfig.leadOrigins]);
  async function importSpreadsheet(result, fileName) {
    const importedAt = new Date().toISOString();
    const currentArticles = [...(daily?.articles || []), ...(siteConfig.customArticles || [])];
    const existingKeys = new Set(currentArticles.map(article => canonicalArticleUrl(article.url)));
    const newArticles = result.articles.filter(article => !existingKeys.has(canonicalArticleUrl(article.url)));
    const mergedArticles = mergeImportedArticles(daily?.articles || [], newArticles);
    const addedCount = mergedArticles.length - (daily?.articles?.length || 0);
    const dates = mergedArticles.map(article => Date.parse(article.publishedAt)).filter(Number.isFinite);
    const priorStart = Date.parse(daily?.windowStart);
    const priorEnd = Date.parse(daily?.windowEnd);
    const windowStart = new Date(Math.min(...dates, ...(Number.isFinite(priorStart) ? [priorStart] : []))).toISOString();
    const windowEnd = new Date(Math.max(...dates, ...(Number.isFinite(priorEnd) ? [priorEnd] : []))).toISOString();
    const update = {
      ...(daily || {}), title: 'DAILY NEWS UPDATE', checkedAt: importedAt, importedFromSpreadsheet: true,
      importedFileName: fileName.slice(0, 180),
      windowStart, windowEnd,
      windowHours: (Date.parse(windowEnd) - Date.parse(windowStart)) / 3_600_000,
      articles: mergedArticles, sourceOutcomes: daily?.sourceOutcomes || []
    };
    await storeArticleBodies(result.bodies);
    if (sharedEnabled) {
      const prior = pendingBodiesRef.current?.bodies || [];
      pendingBodiesRef.current = { replace: false, bodies: [...new Map([...prior, ...result.bodies].map(body => [body.url, body])).values()] };
    }
    else {
      if (!importedModeRef.current) localStorage.setItem(importBackupKey, JSON.stringify({ siteConfig, excludedStoryIds: [...excludedStoryIds], compiledAt }));
      localStorage.setItem(importedUpdateKey, JSON.stringify(update));
    }
    importedModeRef.current = true;
    setImportedMode(true);
    setSiteConfig(current => ({ ...extendSiteConfigForImportedPlacements(current, newArticles), showUpdate: true }));
    setEditingStories(false);
    setDaily(update);
    setCompiledAt(importedAt);
    setImportingSpreadsheet(false);
    const importedMessage = `Imported ${result.articles.length} stories from ${fileName}: ${addedCount} added, ${result.articles.length - addedCount} already present${result.skipped.length ? `; ${result.skipped.length} skipped` : ''}. Earlier stories remain in the update.`;
    if (sharedEnabled) {
      pendingPublishNoticeRef.current = `${importedMessage} Saved for everyone.`;
      setSaveStatus('Saving…');
      setToast(`${importedMessage} Publishing for everyone…`);
    } else setToast(importedMessage);
  }

  async function restorePublishedUpdate() {
    const backup = readStored(importBackupKey, null);
    let update = preparedUpdate, fromServer = false;
    try {
      const response = await fetch(apiUrl('/api/daily-update'));
      if (response.ok) { update = await response.json(); fromServer = true; }
    } catch { /* GitHub Pages uses the bundled update. */ }
    restoringImportRef.current = true;
    importedModeRef.current = false;
    localStorage.removeItem(importedUpdateKey);
    localStorage.removeItem(importBackupKey);
    if (backup?.siteConfig) setSiteConfig(normalizeSiteConfig(backup.siteConfig, update.articles));
    if (backup?.excludedStoryIds) setExcludedStoryIds(new Set(backup.excludedStoryIds));
    setImportedMode(false);
    setDaily(update);
    setCompiledAt(backup?.compiledAt || update.checkedAt || new Date().toISOString());
    setStaticPreview(!fromServer);
    setImportingSpreadsheet(false);
    setToast('Published update restored.');
  }

  function clearCurrentUpdate() {
    if (sharedEnabled) {
      const clearedAt = new Date().toISOString();
      pendingBodiesRef.current = null;
      pendingPublishNoticeRef.current = 'All stories cleared. Saved for everyone.';
      setSaveStatus('Saving…');
      setToast('Clearing stories. Publishing for everyone…');
      importedModeRef.current = false;
      setImportedMode(false);
      setSiteConfig(current => ({ ...current, showUpdate: true, customArticles: [], articleEdits: {}, articleOrder: [], leadOrigins: {} }));
      setExcludedStoryIds(new Set());
      setEditingStories(false);
      setDaily(current => emptyEdition(current || preparedUpdate, clearedAt));
      setCompiledAt(clearedAt);
      setImportingSpreadsheet(false);
      return;
    }
    restoringImportRef.current = true;
    importedModeRef.current = false;
    localStorage.removeItem(importedUpdateKey);
    localStorage.removeItem(importBackupKey);
    setSiteConfig(current => ({ ...current, showUpdate: true, customArticles: [], articleEdits: {}, articleOrder: [], leadOrigins: {} }));
    setExcludedStoryIds(new Set());
    setImportedMode(false);
    setEditingStories(false);
    setDaily(preparedUpdate);
    setCompiledAt(preparedUpdate.checkedAt);
    setStaticPreview(true);
    setImportingSpreadsheet(false);
    setToast('Update cleared. Its structure and article cache remain available.');
  }

  function applyScope() {
    localStorage.setItem('dnu-include', JSON.stringify(includeText));
    localStorage.setItem('dnu-exclude', JSON.stringify(excludeText));
    setToast('Keywords saved locally. The native collector uses its configured editorial rules.');
  }
  async function downloadManagedDocx() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}daily-update-template.docx`);
      if (!response.ok) throw new Error('The Word template is unavailable.');
      const templateBytes = await response.arrayBuffer();
      const file = await createReportDocxFromTemplate(templateBytes, { title: siteConfig.updateTitle, windowStart: reportWindow?.windowStart, windowEnd: daily?.windowEnd, compiledAt, articles: selectedArticles, headlineOnly, sourceOutcomes: daily?.sourceOutcomes ?? [] });
      const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a'); a.href = url; a.download = reportFilename(reportWindow); document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { setToast(error.message || 'Could not create the Word update.'); }
  }

  async function emailManagedUpdate() {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setToast('This browser cannot copy formatted email text. Try a current browser on the secure website.');
      return;
    }
    const content = { title: siteConfig.updateTitle, compiledAt, articles: selectedArticles, headlineOnly, logoUrl: new URL(`${import.meta.env.BASE_URL}osce-logo.png`, window.location.href).href };
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([emailUpdateHtml(content)], { type: 'text/html' }),
        'text/plain': new Blob([emailUpdateText(content)], { type: 'text/plain' })
      })]);
      setToast('Formatted update copied. Paste it into the new email body.');
      window.location.href = `mailto:?subject=${encodeURIComponent(emailSubject(compiledAt))}`;
    } catch {
      setToast('Could not copy the formatted update. Allow clipboard write access, then try Email again.');
    }
  }

  async function exportSpreadsheet() {
    if (exportingSheet || !selectedArticles.length) return;
    setExportingSheet(true);
    setSpreadsheetResults(null);
    const rows = new Array(selectedArticles.length);
    const failures = [];
    let cursor = 0, completed = 0;
    setToast(`Collecting full articles: 0/${selectedArticles.length}`);
    const worker = async () => {
      while (cursor < selectedArticles.length) {
        const index = cursor++;
        const article = selectedArticles[index];
        try {
          const page = await loadFullArticle(article, { serverAvailable: !staticPreview,
            cacheOnly: sharedEnabled || importedMode || article.fromSpreadsheet,
            sharedLookup: sharedEnabled ? loadSharedBody : null });
          rows[index] = spreadsheetRow(article, page, siteConfig.leadOrigins);
        } catch (error) { failures.push(`${article.sourceName}: ${article.title} (${error.message})`); }
        completed++;
        setToast(`Collecting full articles: ${completed}/${selectedArticles.length}${failures.length ? ` · ${failures.length} unavailable` : ''}`);
      }
    };
    try {
      await Promise.all(Array.from({ length: Math.min(3, selectedArticles.length) }, worker));
      const successfulRows = rows.filter(Boolean);
      if (successfulRows.length) {
        const file = await createSpreadsheet(successfulRows);
        const url = URL.createObjectURL(file);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Daily news update - ${reportEndDateLabel(compiledAt)}.xlsx`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      }
      setSpreadsheetResults({ exported: successfulRows.length, attempted: selectedArticles.length, failures, downloaded: successfulRows.length > 0 });
      setToast('Spreadsheet export finished.');
    } catch (error) {
      setSpreadsheetResults({ exported: 0, attempted: selectedArticles.length, failures, downloaded: false, error: error.message || 'Could not create the spreadsheet.' });
      setToast('Could not create the spreadsheet.');
    }
    finally { setExportingSheet(false); }
  }

  const readStoryDrafts = () => Object.fromEntries([...document.querySelectorAll('.daily-scroll .daily-story[data-story-id]')].map(story => {
    const dateField = story.querySelector('[data-edit-field="publishedAt"]');
    return [story.dataset.storyId, {
      title: story.querySelector('[data-edit-field="title"]')?.innerText.trim() || '',
      summary: story.querySelector('[data-edit-field="summary"]')?.innerText.trim() || '',
      sourceName: story.querySelector('[data-edit-field="sourceName"]')?.innerText.trim() || '',
      publishedAt: parseEditedArticleDate(dateField?.innerText, dateField?.getAttribute('datetime'))
    }];
  }));
  const validStoryDrafts = drafts => {
    if (Object.values(drafts).some(draft => !draft.title || !draft.sourceName)) {
      setToast('Each story needs a headline and agency before saving.');
      return false;
    }
    if (Object.values(drafts).some(draft => !draft.publishedAt)) {
      setToast('Enter each article date as 14 Oct 26 or 2026-10-14 before saving.');
      return false;
    }
    return true;
  };
  const applyStoryDrafts = (current, drafts) => ({
    ...current,
    articleEdits: Object.fromEntries([...Object.entries(current.articleEdits), ...Object.entries(drafts)
      .filter(([id]) => !(current.customArticles.some(item => item.id === id)))
      .map(([id, draft]) => [id, { ...(current.articleEdits[id] || {}), title: draft.title.trim(), summary: draft.summary.trim(), summaryEdited: true, sourceName: draft.sourceName.trim(), publishedAt: draft.publishedAt }])]),
    customArticles: current.customArticles.map(item => drafts[item.id] ? { ...item, title: drafts[item.id].title, summary: drafts[item.id].summary, sourceName: drafts[item.id].sourceName, publishedAt: drafts[item.id].publishedAt } : item)
  });
  const rememberReadingPosition = () => {
    const scroller = document.querySelector('.daily-scroll');
    if (!scroller) return;
    const pageScroll = getComputedStyle(scroller).overflowY === 'visible';
    const top = pageScroll ? (document.querySelector('.daily-heading')?.getBoundingClientRect().bottom || 0) : scroller.getBoundingClientRect().top;
    const bottom = pageScroll ? window.innerHeight : scroller.getBoundingClientRect().bottom;
    const anchor = [...scroller.querySelectorAll('.daily-story')].find(story => {
      const box = story.getBoundingClientRect();
      return box.bottom > top && box.top < bottom && (!editingStories || !excludedStoryIds.has(story.dataset.storyId));
    });
    pendingReadingPositionRef.current = { storyId: anchor?.dataset.storyId, anchorTop: anchor?.getBoundingClientRect().top, pageScroll, scrollTop: pageScroll ? window.scrollY : scroller.scrollTop };
  };
  const toggleStoryEditing = () => {
    if (!editingStories) {
      rememberReadingPosition();
      setEditingStories(true);
      return;
    }
    const drafts = readStoryDrafts();
    if (!validStoryDrafts(drafts)) return;
    rememberReadingPosition();
    setSiteConfig(current => applyStoryDrafts(current, drafts));
    setEditingStories(false);
    setMoveStoryId('');
    setCompiledAt(new Date().toISOString());
  };
  const relocateStory = (storyId, destination) => {
    const drafts = readStoryDrafts();
    if (!validStoryDrafts(drafts)) return false;
    setSiteConfig(current => moveArticleInConfig(applyStoryDrafts(current, drafts), daily?.articles ?? [], storyId, destination, excludedStoryIds));
    setCompiledAt(new Date().toISOString());
    return true;
  };
  const moveStory = destination => relocateStory(moveStoryId, destination);
  const toggleLeadStory = storyId => {
    const drafts = readStoryDrafts();
    if (!validStoryDrafts(drafts)) return;
    setSiteConfig(current => toggleLeadStoryInConfig(applyStoryDrafts(current, drafts), daily?.articles ?? [], storyId, excludedStoryIds));
    setCompiledAt(new Date().toISOString());
  };
  const deleteStory = storyId => {
    const drafts = readStoryDrafts();
    delete drafts[storyId];
    if (!validStoryDrafts(drafts)) return;
    setSiteConfig(current => removeStoryFromConfig(applyStoryDrafts(current, drafts), storyId));
    setDaily(current => removeStoryFromEdition(current, storyId));
    setExcludedStoryIds(current => new Set([...current].filter(id => id !== storyId)));
    setMoveStoryId(current => current === storyId ? '' : current);
    setToast('Story deleted. Save edits to publish the change.');
  };
  const keepStoryTextInline = event => { if (event.key === 'Enter') event.preventDefault(); };
  const updateControls = () => daily && <div className="daily-downloads">
    {isEditor && <button className="daily-action daily-edit" type="button" aria-label="Add articles" title="Add article URLs" onClick={() => setAddingArticles(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg></button>}
    {isEditor && <button className="daily-action daily-edit" type="button" aria-label="Import spreadsheet" title={editingStories ? 'Save edits before importing a spreadsheet' : 'Import stories from an Excel or CSV file'} disabled={editingStories} onClick={() => setImportingSpreadsheet(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h18v16H3zM3 9h18M3 14h11M10 9v11M16 9v5m2 2v5m-3-3 3 3 3-3"/></svg></button>}
    {isEditor && <button className="daily-action daily-edit" type="button" aria-label="Scrape news now" title={editingStories ? 'Save edits before scraping' : githubCollectionMode ? 'Run the GitHub news scraper and review its draft' : 'Scrape publisher sites now and review the draft'} disabled={editingStories} onClick={() => setScrapingOpen(true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.8 9a7 7 0 0 1 12-2L20 12M4 12l2.2 5a7 7 0 0 0 12-2"/></svg></button>}
    {isEditor && <button className="daily-action daily-edit" type="button" aria-label={editingStories ? 'Save edits' : 'Edit update'} title={editingStories ? 'Save text and story changes' : 'Edit text and stories'} aria-pressed={editingStories} disabled={!displayedArticles.length && !editingStories} onClick={toggleStoryEditing}><svg viewBox="0 0 24 24" aria-hidden="true">{editingStories ? <path d="m4 12 5 5L20 6"/> : <><path d="m4 20 4.2-.9L19 8.3 15.7 5 4.9 15.8 4 20Z"/><path d="m13.9 6.8 3.3 3.3"/></>}</svg></button>}
    <button className={`daily-action daily-edit ${headlineOnly ? 'is-active' : ''}`} type="button" aria-label={headlineOnly ? 'Show full view' : 'Show compressed view'} title={editingStories ? 'Save edits before switching views' : headlineOnly ? 'Show full view with summaries' : 'Show compressed view without summaries'} aria-pressed={headlineOnly} disabled={editingStories} onClick={() => { rememberReadingPosition(); setHeadlineOnly(current => !current); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h16"/>{!headlineOnly && <path d="M4 15h16"/>}</svg></button>
    <button className="daily-action daily-download" type="button" aria-label="Download update" title={editingStories ? 'Save edits before downloading' : headlineOnly ? 'Download compressed Word update' : 'Download Word update with summaries'} disabled={!selectedArticles.length || editingStories} onClick={downloadManagedDocx}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-4-4 4 4 4-4M4 17v3h16v-3"/></svg></button>
    <button className="daily-action daily-edit" type="button" aria-label="Email update" title={editingStories ? 'Save edits before emailing' : 'Copy formatted update and open your email app; paste into the message body'} disabled={!selectedArticles.length || editingStories} onClick={emailManagedUpdate}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5.5h18v13H3z"/><path d="m3 6 9 7 9-7"/></svg></button>
    <button className="daily-action daily-edit" type="button" aria-label="Export spreadsheet" title={editingStories ? 'Save edits before exporting' : 'Export visible full articles to spreadsheet'} disabled={!selectedArticles.length || editingStories || exportingSheet} onClick={exportSpreadsheet}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M10 9v11M16 9v11"/></svg></button>
    <button className="daily-action daily-edit daily-search-toggle" type="button" aria-label="Search update" title="Search within the update" aria-expanded={updateSearchOpen} onClick={() => setUpdateSearchOpen(current => !current)}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.6"/><path d="m16 16 5 5"/></svg></button>
  </div>;
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
    scrollReportTo(target, 12);
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
    return { key: `${dropKind}:${sectionId}:${subsection}:${country}`, destination: { sectionId, subsection, country } };
  };
  const startStoryDrag = (event, storyId) => {
    if (!editingStories || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerDragRef.current = { storyId, x: event.clientX, y: event.clientY, started: false };
  };
  const moveStoryDrag = event => {
    const drag = pointerDragRef.current;
    if (!drag) return;
    if (!drag.started && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6) return;
    drag.started = true;
    event.preventDefault();
    const hit = dropAtPoint(event.clientX, event.clientY, drag.storyId);
    setDropTarget(hit?.key || '');
    const scroller = document.querySelector('.daily-scroll');
    if (scroller) {
      if (getComputedStyle(scroller).overflowY === 'visible') {
        if (event.clientY < 48) window.scrollBy(0, -18);
        else if (event.clientY > window.innerHeight - 48) window.scrollBy(0, 18);
        return;
      }
      const box = scroller.getBoundingClientRect();
      if (event.clientY < box.top + 48) scroller.scrollTop -= 18;
      else if (event.clientY > box.bottom - 48) scroller.scrollTop += 18;
    }
  };
  const finishStoryDrag = event => {
    const drag = pointerDragRef.current;
    pointerDragRef.current = null;
    setDropTarget('');
    if (!drag?.started) return;
    const hit = dropAtPoint(event.clientX, event.clientY, drag.storyId);
    if (hit) relocateStory(drag.storyId, hit.destination);
  };
  const loadNativeDraft = useCallback(async providedEdition => {
    let edition = providedEdition?.articles ? providedEdition : null;
    if (!edition) {
      const response = await fetch(apiUrl('/api/daily-update'), { cache: 'no-store' });
      if (!response.ok) return;
      edition = await response.json();
    }
    setNativeDraftMode(true);
    setDaily(edition);
    setSiteConfig(current => ({ ...extendSiteConfigForImportedPlacements(current, edition.articles), leadOrigins: { ...current.leadOrigins, ...(edition.leadOrigins || {}) } }));
    setCompiledAt(edition.checkedAt);
    setStaticPreview(false);
    setSaveStatus('Draft only · not published');
  }, []);
  const collectionPanel = <NativeCollection onEditionReady={loadNativeDraft} draftMode={nativeDraftMode} onReturn={() => window.location.reload()}/>;

  return <div className="app-shell" data-mode={siteConfig.darkMode ? 'dark' : 'light'} style={themeStyle}>
    <header className="topbar"><div className="brand-text"><strong>{siteConfig.brandName}</strong><small>{siteConfig.brandTagline}</small></div><span className="topbar-spacer"/><button className="mode-button" aria-pressed={siteConfig.darkMode} onClick={() => setSiteConfig(current => ({ ...current, darkMode: !current.darkMode }))}>{siteConfig.darkMode ? '☀ Light mode' : '☾ Dark mode'}</button><button className="mode-button login-button" type="button" onClick={async () => {
      if (isEditor) { await sharedClient.auth.signOut(); setEditorUser(null); setManaging(false); setEditingStories(false); }
      else setLoginOpen(true);
    }}>{isEditor ? 'Log out' : 'Log in'}</button>{managementEnabled && <button className="manage-button" onClick={() => { setManagerTab('Content'); setManaging(true); }}>⚙ Manage site</button>}{isEditor && saveStatus && <span className="shared-save-status" role="status">{saveStatus}</span>}</header>
    {sharedError && <div className="shared-warning" role="alert">{sharedError}</div>}
    <div className={`workspace ${siteConfig.showSources ? '' : 'no-sidebar'}`}>
      {siteConfig.showSources && <aside className="sidebar">
        <div className="sidebar-heading"><h2>Sources <em>{sources.length}</em></h2></div>
        <label className="search-box"><span>⌕</span><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources" aria-label="Search sources"/><kbd>⌘ K</kbd></label>
        <select className="group-select" value={group} onChange={e => setGroup(e.target.value)} aria-label="Filter source region">{groups.map(x => <option key={x}>{x}</option>)}</select>
        <div className="source-list">{visibleSources.map(x => <button key={x.id} className={`source-row ${websiteSourceId === x.id ? 'active' : ''}`} onClick={() => { setWebsiteSourceId(x.id); }} aria-label={`Show ${x.name} website beside the daily news update`}><span className="source-icon">{x.name[0]}</span><span className="source-copy"><strong>{x.name}</strong></span><span className="source-arrow">›</span></button>)}{!visibleSources.length && <p className="no-sources">No sources match this search.</p>}</div>
        <div className="sidebar-foot"><span className="pulse"/> {sources.length} visible sources</div>
      </aside>}
      <main className={`main-panel ${websiteSource ? 'with-website' : ''}`}>
        <div className={`reading-layout ${websiteSource ? 'website-open' : ''}`}>
        {siteConfig.showUpdate && <section className={`daily-update ${siteConfig.sectionHeadingUppercase ? 'uppercase-headings' : ''} ${headlineOnly && !editingStories ? 'headline-only' : ''}`} aria-labelledby="daily-update-title">
          <div className="daily-heading"><div className="daily-heading-main"><div className="daily-title-row"><h2 id="daily-update-title">{siteConfig.updateTitle}</h2><p className="report-date" aria-label={reportEndDateLabel(compiledAt)}><span className="date-full">{reportEndDateLabel(compiledAt)}</span><span className="date-short" aria-hidden="true">{reportShortDateLabel(compiledAt)}</span></p></div>{updateControls()}</div>{updateSearchOpen && <div className="update-search" role="search" aria-label="Search update"><input autoFocus type="search" value={updateSearchText} onChange={event => setUpdateSearchText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setUpdateSearchOpen(false); if (event.key === 'Enter' && updateSearchResults.length) { event.preventDefault(); setActiveSearchResult(current => (current + (event.shiftKey ? -1 : 1) + updateSearchResults.length) % updateSearchResults.length); } }} placeholder="Find text in update" aria-label="Find text in update"/>{updateSearchQuery && <span role="status">{updateSearchResults.length ? `${Math.min(activeSearchResult + 1, updateSearchResults.length)} of ${updateSearchResults.length} stories` : 'No matches'}</span>}<button type="button" aria-label="Previous match" disabled={!updateSearchResults.length} onClick={() => setActiveSearchResult(current => (current - 1 + updateSearchResults.length) % updateSearchResults.length)}>↑</button><button type="button" aria-label="Next match" disabled={!updateSearchResults.length} onClick={() => setActiveSearchResult(current => (current + 1) % updateSearchResults.length)}>↓</button><button type="button" aria-label="Close search" onClick={() => setUpdateSearchOpen(false)}>×</button></div>}{dailySections.length > 0 && <nav className="daily-section-nav" aria-label="Update sections" style={{ '--section-count': Math.min(dailySections.length, 6) }}>{dailySections.map(({ section }, index) => <a key={section} href={`#daily-section-${index}`} aria-label={section} title={section} onClick={event => jumpToSection(event, index)}><span className="section-label-full" aria-hidden="true">{section}</span><span className="section-label-compact" aria-hidden="true">{compactSectionLabels[section] || section}</span></a>)}</nav>}</div>
          {daily && <div className="daily-scroll" role="region" aria-label="Daily update stories" tabIndex={0}>
            {dailySections.map(({ sectionId, section, subsections }, sectionIndex) => <div className={`daily-section ${sectionId === 'Lead stories' ? 'lead-section' : ''}`} id={`daily-section-${sectionIndex}`} key={sectionId}>
              <h3 data-drop-kind="section" data-section-id={sectionId} className={dropTarget === `section:${sectionId}::` ? 'story-drop-target' : ''}>{highlightSearch(section)}</h3>
              {subsections.map(([subsection, items]) => <div key={subsection || 'direct'}>
                {subsection && <h4 data-drop-kind="subsection" data-section-id={sectionId} data-subsection={subsection} className={`${section === 'Miscellaneous' ? 'plain-topic topic-heading' : sectionId === 'Lead stories' && subsection === 'Middle East' ? 'topic-heading' : ''} ${dropTarget === `subsection:${sectionId}:${subsection}:` ? 'story-drop-target' : ''}`}>{highlightSearch(reportHeadingLabel(subsection))}</h4>}
                {items.map((item, index) => <React.Fragment key={item.id}>
                  {item.country && (index === 0 || items[index - 1].country !== item.country) && <h5 data-drop-kind="country" data-section-id={sectionId} data-subsection={subsection} data-country={item.country} className={`daily-country ${dropTarget === `country:${sectionId}:${subsection}:${item.country}` ? 'story-drop-target' : ''}`}>{highlightSearch(reportHeadingLabel(item.country))}</h5>}
                  <article data-drop-kind="story" data-section-id={item.sectionId} data-subsection={item.subsection || ''} data-country={item.country || ''} data-story-id={item.id} className={`daily-story ${editingStories ? 'daily-story-editing' : ''} ${updateSearchOpen && updateSearchIds.has(item.id) ? 'search-match' : ''} ${updateSearchOpen && updateSearchResults[Math.min(activeSearchResult, updateSearchResults.length - 1)]?.id === item.id ? 'active-search-match' : ''} ${dropTarget === `story:${item.id}:before` ? 'story-drop-before' : ''} ${dropTarget === `story:${item.id}:after` ? 'story-drop-after' : ''}`}>
                    {editingStories && <div className="story-edit-tools">
                      <button type="button" className="story-drag-handle" aria-label={`Drag story: ${item.title}`} title="Drag to another visible heading or story" onPointerDown={event => startStoryDrag(event, item.id)} onPointerMove={moveStoryDrag} onPointerUp={finishStoryDrag} onPointerCancel={() => { pointerDragRef.current = null; setDropTarget(''); }}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="6" r="1.6"/><circle cx="12" cy="6" r="1.6"/><circle cx="18" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><circle cx="12" cy="18" r="1.6"/><circle cx="18" cy="18" r="1.6"/></svg></button>
                      <button type="button" className="story-move-button" aria-label={`Move story: ${item.title}`} title="Move to another section, country or organisation" onClick={() => setMoveStoryId(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h15m-5-5 5 5-5 5"/></svg></button>
                      <button type="button" className={`story-star-button ${item.sectionId === 'Lead stories' ? 'is-lead' : ''}`} aria-label={`${item.sectionId === 'Lead stories' ? 'Remove from' : 'Add to'} lead stories: ${item.title}`} aria-pressed={item.sectionId === 'Lead stories'} title={item.sectionId === 'Lead stories' ? 'Return to original country' : 'Make lead story'} onClick={() => toggleLeadStory(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/></svg></button>
                      <button type="button" className="story-delete-button" aria-label={`Delete story: ${item.title}`} title="Delete story from the update" onClick={() => deleteStory(item.id)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg></button>
                    </div>}
                    <div className="daily-story-content">{editingStories ? <p className={`daily-story-inline-edit origin-${storyOrigin(item)}`} title={`Story source: ${storyOrigin(item) === "other" ? "unknown source" : storyOrigin(item)}`}><span className="story-origin-highlight"><strong contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit headline" data-edit-field="title" onKeyDown={keepStoryTextInline}>{reportStoryText(item, headlineOnly).headline}</strong>{' '}<span contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit summary" data-edit-field="summary" data-placeholder="Add summary" onKeyDown={keepStoryTextInline}>{reportStoryText(item).summary}</span>{' '}(<span contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit agency" data-edit-field="sourceName" onKeyDown={keepStoryTextInline}>{item.sourceName}</span>){' '}<time className="daily-story-date" dateTime={item.publishedAt || ''} contentEditable suppressContentEditableWarning role="textbox" aria-label="Edit article date" data-edit-field="publishedAt" data-placeholder="14 Oct 26" onKeyDown={keepStoryTextInline}>{Number.isFinite(Date.parse(item.publishedAt)) ? reportShortDateLabel(item.publishedAt) : ''}</time></span></p> : <p><strong>{highlightSearch(reportStoryText(item, headlineOnly).headline)}</strong>{!headlineOnly && item.summary && <> {highlightSearch(reportStoryText(item).summary)}</>} (<a href={item.url} target="_blank" rel="noopener noreferrer">{highlightSearch(item.sourceName)}</a>){Number.isFinite(Date.parse(item.publishedAt)) && <> <time className="daily-story-date" dateTime={item.publishedAt}>{highlightSearch(reportShortDateLabel(item.publishedAt))}</time></>}</p>}{duplicateMatches.has(item.id) && <span className="story-duplicate-flag" style={{ '--duplicate-hue': duplicateGroupHue(duplicateMatches.get(item.id).number) }} title={duplicateMatches.get(item.id).matches.map(other => `${other.sourceName}: ${other.title}`).join('\n')}>Possible duplicate · Group {duplicateMatches.get(item.id).number} · {duplicateMatches.get(item.id).matches.map(other => other.sourceName).join(', ')}</span>}</div>
                  </article>
                </React.Fragment>)}
              </div>)}
            </div>)}
            {!readingArticles.length && <p className="daily-empty">{displayedArticles.length ? isEditor ? 'No stories are selected. Press Edit to choose stories for this update.' : 'No stories are selected for this update.' : isEditor ? 'No stories yet. Press Import spreadsheet to populate the update.' : 'No stories have been published yet.'}</p>}
            {selectedArticles.length > 0 && <div className="daily-disclaimer"><p><strong>Disclaimer:</strong> {disclaimerFirst}</p><p>{disclaimerSecond}</p></div>}
            {siteConfig.showCoverage && coverageNote && selectedArticles.length > 0 && <p className="daily-coverage">{coverageNote}</p>}
          </div>}
        </section>}
        {websiteSource && <section className="website-panel" aria-label={`${websiteSource.name} website`}><div className="website-panel-heading"><div><span className="eyebrow">SOURCE WEBSITE</span><h2>{websiteSource.name}</h2></div><button onClick={() => setWebsiteSourceId('')} aria-label="Close source website">×</button></div><div className="website-panel-actions"><a href={websiteSource.url} target="_blank" rel="noopener noreferrer">Open website in new tab ↗</a></div><p>{isEditor ? 'To add an article, copy its link address, then paste it into Add.' : 'Some publishers block display here; use the link above if this panel stays blank.'}</p><iframe key={websiteSource.id} src={websiteSource.url} title={`${websiteSource.name} website`} referrerPolicy="no-referrer" loading="lazy"/></section>}
        </div>

      </main>
    </div>{toast && <div className={`toast ${toast.startsWith('Not published:') ? 'toast-error' : toast.includes('Publishing for everyone…') ? 'toast-pending' : ''}`} role={toast.startsWith('Not published:') ? 'alert' : 'status'} onClick={() => setToast('')}>{toast} ×</div>}
    {isEditor && !scrapingOpen && (scrapeStatus?.state === 'running' || (scrapeStatus?.state === 'complete' && Date.now() - Date.parse(scrapeStatus.updatedAt) < 15 * 60_000)) && <button type="button" className="scrape-live-status" role="status" onClick={() => { if (githubCollectionMode && scrapeStatus.state === 'complete') fetchGithubDraft().then(loadNativeDraft).catch(error => setToast(error.message)); else if (scrapeStatus.state === 'complete') loadNativeDraft(); else setScrapingOpen(true); }}><strong>{scrapeStatus.state === 'complete' ? 'Scrape complete' : 'Scraping news'}</strong><span>{scrapeStatus.message}</span>{scrapeStatus.state === 'running' && scrapeStatus.total > 0 && <progress value={scrapeStatus.completed || 0} max={scrapeStatus.total} aria-label="Scraping progress"/>}<small>{scrapeStatus.state === 'complete' ? 'Review draft' : scrapeStatus.total > 0 ? `${scrapeStatus.completed || 0} of ${scrapeStatus.total}` : 'Open progress'}</small></button>}
    {spreadsheetResults && <div className="add-backdrop" onClick={() => setSpreadsheetResults(null)}><section className="add-dialog spreadsheet-results" role="dialog" aria-modal="true" aria-labelledby="spreadsheet-results-title" onClick={event => event.stopPropagation()}><div className="add-dialog-heading"><h2 id="spreadsheet-results-title">Spreadsheet export results</h2><button type="button" aria-label="Close export results" onClick={() => setSpreadsheetResults(null)}>×</button></div><p>{spreadsheetResults.downloaded ? `Downloaded ${spreadsheetResults.exported} of ${spreadsheetResults.attempted} visible full articles.` : `No spreadsheet downloaded. ${spreadsheetResults.exported} of ${spreadsheetResults.attempted} articles available.`}</p>{spreadsheetResults.error && <p role="alert">{spreadsheetResults.error}</p>}{spreadsheetResults.failures.length > 0 && <><h3>{spreadsheetResults.failures.length} unavailable</h3><ul>{spreadsheetResults.failures.map((failure, index) => <li key={index}>{failure}</li>)}</ul></>}<div className="add-dialog-actions"><button type="button" onClick={() => setSpreadsheetResults(null)}>Close</button></div></section></div>}
    {managementEnabled && managing && <SiteManager initialTab={managerTab} collectionPanel={collectionPanel} config={siteConfig} setConfig={setSiteConfig} articles={daily?.articles ?? preparedUpdate.articles} baseSources={config?.sources ?? []} includeText={includeText} setIncludeText={setIncludeText} excludeText={setExcludeText} setExcludeText={setExcludeText} applyScope={applyScope} onClose={() => setManaging(false)} onReset={() => setSiteConfig(defaultSiteConfig(daily?.articles ?? preparedUpdate.articles))}/>}
    {isEditor && scrapingOpen && <div className="add-backdrop" onClick={() => setScrapingOpen(false)}><section className="add-dialog add-article-dialog" role="dialog" aria-modal="true" aria-labelledby="scrape-dialog-title" onClick={event => event.stopPropagation()}><div className="add-dialog-heading"><h2 id="scrape-dialog-title">Scrape news</h2><button type="button" aria-label="Close scrape status" onClick={() => setScrapingOpen(false)}>×</button></div><NativeCollection onEditionReady={loadNativeDraft} draftMode={nativeDraftMode} onReturn={() => window.location.reload()} autoStart/></section></div>}
    {isEditor && addingArticles && daily && <AddArticlesDialog sections={siteConfig.sections} sources={configuredSources} customCountries={siteConfig.customCountries} existingArticles={selectedArticles} remainingSlots={100 - siteConfig.customArticles.length} onAdd={async (article, placement, body) => { if (body?.body) { try { await storeArticleBodies([body]); } catch (error) { if (!sharedEnabled) throw error; } if (sharedEnabled) { const prior = pendingBodiesRef.current?.bodies || []; pendingBodiesRef.current = { replace: false, bodies: [...new Map([...prior, body].map(item => [item.url, item])).values()] }; } } setSiteConfig(current => addCustomArticleInConfig(current, article, placement)); setCompiledAt(new Date().toISOString()); }} onClose={() => setAddingArticles(false)}/>}
    {isEditor && importingSpreadsheet && <ImportSpreadsheetDialog sections={siteConfig.sections} customCountries={siteConfig.customCountries} existingArticles={[...archivedImportReference.articles, ...preparedUpdate.articles, ...(daily?.articles ?? [])]} sources={configuredSources} importedMode={importedMode} sharedMode={sharedEnabled} publishedEmpty={preparedUpdate.emptyPrepared === true} hasStories={Boolean((daily?.articles.length || 0) + (siteConfig.customArticles?.length || 0))} onImport={importSpreadsheet} onRestore={restorePublishedUpdate} onClear={clearCurrentUpdate} onClose={() => setImportingSpreadsheet(false)}/>}
    {isEditor && editingStories && storyToMove && <MoveStoryDialog story={storyToMove} sections={siteConfig.sections} articles={displayedArticles} customCountries={siteConfig.customCountries} onMove={moveStory} onClose={() => setMoveStoryId('')}/>}
    {loginOpen && <EditorLoginDialog onLogin={user => { setEditorUser(user); setLoginOpen(false); }} onClose={() => setLoginOpen(false)}/>}
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
