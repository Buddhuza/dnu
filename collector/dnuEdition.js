import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';
import { articlePlacement } from '../server/importArticle.js';
import { blockedPlacementReason, directGovernmentPublicationReason, paywalledSourceReason } from '../src/sourcePolicy.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { displaySourceName } from '../src/sourceNames.js';

const regional = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const categoryNames = { 'South Caucasus Region': 'South Caucasus', 'Central Asia Region': 'Central Asia' };
const countryNames = { Kosovo: 'Serbia / Kosovo', UK: 'United Kingdom', US: 'United States' };

function proposedPlacement(item) {
  const sectionId = categoryNames[item.category] || item.category;
  const country = countryNames[item.country] || item.country || '';
  if (regional.has(sectionId)) return { sectionId, subsection: country, country: '' };
  const region = Object.entries(MISCELLANEOUS_COUNTRIES).find(([, countries]) => countries.includes(country))?.[0];
  return region ? { sectionId: 'Miscellaneous', subsection: region, country } : null;
}

export function adaptSelectedArticles(selected, leads, registry) {
  const articles = [], rejected = [];
  for (const item of selected) {
    const source = registry.find(entry => entry.domain === item.sourceDomain);
    const sourceName = displaySourceName(item.source || source?.name || item.sourceDomain, item);
    const title = String(item.headline || '').trim();
    const summary = String(item.summary || item.description || '').trim();
    const base = { id: item.id, url: item.link, title, summary, sourceName, sourceId: source?.id || item.sourceDomain };
    const headlineReason = excludedHeadlineReason(title, summary, item.link);
    const sourceReason = directGovernmentPublicationReason(base) || paywalledSourceReason(base);
    const proposed = proposedPlacement(item);
    const placement = proposed && (proposed.sectionId !== 'Miscellaneous' || MISCELLANEOUS_COUNTRIES[proposed.subsection]?.includes(proposed.country))
      ? proposed : articlePlacement({}, title, summary);
    const reason = headlineReason || sourceReason || (!placement ? 'No DNU heading could be identified' : blockedPlacementReason(base, placement));
    if (reason) { rejected.push({ id: item.id, title, reason }); continue; }
    const lead = leads.has(item.id);
    const body = String(item.articleBody || '').trim();
    articles.push({
      ...base, summary: String(item.publicSummary || '').trim(), publishedAt: item.published,
      sectionId: lead ? 'Lead stories' : placement.sectionId,
      section: lead ? 'Lead stories' : placement.sectionId,
      subsection: lead ? placement.country || placement.subsection : placement.subsection,
      country: lead ? '' : placement.country,
      originSection: placement.sectionId, originCountry: placement.country || placement.subsection,
      reviewed: true, fromNativeCollector: true,
      body: body.split(/\s+/).length >= 25 ? body : ''
    });
  }
  return { articles, rejected };
}
