// Conservative, local review hints. A match asks an editor to compare two stories;
// it never removes either story from the update.
const stop = new Set('a an the and or of in on at to for from by with as after before over under about amid says said say new latest this that its their his her who which will would could should is are was were has have had us u s uk eu un news report reports officials official country government president minister leaders top more into during following next today yesterday'.split(' '));
const aliases = new Map(Object.entries({ visiting:'visit', visits:'visit', visited:'visit', trip:'visit', travel:'visit', travels:'visit', travelling:'visit', talks:'talk', discussed:'talk', discusses:'talk', discussing:'talk', meets:'talk', meeting:'talk', met:'talk', negotiations:'talk', negotiates:'talk', strike:'attack', strikes:'attack', attacked:'attack', attacks:'attack', bombing:'attack', bombed:'attack', missile:'missile', missiles:'missile', sanction:'sanction', sanctions:'sanction', sanctioned:'sanction', agreement:'deal', agrees:'deal', agreed:'deal', deal:'deal', signs:'deal', signed:'deal', elections:'election', elected:'election', vote:'election', voting:'election', votes:'election', announces:'announce', announced:'announce', announcement:'announce', plans:'plan', planned:'plan', planning:'plan', hosted:'host', hosts:'host', reviewed:'review', reviews:'review', attending:'attend', attends:'attend', arrived:'arrive', arrives:'arrive', montenegrin:'montenegro', croatian:'croatia', chinese:'china' }));
const actions = new Set(['visit','talk','attack','sanction','deal','election','announce','plan','arrest','resign','appoint','ceasefire','aid','approve','reject','warn','release','kill','injure','deploy','withdraw','host','review','attend','arrive']);
const places = 'Albania Armenia Azerbaijan Belarus Bosnia Canada China Croatia Georgia Germany India Iran Israel Kazakhstan Kosovo Kyrgyzstan Moldova Montenegro Pakistan Poland Russia Serbia Syria Tajikistan Turkmenistan Ukraine Uzbekistan Vietnam'.toLocaleLowerCase().split(' ');

function terms(value) {
  return [...new Set(String(value || '').toLocaleLowerCase('en').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').match(/[a-z]{3,}/g)?.map(word => aliases.get(word) || word).filter(word => !stop.has(word)) || [])];
}

export function sameNewsEvent(a, b) {
  const left = terms(a.title), right = terms(b.title);
  if (left.length < 3 || right.length < 3) return false;
  const first = Date.parse(a.publishedAt), second = Date.parse(b.publishedAt);
  if (Number.isFinite(first) && Number.isFinite(second) && Math.abs(first - second) > 48 * 3600_000) return false;
  const shared = left.filter(word => right.includes(word));
  const leftAcronyms = a.title.match(/\b(?:EU|UK|US|UN)\b/g) || [], rightAcronyms = b.title.match(/\b(?:EU|UK|US|UN)\b/g) || [];
  if (leftAcronyms.length && rightAcronyms.length && !leftAcronyms.some(word => rightAcronyms.includes(word))) return false;
  const leftPlaces = places.filter(place => left.includes(place)), rightPlaces = places.filter(place => right.includes(place));
  if (leftPlaces.length && rightPlaces.length && !leftPlaces.every(place => rightPlaces.includes(place)) && !rightPlaces.every(place => leftPlaces.includes(place))) return false;
  // Similar coverage of a summit is a different story when the visitors differ.
  if (left.includes('cica') && right.includes('cica') && /\b(attend|arriv|visit)/i.test(a.title) && /\b(attend|arriv|visit)/i.test(b.title)) {
    const attendee = title => terms(title.split(/\b(?:attend|arriv\w*|visit\w*)\b/i)[0]).filter(word => !['cica','summit','azerbaijan','baku','president','minister','foreign','vice','state'].includes(word));
    const one = attendee(a.title), two = attendee(b.title);
    if (one.length && two.length && !one.some(word => two.includes(word))) return false;
  }
  const leftActions = left.filter(word => actions.has(word)), rightActions = right.filter(word => actions.has(word));
  if (leftActions.length && rightActions.length && !leftActions.some(word => rightActions.includes(word))) return false;
  const coverage = shared.length / Math.min(left.length, right.length);
  if (shared.length >= 3 && coverage >= .65 && shared.length / Math.max(left.length, right.length) >= .5) return true;
  // A shared actor and action can survive different headline wording. The
  // summaries must add a further specific detail before the pair is flagged.
  if (shared.length < 2 || !leftActions.some(word => rightActions.includes(word))) return false;
  const detailLeft = terms(`${a.title} ${a.summary}`), detailRight = terms(`${b.title} ${b.summary}`);
  return detailLeft.filter(word => detailRight.includes(word)).length >= 5 &&
    detailLeft.filter(word => detailRight.includes(word)).length / Math.min(detailLeft.length, detailRight.length) >= .48;
}

export function possibleDuplicates(articles) {
  const matches = new Map();
  for (let i = 0; i < articles.length; i++) for (let j = i + 1; j < articles.length; j++) {
    if (!sameNewsEvent(articles[i], articles[j])) continue;
    if (!matches.has(articles[i].id)) matches.set(articles[i].id, []);
    if (!matches.has(articles[j].id)) matches.set(articles[j].id, []);
    matches.get(articles[i].id).push(articles[j]);
    matches.get(articles[j].id).push(articles[i]);
  }
  return matches;
}

export function duplicateGroups(articles) {
  const matches = possibleDuplicates(articles);
  const visited = new Set();
  const groups = new Map();
  let number = 0;
  for (const article of articles) {
    if (!matches.has(article.id) || visited.has(article.id)) continue;
    number++;
    const members = [];
    const queue = [article.id];
    while (queue.length) {
      const id = queue.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      members.push(id);
      for (const other of matches.get(id) || []) if (!visited.has(other.id)) queue.push(other.id);
    }
    for (const id of members) groups.set(id, { number, matches: matches.get(id) || [] });
  }
  return groups;
}

export function duplicateGroupHue(number) {
  return Math.round((number - 1) * 137.508) % 360;
}
