import { franc } from 'franc-min';

// A model sometimes copies the source-language paragraphs into translatedBody.
// Do not offer those paragraphs as an English full-text spreadsheet export.
export function verifiedTranslatedBody(value) {
  const body = Array.isArray(value) ? value.join('\n\n').trim() : String(value || '').trim();
  return body.length >= 80 && franc(body.slice(0, 2000)) === 'eng' ? body : '';
}
