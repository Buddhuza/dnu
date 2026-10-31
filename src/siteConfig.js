import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES, orderedSubsections, leadRegionalHeadings, compareCountryLabels, isSouthEasternEuropeRegionalStory, isMontenegroCroatiaDialogueStory, isLithuanianBalticStory, isGreekPrimeMinisterStory } from './newsSections.js';
import { blockedPlacementReason, directGovernmentPublicationReason } from './sourcePolicy.js';
import { excludedHeadlineReason } from './headlinePolicy.js';
import { displaySourceName } from './sourceNames.js';
import { articlePlacement } from '../server/importArticle.js';

export const THEME_PRESETS = {
  forest: { name: 'Forest', primary: '#123e47', accent: '#bce081', background: '#f4efe6', surface: '#fdfaf4', text: '#182a36', section: '#0070c0', font: 'DM Sans' },
  blue: { name: 'OSCE blue', primary: '#183b65', accent: '#c6dcf2', background: '#f4f7fb', surface: '#ffffff', text: '#1b2d42', section: '#0070c0', font: 'DM Sans' },
  slate: { name: 'Slate', primary: '#263340', accent: '#d7e1e9', background: '#f2f4f6', surface: '#ffffff', text: '#1f2d38', section: '#465e78', font: 'Manrope' },
  warm: { name: 'Warm', primary: '#5b3b32', accent: '#f3d4a4', background: '#fbf7f1', surface: '#ffffff', text: '#3d302a', section: '#9b5834', font: 'Georgia' }
};

export const DARK_THEME = { name: 'Dark', primary: '#172f3a', accent: '#c6e690', background: '#101a20', surface: '#1c2a32', text: '#eaf1ef', section: '#8ec7ee', font: 'DM Sans' };

const defaults = {
  version: 1,
  brandName: 'SITUATION ROOM',
  brandTagline: 'NEWS MONITORING WORKSPACE',
  updateTitle: 'DAILY NEWS UPDATE',
  coverageText: '',
  showCoverage: true,
  showSources: true,
  showUpdate: true,
  showScope: true,
  showLatest: true,
  darkMode: false,
  fontSize: 18,
  sectionHeadingSize: 26,
  sectionHeadingUppercase: true,
  updateWidth: 900,
  theme: THEME_PRESETS.forest,
  darkTheme: DARK_THEME,
  sections: [],
  articleEdits: {},
  articleOrder: [],
  leadOrigins: {},
  customCountries: {},
  customArticles: [],
  customSources: [],
  sourceListingOverrides: {},
  hiddenSourceIds: []
};

const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
const clean = (value, fallback = '', limit = 240) => typeof value === 'string' ? value.slice(0, limit) : fallback;
const httpsUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
};

export function defaultSiteConfig(articles = []) {
  const names = [...new Set(articles.map(item => item.section).filter(Boolean))].filter(name => name !== 'International organisations');
  const sections = NEWS_SECTIONS.map(section => ({ ...section, name: section.id, visible: true, subsections: [...section.subsections] }));
  for (const name of names) if (!sections.some(section => section.id === name)) sections.push({ id: name, name, visible: true, subsections: [] });
  return { ...defaults, theme: { ...THEME_PRESETS.forest }, darkTheme: { ...DARK_THEME }, sections };
}

export function normalizeSiteConfig(input, articles = []) {
  const base = defaultSiteConfig(articles);
  if (!input || typeof input !== 'object' || input.version !== 1) return base;
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  const seen = new Set();
  const sections = rawSections.slice(0, 40).flatMap(item => {
    const id = clean(item?.id, '', 80).trim();
    if (!id || id === 'International organisations' || seen.has(id)) return [];
    seen.add(id);
    const standard = NEWS_SECTIONS.find(section => section.id === id);
    const subsections = Array.isArray(item?.subsections)
      ? [...new Set(item.subsections.map(value => clean(value, '', 100).trim()).filter(Boolean))].slice(0, 40)
      : [...(standard?.subsections ?? [])];
    return [{ id, name: clean(item?.name, id, 80).trim() || id, visible: item?.visible !== false, subsections: id === 'Lead stories' ? subsections.map(value => value === 'Middle East / North Africa' ? 'Middle East' : value) : subsections }];
  });
  for (const section of base.sections) if (!seen.has(section.id)) sections.push(section);
  const sectionIds = new Set(sections.map(item => item.id));
  const parseTheme = (raw, fallback) => ({
    name: clean(raw?.name, fallback.name, 40),
    primary: color(raw?.primary, fallback.primary),
    accent: color(raw?.accent, fallback.accent),
    background: color(raw?.background, fallback.background),
    surface: color(raw?.surface, fallback.surface),
    text: color(raw?.text, fallback.text),
    section: color(raw?.section, fallback.section),
    font: ['DM Sans', 'Manrope', 'Georgia'].includes(raw?.font) ? raw.font : fallback.font
  });
  const theme = parseTheme(input.theme, base.theme);
  if (theme.name === 'Forest' && theme.background === '#f7f8f6' && theme.surface === '#ffffff') {
    theme.background = base.theme.background;
    theme.surface = base.theme.surface;
  }
  const darkTheme = parseTheme(input.darkTheme, base.darkTheme);
  const articleEdits = Object.create(null);
  if (input.articleEdits && typeof input.articleEdits === 'object' && !Array.isArray(input.articleEdits)) {
    for (const [id, edit] of Object.entries(input.articleEdits).slice(0, 500)) {
      if (!edit || typeof edit !== 'object') continue;
      const legacyOrganisations = edit.sectionId === 'International organisations';
      articleEdits[id] = {
        title: clean(edit.title, '', 400),
        summary: clean(edit.summary, '', 1200),
        summaryEdited: edit.summaryEdited === true,
        sourceName: clean(edit.sourceName, '', 100),
        subsection: legacyOrganisations ? 'INTERNATIONAL ORGANISATIONS' : edit.sectionId === 'Lead stories' && edit.subsection === 'Middle East / North Africa' ? 'Middle East' : clean(edit.subsection, '', 100),
        country: clean(edit.country, '', 100),
        sectionId: legacyOrganisations ? 'Miscellaneous' : sectionIds.has(edit.sectionId) ? edit.sectionId : '',
        hidden: edit.hidden === true
      };
    }
  }
  const customArticles = (Array.isArray(input.customArticles) ? input.customArticles : []).slice(0, 100).flatMap(item => {
    const url = httpsUrl(item?.url);
    const title = clean(item?.title, '', 400).trim();
    if (!url || !title) return [];
    const legacyOrganisations = item.sectionId === 'International organisations';
    return [{
      id: clean(item.id, `manual-${url}`, 500), url,
      sourceId: 'manual', sourceName: clean(item.sourceName, 'Manual entry', 100),
      title, summary: clean(item.summary, '', 1200),
      translated: item.translated === true,
      originalHeadline: clean(item.originalHeadline, '', 400),
      publishedAt: Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
      timeSource: ['page', 'inferred', 'current'].includes(item.timeSource) ? item.timeSource : 'page',
      sectionId: legacyOrganisations ? 'Miscellaneous' : sectionIds.has(item.sectionId) ? item.sectionId : sections[0]?.id || 'Miscellaneous',
      subsection: legacyOrganisations ? 'INTERNATIONAL ORGANISATIONS' : item.sectionId === 'Lead stories' && item.subsection === 'Middle East / North Africa' ? 'Middle East' : clean(item.subsection, '', 100),
      country: clean(item.country, '', 100),
      hidden: item.hidden === true, reviewed: true
    }];
  });
  const customSources = (Array.isArray(input.customSources) ? input.customSources : []).slice(0, 100).flatMap(item => {
    const url = httpsUrl(item?.url);
    const name = clean(item?.name, '', 80).trim();
    const id = clean(item?.id, '', 120);
    if (!url || !name || !/^manual-source-[a-zA-Z0-9-]{1,100}$/.test(id)) return [];
    return [{
      id,
      name, group: clean(item.group, 'Custom', 80).trim() || 'Custom', url
    }];
  });
  const sourceListingOverrides = Object.fromEntries(Object.entries(input.sourceListingOverrides && typeof input.sourceListingOverrides === 'object' ? input.sourceListingOverrides : {}).slice(0, 200).flatMap(([id, value]) => {
    const url = httpsUrl(value);
    return /^source-\d+$/.test(id) && url ? [[id, url]] : [];
  }));
  const customCountries = Object.fromEntries(Object.entries(input.customCountries && typeof input.customCountries === 'object' && !Array.isArray(input.customCountries) ? input.customCountries : {}).slice(0, 40).flatMap(([subsection, values]) => {
    const label = clean(subsection, '', 100).trim();
    if (!label || !Array.isArray(values)) return [];
    const countries = [...new Set(values.map(value => clean(value, '', 100).trim()).filter(Boolean))].slice(0, 100);
    return countries.length ? [[label, countries]] : [];
  }));
  const leadOrigins = Object.fromEntries(Object.entries(input.leadOrigins && typeof input.leadOrigins === 'object' && !Array.isArray(input.leadOrigins) ? input.leadOrigins : {}).slice(0, 500).flatMap(([id, place]) => {
    if (!id || id.length > 500 || !place || !sectionIds.has(place.sectionId) || place.sectionId === 'Lead stories') return [];
    return [[id, { sectionId: place.sectionId, subsection: clean(place.subsection, '', 100), country: clean(place.country, '', 100) }]];
  }));
  return {
    version: 1,
    brandName: ['SIGNAL DESK', 'DNU'].includes(input.brandName) ? base.brandName : clean(input.brandName, base.brandName, 80),
    brandTagline: clean(input.brandTagline, base.brandTagline, 100),
    updateTitle: /^Daily news update(?:\s*[—,]\s*.+)?$/i.test(input.updateTitle ?? '') ? base.updateTitle : clean(input.updateTitle, base.updateTitle, 100),
    coverageText: clean(input.coverageText, '', 600),
    showCoverage: input.showCoverage !== false,
    showSources: input.showSources !== false,
    showUpdate: input.showUpdate !== false,
    showScope: input.showScope !== false,
    showLatest: input.showLatest !== false,
    darkMode: input.darkMode === true,
    fontSize: Number.isFinite(Number(input.fontSize)) ? Math.max(14, Math.min(24, Number(input.fontSize))) : 18,
    sectionHeadingSize: Number.isFinite(Number(input.sectionHeadingSize)) ? Math.max(20, Math.min(40, Number(input.sectionHeadingSize))) : 26,
    sectionHeadingUppercase: input.sectionHeadingUppercase !== false,
    updateWidth: Number.isFinite(Number(input.updateWidth)) ? Math.max(480, Math.min(1400, Number(input.updateWidth) === 600 ? 900 : Number(input.updateWidth))) : 900,
    theme, darkTheme, sections, articleEdits, leadOrigins,
    articleOrder: [...new Set((Array.isArray(input.articleOrder) ? input.articleOrder : []).filter(id => typeof id === 'string' && id.length <= 500))].slice(0, 1000),
    customArticles, customSources, sourceListingOverrides, customCountries,
    hiddenSourceIds: (Array.isArray(input.hiddenSourceIds) ? input.hiddenSourceIds : []).filter(id => typeof id === 'string').slice(0, 500)
  };
}

export function displaySources(baseSources, config) {
  const hidden = new Set(config.hiddenSourceIds);
  return [...baseSources.map(source => {
    const alternate = config.sourceListingOverrides?.[source.id];
    try {
    if (alternate && new URL(alternate).origin === new URL(source.url).origin) return { ...source, name: displaySourceName(source.name), listingUrl: alternate };
    } catch { /* Ignore an invalid local override. */ }
    return { ...source, name: displaySourceName(source.name) };
  }), ...config.customSources.map(source => ({ ...source, name: displaySourceName(source.name) }))].filter(source => !hidden.has(source.id));
}

export function displaySiteContent(articles, config, excludedIds = new Set(), keepImportedStories = false) {
  const sectionById = new Map(config.sections.map(section => [section.id, section]));
  const regionalSectionIds = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
  const items = [];
  for (const article of articles) {
    const edit = config.articleEdits[article.id];
    const legacyOrganisations = article.section === 'International organisations' || (article.section === 'Lead stories' && article.subsection === 'International organisations');
    const sectionId = edit?.sectionId || (legacyOrganisations ? 'Miscellaneous' : article.sectionId || article.section);
    if (edit?.hidden || sectionById.get(sectionId)?.visible === false) continue;
    const displayed = {
      ...article,
      title: edit?.title?.trim() || article.title,
      summary: edit?.summaryEdited ? edit.summary : edit?.summary?.trim() || article.summary,
      sourceName: displaySourceName(edit?.sourceName?.trim() || article.sourceName),
      section: sectionById.get(sectionId)?.name || sectionId,
      sectionId,
      subsection: edit?.sectionId ? edit.subsection : edit?.subsection || (legacyOrganisations ? 'INTERNATIONAL ORGANISATIONS' : article.subsection),
      country: edit?.sectionId ? edit.country : edit?.country || article.country || ''
    };
    if (article.fromSpreadsheet && !edit?.sectionId && isGreekPrimeMinisterStory(displayed.title)) {
      displayed.sectionId = 'Miscellaneous';
      displayed.section = sectionById.get(displayed.sectionId)?.name || displayed.sectionId;
      displayed.subsection = 'WESTERN / CENTRAL EUROPE';
      displayed.country = 'Greece';
    } else if (article.fromSpreadsheet && !edit?.sectionId && isSouthEasternEuropeRegionalStory(displayed.title)) {
      displayed.sectionId = 'South Eastern Europe';
      displayed.section = sectionById.get(displayed.sectionId)?.name || displayed.sectionId;
      displayed.subsection = '';
      displayed.country = '';
    } else if (article.fromSpreadsheet && !edit?.sectionId && isMontenegroCroatiaDialogueStory(displayed.title, displayed.sourceName)) {
      displayed.sectionId = 'South Eastern Europe';
      displayed.section = sectionById.get(displayed.sectionId)?.name || displayed.sectionId;
      displayed.subsection = 'Montenegro';
      displayed.country = '';
    } else if (article.fromSpreadsheet && !edit?.sectionId && isLithuanianBalticStory(displayed.title, displayed.summary, displayed.sourceName)) {
      displayed.sectionId = 'Miscellaneous';
      displayed.section = sectionById.get(displayed.sectionId)?.name || displayed.sectionId;
      displayed.subsection = 'WESTERN / CENTRAL EUROPE';
      displayed.country = 'Lithuania';
    } else if (article.fromSpreadsheet && !edit?.sectionId && regionalSectionIds.has(displayed.sectionId)) {
      const inferred = articlePlacement({}, displayed.title, '');
      const namedLocation = inferred && (regionalSectionIds.has(inferred.sectionId) ||
        inferred.sectionId === 'Miscellaneous' && inferred.subsection !== 'INTERNATIONAL ORGANISATIONS');
      if (namedLocation && (inferred.sectionId !== displayed.sectionId || inferred.subsection !== displayed.subsection)) {
        displayed.sectionId = inferred.sectionId;
        displayed.section = sectionById.get(inferred.sectionId)?.name || inferred.sectionId;
        displayed.subsection = inferred.subsection;
        displayed.country = inferred.country;
      }
    }
    if (!directGovernmentPublicationReason(displayed) && !blockedPlacementReason(displayed) && !excludedHeadlineReason(displayed.title, displayed.summary, displayed.url)) items.push(displayed);
  }
  for (const article of config.customArticles) {
    if (article.hidden || sectionById.get(article.sectionId)?.visible === false) continue;
    if (!directGovernmentPublicationReason(article) && !blockedPlacementReason(article) && !excludedHeadlineReason(article.title, article.summary, article.url)) items.push({ ...article, sourceName: displaySourceName(article.sourceName), section: sectionById.get(article.sectionId)?.name || article.sectionId });
  }
  const uniqueItems = keepImportedStories || articles.some(article => article.fromSpreadsheet) ? items : deduplicateArticles(items, excludedIds);
  const order = new Map(config.sections.map((section, index) => [section.id, index]));
  const articleOrder = new Map((config.articleOrder ?? []).map((id, index) => [id, index]));
  const activeLeadHeadings = new Set(uniqueItems.filter(item => item.sectionId === 'Lead stories').map(item => item.subsection));
  const extraRegionalHeadings = leadRegionalHeadings(uniqueItems, config.leadOrigins);
  const subsectionOrder = new Map(config.sections.map(section => {
    const labels = section.id === 'Lead stories' ? activeLeadHeadings : [
      ...(section.subsections ?? []),
      ...(uniqueItems.some(item => item.sectionId === section.id && !item.subsection) ? [''] : [])
    ];
    return [section.id, new Map(orderedSubsections(section, labels, extraRegionalHeadings).map((name, index) => [name, index]))];
  }));
  const alphabetical = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true });
  return uniqueItems.sort((a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999)
    || (subsectionOrder.get(a.sectionId)?.get(a.subsection) ?? 999) - (subsectionOrder.get(b.sectionId)?.get(b.subsection) ?? 999)
    || compareCountryLabels(a.subsection, a.country || '', b.country || '')
    || (articleOrder.get(a.id) ?? 9999) - (articleOrder.get(b.id) ?? 9999));
}

export function addCustomArticleInConfig(config, article, { createSubsection = false, createCountry = false } = {}) {
  const section = config.sections.find(item => item.id === article.sectionId && item.visible);
  const subsection = String(article.subsection || '').trim().slice(0, 100);
  const country = article.sectionId === 'Miscellaneous' ? String(article.country || '').trim().slice(0, 100) : '';
  if (!section || !subsection || (article.sectionId === 'Miscellaneous' && !country) ||
    (section.id === 'Lead stories' && !section.subsections.includes(subsection)) ||
    (!section.subsections.includes(subsection) && !createSubsection) ||
    blockedPlacementReason(article, { sectionId: section.id, subsection, country }) ||
    config.customArticles.some(item => canonicalArticleUrl(item.url) === canonicalArticleUrl(article.url))) return config;
  const alphabetical = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true });
  const sections = !section.subsections.includes(subsection)
    ? config.sections.map(item => item.id === section.id ? { ...item, subsections: [...item.subsections, subsection].sort(alphabetical.compare) } : item)
    : config.sections;
  const knownCountries = [...(MISCELLANEOUS_COUNTRIES[subsection] || []), ...(config.customCountries?.[subsection] || [])];
  if (country && !knownCountries.includes(country) && !createCountry) return config;
  const customCountries = country && !knownCountries.includes(country)
    ? { ...config.customCountries, [subsection]: [...(config.customCountries?.[subsection] || []), country].sort(alphabetical.compare) }
    : config.customCountries;
  return { ...config, sections, customCountries, customArticles: [...config.customArticles, { ...article, subsection, country }] };
}

export function clearCustomArticlesInConfig(config) {
  if (!config.customArticles.length) return config;
  const removed = new Set(config.customArticles.map(article => article.id));
  return {
    ...config,
    customArticles: [],
    articleOrder: config.articleOrder.filter(id => !removed.has(id)),
    articleEdits: Object.fromEntries(Object.entries(config.articleEdits).filter(([id]) => !removed.has(id))),
    leadOrigins: Object.fromEntries(Object.entries(config.leadOrigins).filter(([id]) => !removed.has(id)))
  };
}

export function canonicalArticleUrl(value) {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(?:fbclid|gclid|mc_cid|mc_eid)$/i.test(key)) url.searchParams.delete(key);
    return `${url.hostname.replace(/^www\./, '').toLowerCase()}${url.pathname.replace(/\/$/, '')}${url.search}`;
  } catch { return ''; }
}

function headlineWords(value) {
  return [...new Set(String(value || '').toLocaleLowerCase().replace(/\s+\|\s+[^|]+$/, '').replace(/\b(?:photo|photos|video|updated)\b/gi, '').match(/[\p{L}\p{N}]+/gu) || [])];
}

const placeNames = [...new Set([
  ...NEWS_SECTIONS.filter(section => section.id !== 'Lead stories' && section.id !== 'Miscellaneous').flatMap(section => section.subsections),
  ...Object.values(MISCELLANEOUS_COUNTRIES).flat(),
  'Vietnamese', 'Kyrgyz', 'Tajik', 'Uzbek', 'Kazakh', 'Georgian', 'Armenian', 'Azerbaijani'
].map(value => value.toLocaleLowerCase()))];

function placesInHeadline(article) {
  const text = String(article.title || '').toLocaleLowerCase();
  return new Set(placeNames.filter(name => name !== String(article.country || '').toLocaleLowerCase() && new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'u').test(text)));
}

function plannedVisit(article) {
  const title = String(article.title || '');
  const actor = title.match(/\b([A-Z][\p{L}’'-]+(?:\s+[A-Z][\p{L}’'-]+)?)\s+(?:to|will|set to|expected to)\s+visit\b/u)?.[1]?.split(/\s+/).at(-1)?.toLocaleLowerCase();
  if (!actor) return null;
  const destinations = new Set([...placeNames, 'india'].filter(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'iu').test(title)));
  return destinations.size ? { actor, destinations } : null;
}

function samePlannedVisit(left, right) {
  if (!left || !right || left.actor !== right.actor) return false;
  const shared = [...left.destinations].some(place => right.destinations.has(place));
  return shared && ([...left.destinations].every(place => right.destinations.has(place)) || [...right.destinations].every(place => left.destinations.has(place)));
}

function sourcePreference(article) {
  const name = String(article.sourceName || '');
  if (/^(?:Euronews\.al|N1|Civil\.ge)$/i.test(name)) return 3;
  if (/^(?:Reuters|AP|AFP|Associated Press|BBC|DW|dpa|Euronews|Politico(?:\.eu)?|The Guardian|Guardian)$/i.test(name)) return 4;
  if (/^(?:TemA|Tanjug|1TV)$/i.test(name)) return -1;
  if (/^(?:AsiaOne|Al Jazeera|France 24|Deutsche Welle|The Independent|Financial Times)$/i.test(name)) return 1;
  return 0;
}

export function deduplicateArticles(articles, excludedIds = new Set()) {
  const details = articles.map(article => ({ url: canonicalArticleUrl(article.url), words: headlineWords(article.title), places: placesInHeadline(article), visit: plannedVisit(article) }));
  const parents = articles.map((_, index) => index);
  const root = index => { while (parents[index] !== index) index = parents[index] = parents[parents[index]]; return index; };
  for (let index = 0; index < articles.length; index++) for (let other = index + 1; other < articles.length; other++) {
    const a = articles[index], b = articles[other], left = details[index], right = details[other];
    if (left.url && left.url === right.url) { parents[root(other)] = root(index); continue; }
    const firstTime = Date.parse(a.publishedAt), secondTime = Date.parse(b.publishedAt);
    if (Number.isFinite(firstTime) && Number.isFinite(secondTime) && Math.abs(firstTime - secondTime) > 48 * 60 * 60 * 1000) continue;
    if (samePlannedVisit(left.visit, right.visit)) { parents[root(other)] = root(index); continue; }
    const samePlacement = a.sectionId === b.sectionId && a.subsection === b.subsection && (a.country || '') === (b.country || '');
    if ((!samePlacement && a.sourceName !== b.sourceName) || left.words.length < 6 || right.words.length < 6) continue;
    const shared = left.words.filter(word => right.words.includes(word)).length;
    if (shared / Math.max(left.words.length, right.words.length) < (samePlacement ? 0.74 : 0.9) || (samePlacement && left.words[0] !== right.words[0])) continue;
    if (left.places.size && right.places.size && ![...left.places].some(place => right.places.has(place))) continue;
    parents[root(other)] = root(index);
  }
  const winners = new Map();
  for (let index = 0; index < articles.length; index++) {
    const group = root(index), previous = winners.get(group);
    const selectedOverExcluded = previous !== undefined && excludedIds.has(articles[previous].id) && !excludedIds.has(articles[index].id);
    const manualOverSnapshot = previous !== undefined && excludedIds.has(articles[previous].id) === excludedIds.has(articles[index].id) && articles[previous].sourceId !== 'manual' && articles[index].sourceId === 'manual';
    const preferredSource = previous !== undefined && excludedIds.has(articles[previous].id) === excludedIds.has(articles[index].id) && articles[previous].sourceId !== 'manual' && articles[index].sourceId !== 'manual' && sourcePreference(articles[index]) > sourcePreference(articles[previous]);
    if (previous === undefined || selectedOverExcluded || manualOverSnapshot || preferredSource) winners.set(group, index);
  }
  const selected = new Set(winners.values());
  return articles.filter((_, index) => selected.has(index));
}

export function moveArticleInConfig(config, articles, movedId, destination, excludedIds = new Set()) {
  const current = displaySiteContent(articles, config, excludedIds);
  const moved = current.find(item => item.id === movedId);
  const section = config.sections.find(item => item.id === destination.sectionId && item.visible);
  if (!moved || !section || movedId === destination.anchorId) return config;
  const requestedSubsection = String(destination.subsection || '').trim().slice(0, 100);
  const subsection = section.subsections?.find(label => label.toLocaleLowerCase() === requestedSubsection.toLocaleLowerCase()) || requestedSubsection;
  const requestedCountry = String(destination.country || '').trim().slice(0, 100);
  const countryOptions = [...(MISCELLANEOUS_COUNTRIES[subsection] || []), ...(config.customCountries?.[subsection] || [])];
  const country = countryOptions.find(label => label.toLocaleLowerCase() === requestedCountry.toLocaleLowerCase()) || requestedCountry;
  if (blockedPlacementReason(moved, { sectionId: section.id, subsection, country })) return config;
  if (destination.createSubsection && !subsection) return config;
  if (destination.createCountry && (!country || section.id !== 'Miscellaneous')) return config;
  const alphabetical = new Intl.Collator('en', { sensitivity: 'base', ignorePunctuation: true });
  const sections = destination.createSubsection && !section.subsections?.some(label => label.toLocaleLowerCase() === subsection.toLocaleLowerCase())
    ? config.sections.map(item => item.id === section.id ? { ...item, subsections: [...(item.subsections || []), subsection].sort(alphabetical.compare) } : item)
    : config.sections;
  const customCountries = destination.createCountry && !countryOptions.some(label => label.toLocaleLowerCase() === country.toLocaleLowerCase())
    ? { ...config.customCountries, [subsection]: [...(config.customCountries?.[subsection] || []), country].sort(alphabetical.compare) }
    : config.customCountries;
  const articleOrder = [...new Set([...(config.articleOrder ?? []), ...current.map(item => item.id)])].filter(id => id !== movedId);
  let anchorId = destination.anchorId;
  if (!anchorId) {
    anchorId = [...current].reverse().find(item => item.id !== movedId && item.sectionId === section.id && item.subsection === subsection && (item.country || '') === country)?.id;
  }
  const anchorIndex = articleOrder.indexOf(anchorId);
  const insertAt = anchorIndex < 0 ? articleOrder.length : anchorIndex + (destination.after === false ? 0 : 1);
  articleOrder.splice(insertAt, 0, movedId);
  const updated = config.customArticles.some(item => item.id === movedId)
    ? { ...config, sections, customCountries, articleOrder, customArticles: config.customArticles.map(item => item.id === movedId ? { ...item, sectionId: section.id, subsection, country } : item) }
    : { ...config, sections, customCountries, articleOrder, articleEdits: { ...config.articleEdits, [movedId]: { ...(config.articleEdits[movedId] ?? {}), sectionId: section.id, subsection, country } } };
  const assigned = [
    ...articles.map(article => {
      const edit = updated.articleEdits[article.id];
      return { sectionId: edit?.sectionId || article.section, subsection: edit?.sectionId ? edit.subsection : edit?.subsection || article.subsection || '', country: edit?.sectionId ? edit.country : edit?.country || article.country || '' };
    }),
    ...updated.customArticles.map(article => ({ sectionId: article.sectionId, subsection: article.subsection || '', country: article.country || '' }))
  ];
  const sourceSection = moved.sectionId;
  const sourceSubsection = moved.subsection || '';
  const sourceCountry = moved.country || '';
  const standard = NEWS_SECTIONS.find(item => item.id === sourceSection);
  if (!standard && !assigned.some(item => item.sectionId === sourceSection)) updated.sections = updated.sections.filter(item => item.id !== sourceSection);
  else if (sourceSubsection && !standard?.subsections.includes(sourceSubsection) && !assigned.some(item => item.sectionId === sourceSection && item.subsection === sourceSubsection)) {
    updated.sections = updated.sections.map(item => item.id === sourceSection ? { ...item, subsections: (item.subsections || []).filter(label => label !== sourceSubsection) } : item);
  }
  if (sourceCountry && updated.customCountries?.[sourceSubsection]?.includes(sourceCountry) && !assigned.some(item => item.sectionId === sourceSection && item.subsection === sourceSubsection && item.country === sourceCountry)) {
    const remaining = updated.customCountries[sourceSubsection].filter(label => label !== sourceCountry);
    updated.customCountries = { ...updated.customCountries };
    if (remaining.length) updated.customCountries[sourceSubsection] = remaining;
    else delete updated.customCountries[sourceSubsection];
  }
  return updated;
}

function leadHeadingForStory(story) {
  if (story.sectionId === 'Eastern Europe' && story.subsection === 'Ukraine') return 'Ukraine';
  if (story.subsection === 'MIDDLE EAST / NORTH AFRICA') return 'Middle East';
  return story.country || story.subsection || story.sectionId;
}

function originalPlacementForLead(story) {
  if (story.subsection === 'Ukraine') return { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' };
  if (story.subsection === 'Middle East') {
    const title = story.title || '';
    const country = /\bSaudi(?: Arabia| oil)|\bAramco\b/i.test(title) ? 'Saudi Arabia'
      : /\bIsrael|Israeli|Gaza|Palestin/i.test(title) ? 'Israel'
      : /\bLeban|Hezbollah/i.test(title) ? 'Lebanon'
      : /\bSyria|Syrian/i.test(title) ? 'Syria'
      : /\bT[üu]rki|Turkish/i.test(title) ? 'Türkiye'
      : /\bLibya|Libyan/i.test(title) ? 'Libya' : 'Iran';
    return { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country };
  }
  const standard = NEWS_SECTIONS.find(section => section.id !== 'Lead stories' && section.id !== 'Miscellaneous' && section.subsections.includes(story.subsection));
  if (standard) return { sectionId: standard.id, subsection: story.subsection, country: '' };
  const misc = Object.entries(MISCELLANEOUS_COUNTRIES).find(([, countries]) => countries.includes(story.subsection));
  if (misc) return { sectionId: 'Miscellaneous', subsection: misc[0], country: story.subsection };
  return { sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: story.subsection };
}

export function toggleLeadStoryInConfig(config, articles, storyId, excludedIds = new Set()) {
  const story = displaySiteContent(articles, config, excludedIds).find(item => item.id === storyId);
  if (!story) return config;
  if (story.sectionId !== 'Lead stories') {
    const subsection = leadHeadingForStory(story);
    const moved = moveArticleInConfig(config, articles, storyId, {
      sectionId: 'Lead stories', subsection, country: '', createSubsection: true
    }, excludedIds);
    return moved === config ? config : { ...moved, leadOrigins: { ...config.leadOrigins, [storyId]: { sectionId: story.sectionId, subsection: story.subsection || '', country: story.country || '' } } };
  }
  const origin = config.leadOrigins?.[storyId] || originalPlacementForLead(story);
  const destination = { ...origin, createSubsection: true, createCountry: origin.sectionId === 'Miscellaneous' && Boolean(origin.country) };
  const moved = moveArticleInConfig(config, articles, storyId, destination, excludedIds);
  if (moved === config) return config;
  const leadOrigins = { ...config.leadOrigins };
  delete leadOrigins[storyId];
  return { ...moved, leadOrigins };
}
