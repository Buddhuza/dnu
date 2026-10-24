export const TRANSLATION_MARKER = '(文A)';

export const withoutTranslationMarker = value => String(value ?? '').replace(/^\(文A\)\s*/, '').trim();

export const markTranslatedHeadline = value => `${TRANSLATION_MARKER} ${withoutTranslationMarker(value)}`;

export function articleJson(page) {
  try { return typeof page?.json === 'string' ? JSON.parse(page.json) : page?.json || {}; }
  catch { return {}; }
}
