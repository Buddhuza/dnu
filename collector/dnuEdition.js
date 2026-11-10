import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';
import { articlePlacement } from '../server/importArticle.js';
import { blockedPlacementReason, directGovernmentPublicationReason, paywalledSourceReason } from '../src/sourcePolicy.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { displaySourceName } from '../src/sourceNames.js';

const regional = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const categoryNames = { 'South Caucasus Region': 'South Caucasus', 'Central Asia Region': 'Central Asia' };
const countryNames = { Kosovo: 'Serbia / Kosovo', UK: 'United Kingdom', US: 'United States' };
const routineOrMalformed = /\b(?:bus.truck collision|passenger train collision|road accident|highway pileup|motorway crash|sudden cardiac arrest|child support|film[s]? produced|gas prices|f.gas emissions|Conservation Fund buys|buried today|heart attack in prison|transportation expenses reimbursement|died in (?:a |the )?crash)\b/i;
const headlineArtefact = /^(?:\W*\d{1,2}:\d{2}\s+\d{1,2}[./]\d{1,2}[./]20\d{2}\s+|\W*\d+\s+(?:hours?|days?)\s+ago\s+)/i;
const usActor = /^(?:US[:\s]|U\.S\.[:\s]|Trump\b|Rubio\b|Hegseth\b|Pentagon\b|House\b|Republican\b|Congress(?:man|woman)?\b|Massie\b)/i;

function cleanedHeadline(value) {
  return String(value || '').trim().replace(headlineArtefact, '')
    .replace(/\s+\d{1,2}:\d{2}\s+\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}$/, '').trim();
}

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
    const sourceName = displaySourceName(source?.name || item.source || item.sourceDomain, { ...item, sourceId: source?.id, url: item.link });
    const title = cleanedHeadline(item.headline);
    const summary = String(item.summary || item.description || '').trim();
    const base = { id: item.id, url: item.link, title, summary, sourceName, sourceId: source?.id || item.sourceDomain };
    const headlineReason = excludedHeadlineReason(title, summary, item.link);
    const sourceReason = directGovernmentPublicationReason(base) || paywalledSourceReason(base);
    const proposed = usActor.test(title) && /\b(?:Iran|impeach|defence|defense|Pentagon|war|sanction|strikes?)\b/i.test(title)
      ? { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' } : proposedPlacement(item);
    const placement = proposed && (proposed.sectionId !== 'Miscellaneous' || MISCELLANEOUS_COUNTRIES[proposed.subsection]?.includes(proposed.country))
      ? proposed : articlePlacement({}, title, summary);
    const malformed = routineOrMalformed.test(title) || title.length > 180 || title.split(/\s+/).length < 4
      || /^(?:LIVE|WATCH|Podcast)\b/i.test(title)
      || /^(?:Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Monday),?\s+\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}$/i.test(title);
    const reason = headlineReason || sourceReason || (!source ? 'Publisher is not in the configured catalogue' : '')
      || (malformed ? 'Routine, incomplete or malformed headline outside the DNU brief' : '')
      || (!placement ? 'No DNU heading could be identified' : blockedPlacementReason(base, placement));
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
