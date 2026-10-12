import { NEWS_SECTIONS } from './newsSections.js';

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
  customArticles: [],
  customSources: [],
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
      publishedAt: Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
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
  return {
    version: 1,
    brandName: input.brandName === 'SIGNAL DESK' ? base.brandName : clean(input.brandName, base.brandName, 80),
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
    theme, darkTheme, sections, articleEdits, customArticles, customSources,
    hiddenSourceIds: (Array.isArray(input.hiddenSourceIds) ? input.hiddenSourceIds : []).filter(id => typeof id === 'string').slice(0, 500)
  };
}

export function displaySources(baseSources, config) {
  const hidden = new Set(config.hiddenSourceIds);
  return [...baseSources, ...config.customSources].filter(source => !hidden.has(source.id));
}

export function displaySiteContent(articles, config) {
  const sectionById = new Map(config.sections.map(section => [section.id, section]));
  const items = [];
  for (const article of articles) {
    const edit = config.articleEdits[article.id];
    const legacyOrganisations = article.section === 'International organisations' || (article.section === 'Lead stories' && article.subsection === 'International organisations');
    const sectionId = edit?.sectionId || (legacyOrganisations ? 'Miscellaneous' : article.section);
    if (edit?.hidden || sectionById.get(sectionId)?.visible === false) continue;
    items.push({
      ...article,
      title: edit?.title?.trim() || article.title,
      summary: edit?.summary?.trim() || article.summary,
      section: sectionById.get(sectionId)?.name || sectionId,
      sectionId,
      subsection: edit ? edit.subsection : legacyOrganisations ? 'INTERNATIONAL ORGANISATIONS' : article.subsection,
      country: edit?.country || article.country || ''
    });
  }
  for (const article of config.customArticles) {
    if (article.hidden || sectionById.get(article.sectionId)?.visible === false) continue;
    items.push({ ...article, section: sectionById.get(article.sectionId)?.name || article.sectionId });
  }
  const order = new Map(config.sections.map((section, index) => [section.id, index]));
  return items.sort((a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999));
}
