import { franc } from 'franc-min';

const russianSourceIds = new Set(['source-97', 'source-98', 'source-99', 'source-115', 'source-116']);
const englishWords = new Set('the and for with from that this which will have has was were are about into over under after before between during government minister president security defence defense politics political election parliament country countries talks agreement cooperation military foreign international new said says'.split(' '));

function words(value) { return String(value ?? '').toLocaleLowerCase().match(/[a-z]+/g) || []; }
function englishWordCount(value) { return words(value).filter(word => englishWords.has(word)).length; }
function nonLatinShare(value) {
  const letters = String(value ?? '').match(/\p{L}/gu) || [];
  return letters.length ? letters.filter(letter => !/\p{Script=Latin}/u.test(letter)).length / letters.length : 0;
}

export function isEnglishListingText(title, summary = '') {
  const text = `${title} ${summary}`.trim();
  if (!text || nonLatinShare(text) > 0.12) return false;
  if (englishWordCount(text) >= 2) return true;
  if (text.length >= 60) return franc(text, { minLength: 40 }) === 'eng';
  return franc(text, { minLength: 20 }) === 'eng' || englishWordCount(text) > 0;
}

export function isEnglishArticle(payload, title, summary = '') {
  if (!isEnglishListingText(title, summary)) return false;
  const data = payload?.data || {};
  const metadata = data.metadata || {};
  const hint = String(metadata.language ?? metadata.lang ?? metadata.ogLocale ?? metadata['og:locale'] ?? data.html?.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1] ?? '').trim().toLowerCase();
  if (hint && !/^en(?:[-_]|$)/.test(hint)) return false;
  if (/^en(?:[-_]|$)/.test(hint)) return true;
  const markdown = String(data.markdown ?? '').replace(/!?\[([^\]]+)\]\([^)]*\)/g, '$1').slice(0, 8000);
  if (markdown.length >= 350) return franc(markdown, { minLength: 200 }) === 'eng' || englishWordCount(markdown) >= 15;
  return isEnglishListingText(title, summary);
}

export function isRussianSource(source) {
  if (russianSourceIds.has(source.id)) return true;
  try { return /^(?:tass\.com|iz\.ru|sputniknews\.com|sputnikglobe\.com|themoscowtimes\.com|meduza\.io)$/.test(new URL(source.url).hostname.replace(/^www\./, '')); }
  catch { return false; }
}

export function isRussiaFocused(title, summary = '') {
  if (/\b(?:Ukraine|Ukrainian|Kyiv|Kiev|Nikolayev|Mykolaiv|Kharkiv|Rivne)\b/i.test(title) && /\b(?:strik\w*|hit\w*|attack\w*|pound\w*|inva\w*|troops|front|missile\w*|drone\w*)\b/i.test(title)) return false;
  return /\b(?:Russia|Russian|Moscow|Kremlin|Putin|Lavrov|FSB|Duma|St Petersburg|Voronezh)\b/i.test(title);
}

export function editorialScore(title, summary = '') {
  const text = `${title} ${summary}`;
  let score = 0;
  if (/\bOSCE\b|Organization for Security and Co-operation in Europe|Organisation for Security and Co-operation in Europe/i.test(text)) score += 100;
  if (/\b(?:bilateral|cooperation|co-operat|diplomacy|diplomatic|foreign policy|joint|treaty|summit|dialogue|talks|cross-border|international agreement|alliance|sanctions|peace agreement|peace process|military aid|arms flows)\b/i.test(text)) score += 25;
  if (/\b(?:NATO|EU|UN|ASEAN|ICC|security|defence|defense|conflict|war|terrorism|ceasefire)\b/i.test(text)) score += 10;
  if (/\b(?:mayor|house arrest|domestic welfare|labour strike|labor strike|local government|local election|criminal probe|riot|party leadership|court case)\b/i.test(title) && score < 100) score -= 15;
  return score;
}

export function passesSourcePolicy(source, title, summary = '') {
  return isEnglishListingText(title, summary) && (!isRussianSource(source) || isRussiaFocused(title, summary));
}
