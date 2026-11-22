import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from '../src/newsSections.js';
import { articlePlacement } from '../server/importArticle.js';
import { blockedPlacementReason, directGovernmentPublicationReason, isInternationalOutlet, paywalledSourceReason } from '../src/sourcePolicy.js';
import { excludedHeadlineReason } from '../src/headlinePolicy.js';
import { displaySourceName } from '../src/sourceNames.js';
import { stripFeedTeaser } from '../src/feedHeadline.js';
import { conciseDnuSummary } from '../src/conciseSummary.js';
import { mentionsCountry, sourceHomeCountry, ukraineAttackPlacement } from '../src/storyPlacement.js';
import { matchingEditorialDecision } from '../src/editorialLearning.js';

const regional = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const categoryNames = { 'South Caucasus Region': 'South Caucasus', 'Central Asia Region': 'Central Asia' };
const countryNames = { Kosovo: 'Serbia / Kosovo', UK: 'United Kingdom', US: 'United States' };
const routineOrMalformed = /\b(?:bus.truck collision|bus crash|passenger train collision|road accident|highway pileup|motorway pileup|sudden cardiac arrest|child support|film[s]? produced|gas prices|f.gas emissions|Conservation Fund buys|buried today|heart attack in prison|transportation expenses reimbursement|died in (?:a |the )?crash|exhibition on political prisoners|currency dealer|transport, communications sector grows|natural gas production plan|Iran war oil shock drives dip in global emissions|letter of condolence|prime minister.s questions session scheduled|anniversary of the anti.communist revolution|conference on ensuring children.s access to justice|healthcare, tariffs|on priorities of new|on life after release|pay tribute)\b/i;
const headlineArtefact = /^(?:\W*\d{1,2}:\d{2}\s+\d{1,2}[./]\d{1,2}[./]20\d{2}\s+|\W*\d+\s+(?:hours?|days?)\s+ago\s+)/i;
const usActor = /^(?:US[:\s]|U\.S\.[:\s]|Trump\b|Rubio\b|Hegseth\b|Pentagon\b|House\b|Republican\b|Democrat(?:ic)? senator\b|Congress(?:man|woman)?\b|Massie\b)/i;

function cleanedHeadline(value) {
  const headline = String(value || '').trim().replace(headlineArtefact, '')
    .replace(/\s+\d{1,2}:\d{2}\s+\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}$/, '').trim();
  return stripFeedTeaser(headline);
}

function proposedPlacement(item) {
  const sectionId = categoryNames[item.category] || item.category;
  const country = countryNames[item.country] || item.country || '';
  if (regional.has(sectionId)) return { sectionId, subsection: country, country: '' };
  const region = Object.entries(MISCELLANEOUS_COUNTRIES).find(([, countries]) => countries.includes(country))?.[0];
  return region ? { sectionId: 'Miscellaneous', subsection: region, country } : null;
}

function principalHeadlinePlacement(title, sourceName, summary = '') {
  if (/^(?:US|U\.S\.|Democrat(?:ic)?|Republican) senator\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' };
  if (/^Gold Star families\b/i.test(title) && /\bPentagon\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' };
  if (/\bassassination (?:attempt|plot)\b/i.test(title) && /\b(?:in Denmark|Danish)\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Denmark' };
  if (/^Zelensk(?:y|yy)\b/i.test(title) || /,\s*Zelensk(?:y|yy) says\b/i.test(title))
    return { sectionId: 'Eastern Europe', subsection: 'Ukraine', country: '' };
  if (/\b(?:Krasnodar region|off Finland)\b/i.test(title) && /\b(?:strike|struck|drone|cargo ship|burn)\w*\b/i.test(title))
    return /\boff Finland\b/i.test(title)
      ? { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Finland' }
      : { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  if (/^Ukraine war is .+?,\s*Finland says\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Finland' };
  if (/,\s*Polish (?:PM|prime minister|defen[cs]e minister) says\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Poland' };
  if (!usActor.test(title) && !/\b(?:Poland|Polish|Estonia|Estonian)\b/i.test(title)) {
    const attackedUkraine = ukraineAttackPlacement(title, summary);
    if (attackedUkraine) return attackedUkraine;
  }
  if (/^German (?:defen[cs]e|foreign) minister\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Germany' };
  if (/^Moscow invites\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  if (/^(?:China['’]s\s+)?Xi\b/i.test(title)) return { sectionId: 'Miscellaneous', subsection: 'NORTH EAST ASIA', country: 'China' };
  if (/\bTrump,?\s+Xi\s+and\s+Putin\b/i.test(title) && /\bjoint peace declaration\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'NORTH EAST ASIA', country: 'China' };
  if (/^Russian MFA\b/i.test(title) && /\bBaku\b/i.test(title) && /\bYerevan\b/i.test(title) && /^Azertag$/i.test(sourceName))
    return { sectionId: 'South Caucasus', subsection: 'Azerbaijan', country: '' };
  if (/\bSaudi-led forces\b/i.test(title) && /\bstrike\w*\s+Yemen\s+port\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'MIDDLE EAST / NORTH AFRICA', country: 'Yemen' };
  if (/\bSilicon Valley\b/i.test(title) && /\b(?:spy|spying|agent|arrest)\b/i.test(title))
    return { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' };
  if (/\bCrimea(?:n)? Bridge\b/i.test(title)) return { sectionId: 'Miscellaneous', subsection: 'RUSSIA / EURASIA', country: 'Russia' };
  if (/^(?:Dutch|Netherlands)\b/i.test(title) || /^Asylum minister\b/i.test(title) && /^NL Times$/i.test(sourceName))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Netherlands' };
  return null;
}

function coversRegionalSubject(sourceName, placement, title) {
  if (placement?.sectionId === 'South Eastern Europe' && /^(?:BIRN|DTT)$/i.test(sourceName)) return true;
  if (placement?.sectionId === 'Central Asia' && /^(?:Kabar|Trend|Interfax)$/i.test(sourceName)) return true;
  if (placement?.sectionId === 'Eastern Europe' && placement.subsection === 'Belarus' && /^Belsat$/i.test(sourceName)) return true;
  return /^Demócrata$/i.test(sourceName) && placement?.sectionId === 'South Eastern Europe'
    && placement.subsection === 'Bosnia and Herzegovina' && /\bConstitutional Court of Bosnia\b/i.test(title);
}

export function adaptSelectedArticles(selected, leads, registry, editorialLearning = []) {
  const articles = [], rejected = [];
  for (const item of selected) {
    const source = registry.find(entry => entry.domain === item.sourceDomain);
    const creditedWire = /^(?:AP|AFP|Reuters|dpa)$/.test(String(item.wire || '')) ? item.wire : '';
    const sourceName = displaySourceName(creditedWire || source?.name || item.source || item.sourceDomain, { ...item, sourceId: source?.id, url: item.link });
    const title = cleanedHeadline(item.headline);
    const summary = String(item.summary || item.description || '').trim();
    const base = { id: item.id, url: item.link, title, summary, sourceName, sourceId: source?.id || item.sourceDomain };
    const learned = matchingEditorialDecision(base, editorialLearning);
    const learnedPlacement = learned?.action === 'approve' && learned.sectionId && learned.subsection
      ? { sectionId: learned.sectionId, subsection: learned.subsection, country: learned.country || '' } : null;
    const headlineReason = excludedHeadlineReason(title, summary, item.link);
    const sourceReason = directGovernmentPublicationReason(base) || paywalledSourceReason(base);
    const proposed = learnedPlacement || principalHeadlinePlacement(title, sourceName, summary) || (usActor.test(title) && /\b(?:Iran|Iranian|impeach|defence|defense|Pentagon|war|sanction|strikes?|Nvidia|FBI|Putin|Russia|Ukraine)\b/i.test(title)
      ? { sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' }
      : articlePlacement({}, title, '') || proposedPlacement(item));
    const placement = learnedPlacement || proposed && (proposed.sectionId !== 'Miscellaneous' || MISCELLANEOUS_COUNTRIES[proposed.subsection]?.includes(proposed.country))
      ? proposed : articlePlacement({}, title, summary);
    const unrelatedRegional = source?.country === 'Azerbaijan' && /\b(?:IRGC|Netanyahu|Tanzania|Sri Lanka)\b/i.test(title) && !/\b(?:Azerbaijan|Azerbaijani|Baku|Aliyev)\b/i.test(title)
      || source?.country === 'Kyrgyzstan' && /\b(?:Leningrad|Kirishi)\b/i.test(title);
    const home = sourceHomeCountry(base) || (source?.country !== 'International' ? source?.country : '');
    const subjectCountry = placement?.country || placement?.subsection || '';
    const unrelatedHome = home && subjectCountry && home !== subjectCountry && !(home === 'Kosovo' && subjectCountry === 'Serbia / Kosovo')
      && !isInternationalOutlet(base) && !coversRegionalSubject(sourceName, placement, title)
      && !mentionsCountry(`${title} ${summary}`, home);
    const malformed = routineOrMalformed.test(title) || title.length > 180 || title.split(/\s+/).length < 4
      || /^(?:LIVE|WATCH|Podcast)\b/i.test(title)
      || /\|\s*(?:First Thing|Podcast)\s*$/i.test(title)
      || /^["“‘']/.test(title) && !/\b(?:government|court|arrest|attack|war|security|election|parliament|protest)\b/i.test(title)
      || /\bThe Citizens\b.{0,60}\bOthers\b/i.test(title)
      || /^You killed a person today\b/i.test(title)
      || /\bcrash(?:es)?\b.{0,40}\bmotorway\b/i.test(title)
      || /\barchives?\s*-\s*page\s+\d+\b/i.test(title)
      || unrelatedRegional
      || /^(?:Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Monday),?\s+\d{1,2}\s+[A-Z][a-z]+\s+20\d{2}$/i.test(title);
    const reason = learned?.action === 'reject' ? 'Editor rejected this or a closely matching story'
      : learnedPlacement ? '' : headlineReason || sourceReason || (/^(?:OHCHR)$/i.test(sourceName) ? 'Direct organisation publication' : '')
      || (!source ? 'Publisher is not in the configured catalogue' : '')
      || (malformed ? 'Routine, incomplete or malformed headline outside the DNU brief' : '')
      || (unrelatedHome ? 'Local outlet reports an event outside its home country without a local subject' : '')
      || (!placement ? 'No DNU heading could be identified' : blockedPlacementReason(base, placement));
    if (reason) { rejected.push({ ...base, reason, editorDecision: learned?.action === 'reject' ? 'deleted' : '', summary: conciseDnuSummary(item.publicSummary || '', title), publishedAt: item.published,
      body: String(item.articleBody || '').trim() }); continue; }
    const lead = leads.has(item.id);
    const body = String(item.articleBody || '').trim();
    articles.push({
      ...base, summary: conciseDnuSummary(item.publicSummary || '', title), publishedAt: item.published,
      timeSource: item.pageVerified ? 'page' : 'feed',
      sectionId: lead ? 'Lead stories' : placement.sectionId,
      section: lead ? 'Lead stories' : placement.sectionId,
      subsection: lead ? placement.country || placement.subsection : placement.subsection,
      country: lead ? '' : placement.country,
      originSection: placement.sectionId, originCountry: placement.country || placement.subsection,
      reviewed: true, fromNativeCollector: true, editorialApproval: Boolean(learnedPlacement),
      body: body.split(/\s+/).length >= 25 ? body : ''
    });
  }
  return { articles, rejected };
}

export function limitBelarusStateAgency(articles) {
  let beltaStories = 0;
  const kept = [], removed = [];
  for (const article of articles) {
    if (article.editorialApproval) { kept.push(article); continue; }
    if (/^BelTA$/i.test(article.sourceName || '') && article.sectionId === 'Eastern Europe' && article.subsection === 'Belarus') {
      if (++beltaStories > 1) { removed.push(article); continue; }
    }
    kept.push(article);
  }
  return { articles: kept, removed };
}

function eventKey(article) {
  const title = article.title.toLowerCase();
  if (/hegseth|pentagon chief|defence chief|defense chief/.test(title) && /impeach/.test(title)) return 'hegseth-impeachment';
  if (/constitutional court/.test(title) && /opposition part|georgian dream petition/.test(title) && article.subsection === 'Georgia') return 'georgia-opposition-court';
  if (/constitutional court/.test(title) && /media freedom|agsh|regulation to plenary/.test(title) && article.subsection === 'Albania') return 'albania-media-court';
  if (/kosovo/.test(title) && /train|rail/.test(title) && /strike|disrupt|without rail/.test(title)) return 'kosovo-rail-strike';
  if (/zhaparov|kyrgyz president/.test(title) && /csto/.test(title)) return 'kyrgyz-csto-visit';
  if (/trump/.test(title) && /nvidia/.test(title) && /chinese spy/.test(title)) return 'trump-nvidia-spy';
  return '';
}

function sourceRank(article) {
  const source = article.sourceName.toLowerCase();
  const priority = ['reuters', 'ap', 'afp', 'bbc', 'dw', 'dpa', 'euronews', 'france 24', 'kabar', 'n1', 'civil.ge', 'ipn.ge'];
  const index = priority.indexOf(source);
  return (article.editorialApproval ? 1000 : 0) + (index < 0 ? 0 : 100 - index * 5) + (article.body ? 2 : 0);
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
