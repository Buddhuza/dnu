import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';
import { articlePlacement } from '../server/importArticle.js';
import { blockedPlacementReason, directGovernmentPublicationReason, paywalledSourceReason } from '../src/sourcePolicy.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { displaySourceName } from '../src/sourceNames.js';

const regional = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const categoryNames = { 'South Caucasus Region': 'South Caucasus', 'Central Asia Region': 'Central Asia' };
const countryNames = { Kosovo: 'Serbia / Kosovo', UK: 'United Kingdom', US: 'United States' };
const routineOrMalformed = /\b(?:bus.truck collision|bus crash|passenger train collision|road accident|highway pileup|motorway pileup|sudden cardiac arrest|child support|film[s]? produced|gas prices|f.gas emissions|Conservation Fund buys|buried today|heart attack in prison|transportation expenses reimbursement|died in (?:a |the )?crash|exhibition on political prisoners|currency dealer|transport, communications sector grows|natural gas production plan|Iran war oil shock drives dip in global emissions|letter of condolence|prime minister.s questions session scheduled|anniversary of the anti.communist revolution|conference on ensuring children.s access to justice|healthcare, tariffs|on priorities of new|on life after release|pay tribute)\b/i;
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
    const unrelatedRegional = source?.country === 'Azerbaijan' && /\b(?:IRGC|Netanyahu|Tanzania|Sri Lanka)\b/i.test(title) && !/\b(?:Azerbaijan|Azerbaijani|Baku|Aliyev)\b/i.test(title)
      || source?.country === 'Kyrgyzstan' && /\b(?:Leningrad|Kirishi)\b/i.test(title);
    const malformed = routineOrMalformed.test(title) || title.length > 180 || title.split(/\s+/).length < 4
      || /^(?:LIVE|WATCH|Podcast)\b/i.test(title)
      || /\|\s*(?:First Thing|Podcast)\s*$/i.test(title)
      || /^["“‘']/.test(title) && !/\b(?:government|court|arrest|attack|war|security|election|parliament|protest)\b/i.test(title)
      || /\bThe Citizens\b.{0,60}\bOthers\b/i.test(title)
      || /^You killed a person today\b/i.test(title)
      || /\bcrash(?:es)?\b.{0,40}\bmotorway\b/i.test(title)
      || unrelatedRegional
      || /^(?:Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Monday),?\s+\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}$/i.test(title);
    const reason = headlineReason || sourceReason || (/^(?:OHCHR)$/i.test(sourceName) ? 'Direct organisation publication' : '')
      || (!source ? 'Publisher is not in the configured catalogue' : '')
      || (malformed ? 'Routine, incomplete or malformed headline outside the DNU brief' : '')
      || (!placement ? 'No DNU heading could be identified' : blockedPlacementReason(base, placement));
    if (reason) { rejected.push({ id: item.id, title, reason }); continue; }
    const lead = leads.has(item.id);
    const body = String(item.articleBody || '').trim();
    articles.push({
      ...base, summary: String(item.publicSummary || '').trim(), publishedAt: item.published,
      timeSource: item.pageVerified ? 'page' : 'feed',
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

function eventKey(article) {
  const title = article.title.toLowerCase();
  if (/hegseth|pentagon chief|defence chief|defense chief/.test(title) && /impeach/.test(title)) return 'hegseth-impeachment';
  if (/constitutional court/.test(title) && /opposition part|georgian dream petition/.test(title) && article.subsection === 'Georgia') return 'georgia-opposition-court';
  if (/constitutional court/.test(title) && /media freedom|agsh|regulation to plenary/.test(title) && article.subsection === 'Albania') return 'albania-media-court';
  if (/kosovo/.test(title) && /train|rail/.test(title) && /strike|disrupt|without rail/.test(title)) return 'kosovo-rail-strike';
  if (/zhaparov|kyrgyz president/.test(title) && /csto/.test(title)) return 'kyrgyz-csto-visit';
  return '';
}

function sourceRank(article) {
  const source = article.sourceName.toLowerCase();
  const priority = ['reuters', 'ap', 'afp', 'bbc', 'dw', 'dpa', 'euronews', 'france 24', 'kabar', 'n1', 'civil.ge', 'ipn.ge'];
  const index = priority.indexOf(source);
  return (index < 0 ? 0 : 100 - index * 5) + (article.body ? 2 : 0);
}

export function dedupeNativeEvents(articles) {
  const preferred = new Map(), removed = [];
  for (const article of articles) {
    const key = eventKey(article);
    if (!key) continue;
    const prior = preferred.get(key);
    if (!prior || sourceRank(article) > sourceRank(prior)) preferred.set(key, article);
  }
  const kept = articles.filter(article => {
    const key = eventKey(article);
    if (!key || preferred.get(key) === article) return true;
    removed.push({ article, preferred: preferred.get(key) });
    return false;
  });
  return { articles: kept, removed };
}
