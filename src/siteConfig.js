export const THEME_PRESETS = {
  forest: { name: 'Forest', primary: '#123e47', accent: '#bce081', background: '#f7f8f6', surface: '#ffffff', text: '#182a36', section: '#0070c0', font: 'DM Sans' },
  blue: { name: 'OSCE blue', primary: '#183b65', accent: '#c6dcf2', background: '#f4f7fb', surface: '#ffffff', text: '#1b2d42', section: '#0070c0', font: 'DM Sans' },
  slate: { name: 'Slate', primary: '#263340', accent: '#d7e1e9', background: '#f2f4f6', surface: '#ffffff', text: '#1f2d38', section: '#465e78', font: 'Manrope' },
  warm: { name: 'Warm', primary: '#5b3b32', accent: '#f3d4a4', background: '#fbf7f1', surface: '#ffffff', text: '#3d302a', section: '#9b5834', font: 'Georgia' }
};

const defaults = {
  version: 1,
  brandName: 'SIGNAL DESK',
  brandTagline: 'NEWS MONITORING WORKSPACE',
  eyebrow: 'INTELLIGENCE / DAILY BRIEF',
  heroTitle: 'Find the stories',
  heroAccent: 'that matter.',
  heroDescription: 'Review timely coverage from your trusted sources. Keep the signal, leave the noise.',
  updateTitle: 'Daily news update',
  coverageText: '',
  showHero: true,
  showCoverage: true,
  theme: THEME_PRESETS.forest,
  sections: [],
  articleEdits: {},
  customArticles: []
};

const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(value ?? '') ? value : fallback;
const clean = (value, fallback = '', limit = 240) => typeof value === 'string' ? value.slice(0, limit) : fallback;
const httpsUrl = value => {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; }
};

export function defaultSiteConfig(articles = []) {
  const names = [...new Set(articles.map(item => item.section).filter(Boolean))];
  return { ...defaults, theme: { ...THEME_PRESETS.forest }, sections: names.map(name => ({ id: name, name, visible: true })) };
}

export function normalizeSiteConfig(input, articles = []) {
  const base = defaultSiteConfig(articles);
  if (!input || typeof input !== 'object' || input.version !== 1) return base;
  const rawSections = Array.isArray(input.sections) ? input.sections : [];
  const seen = new Set();
  const sections = rawSections.slice(0, 40).flatMap(item => {
    const id = clean(item?.id, '', 80).trim();
    if (!id || seen.has(id)) return [];
    seen.add(id);
    return [{ id, name: clean(item?.name, id, 80).trim() || id, visible: item?.visible !== false }];
  });
  for (const section of base.sections) if (!seen.has(section.id)) sections.push(section);
  const sectionIds = new Set(sections.map(item => item.id));
  const rawTheme = input.theme && typeof input.theme === 'object' ? input.theme : {};
  const theme = {
    name: clean(rawTheme.name, base.theme.name, 40),
    primary: color(rawTheme.primary, base.theme.primary),
    accent: color(rawTheme.accent, base.theme.accent),
    background: color(rawTheme.background, base.theme.background),
    surface: color(rawTheme.surface, base.theme.surface),
    text: color(rawTheme.text, base.theme.text),
    section: color(rawTheme.section, base.theme.section),
    font: ['DM Sans', 'Manrope', 'Georgia'].includes(rawTheme.font) ? rawTheme.font : base.theme.font
  };
  const articleEdits = Object.create(null);
  if (input.articleEdits && typeof input.articleEdits === 'object' && !Array.isArray(input.articleEdits)) {
    for (const [id, edit] of Object.entries(input.articleEdits).slice(0, 500)) {
      if (!edit || typeof edit !== 'object') continue;
      articleEdits[id] = {
        title: clean(edit.title, '', 400),
        summary: clean(edit.summary, '', 1200),
        subsection: clean(edit.subsection, '', 100),
        sectionId: sectionIds.has(edit.sectionId) ? edit.sectionId : '',
        hidden: edit.hidden === true
      };
    }
  }
  const customArticles = (Array.isArray(input.customArticles) ? input.customArticles : []).slice(0, 100).flatMap(item => {
    const url = httpsUrl(item?.url);
    const title = clean(item?.title, '', 400).trim();
    if (!url || !title) return [];
    return [{
      id: clean(item.id, `manual-${url}`, 500), url,
      sourceId: 'manual', sourceName: clean(item.sourceName, 'Manual entry', 100),
      title, summary: clean(item.summary, '', 1200),
      publishedAt: Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toISOString() : new Date().toISOString(),
      sectionId: sectionIds.has(item.sectionId) ? item.sectionId : sections[0]?.id || 'Miscellaneous',
      subsection: clean(item.subsection, '', 100),
      hidden: item.hidden === true, reviewed: true
    }];
  });
  return {
    version: 1,
    brandName: clean(input.brandName, base.brandName, 80),
    brandTagline: clean(input.brandTagline, base.brandTagline, 100),
    eyebrow: clean(input.eyebrow, base.eyebrow, 100),
    heroTitle: clean(input.heroTitle, base.heroTitle, 100),
    heroAccent: clean(input.heroAccent, base.heroAccent, 100),
    heroDescription: clean(input.heroDescription, base.heroDescription, 400),
    updateTitle: clean(input.updateTitle, base.updateTitle, 100),
    coverageText: clean(input.coverageText, '', 600),
    showHero: input.showHero !== false,
    showCoverage: input.showCoverage !== false,
    theme, sections, articleEdits, customArticles
  };
}

export function displaySiteContent(articles, config) {
  const sectionById = new Map(config.sections.map(section => [section.id, section]));
  const items = [];
  for (const article of articles) {
    const edit = config.articleEdits[article.id];
    const sectionId = edit?.sectionId || article.section;
    if (edit?.hidden || sectionById.get(sectionId)?.visible === false) continue;
    items.push({
      ...article,
      title: edit?.title?.trim() || article.title,
      summary: edit?.summary?.trim() || article.summary,
      section: sectionById.get(sectionId)?.name || sectionId,
      sectionId,
      subsection: edit ? edit.subsection : article.subsection
    });
  }
  for (const article of config.customArticles) {
    if (article.hidden || sectionById.get(article.sectionId)?.visible === false) continue;
    items.push({ ...article, section: sectionById.get(article.sectionId)?.name || article.sectionId });
  }
  const order = new Map(config.sections.map((section, index) => [section.id, index]));
  return items.sort((a, b) => (order.get(a.sectionId) ?? 999) - (order.get(b.sectionId) ?? 999));
}
