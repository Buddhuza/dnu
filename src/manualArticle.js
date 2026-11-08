import { franc } from 'franc-min';
import { conciseDnuSummary } from './conciseSummary.js';
import { markTranslatedHeadline, withoutTranslationMarker } from './articleTranslation.js';

const languages = { arb: 'ar', arz: 'ar', aze: 'az', bel: 'be', bul: 'bg', ces: 'cs', deu: 'de', ell: 'el', eng: 'en', fas: 'fa', fra: 'fr', hye: 'hy', ita: 'it', kat: 'ka', kaz: 'kk', lit: 'lt', mkd: 'mk', nld: 'nl', pol: 'pl', por: 'pt', ron: 'ro', rus: 'ru', slv: 'sl', spa: 'es', srp: 'sr', tur: 'tr', ukr: 'uk', uzb: 'uz', zho: 'zh' };

export function detectManualLanguage(headline, body, chosen = 'auto') {
  if (chosen !== 'auto') return chosen;
  const sample = String(body || '').trim() || String(headline || '').trim();
  if (/[\u10a0-\u10ff]/.test(sample)) return 'ka';
  if (/[\u0530-\u058f]/.test(sample)) return 'hy';
  if (/[\u0600-\u06ff]/.test(sample)) return 'ar';
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh';
  if (/[\u0456\u0457\u0454\u0491]/i.test(sample)) return 'uk';
  if (/[\u044b\u044d\u044a\u0451]/i.test(sample)) return 'ru';
  return languages[franc(sample.slice(0, 1200), { minLength: 10 })] || 'en';
}

export function manualSummary(body, headline) {
  const first = String(body || '').trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (!first) return '';
  const selected = conciseDnuSummary(first, headline);
  const words = selected.split(/\s+/);
  if (words.length <= 30) return selected;
  return words.slice(0, 30).join(' ').replace(/[,;:–—-]$/, '');
}

function chunks(value, length = 450) {
  const paragraphs = String(value || '').split(/(\n\s*\n)/);
  const result = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) { result.push(paragraph); continue; }
    let rest = paragraph;
    while (rest.length > length) {
      let cut = rest.lastIndexOf(' ', length);
      if (cut < length / 2) cut = length;
      result.push(rest.slice(0, cut));
      rest = rest.slice(cut).trimStart();
    }
    if (rest) result.push(rest);
  }
  return result;
}

async function translatePiece(value, language, nativeTranslator) {
  if (!value.trim()) return value;
  if (nativeTranslator) return nativeTranslator.translate(value);
  const endpoint = new URL('https://api.mymemory.translated.net/get');
  endpoint.searchParams.set('q', value);
  endpoint.searchParams.set('langpair', `${language}|en`);
  const response = await fetch(endpoint);
  if (!response.ok) throw new Error('The translation service is unavailable. Try again later or paste English text.');
  const data = await response.json();
  if (Number(data.responseStatus) !== 200 || !data.responseData?.translatedText) throw new Error('The translation service could not translate this article.');
  const decoded = document.createElement('textarea');
  decoded.innerHTML = data.responseData.translatedText;
  return decoded.value;
}

export async function prepareManualArticle(headline, text, chosenLanguage = 'auto') {
  const originalHeadline = withoutTranslationMarker(headline);
  const language = detectManualLanguage(originalHeadline, text, chosenLanguage);
  if (language === 'en') return { title: originalHeadline, body: text.trim(), summary: manualSummary(text, originalHeadline), translated: false, originalHeadline: '' };
  let nativeTranslator = null;
  if (globalThis.Translator?.create) {
    try { nativeTranslator = await globalThis.Translator.create({ sourceLanguage: language, targetLanguage: 'en' }); }
    catch { /* Use the public translation fallback. */ }
  }
  try {
    const translatedHeadline = await translatePiece(originalHeadline, language, nativeTranslator);
    const translatedParts = [];
    for (const part of chunks(text)) translatedParts.push(await translatePiece(part, language, nativeTranslator));
    const translatedBody = translatedParts.join(' ')
      .replace(/\s*\n\s*/g, '\n\n').trim();
    const title = markTranslatedHeadline(translatedHeadline);
    return { title, body: translatedBody, summary: manualSummary(translatedBody, translatedHeadline), translated: true, originalHeadline };
  } finally { nativeTranslator?.destroy?.(); }
}
