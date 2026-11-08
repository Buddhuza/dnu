import { reportShortDateLabel } from './reportDate.js';
import { viennaWallTimeToIso } from './viennaTime.js';

const months = new Map(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].map((month, index) => [month, index + 1]));

// The editor displays Vienna calendar dates without a time. Keep the article's
// original Vienna clock time when changing that date, so exports stay precise.
export function parseEditedArticleDate(value, original = '') {
  const raw = String(value || '').trim().replace(/\s+/g, ' ');
  if (Number.isFinite(Date.parse(original)) && raw === reportShortDateLabel(original)) return new Date(original).toISOString();
  let year, month, day;
  const shown = raw.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2}|\d{4})$/);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (shown) {
    day = Number(shown[1]); month = months.get(shown[2].slice(0, 3).toLowerCase());
    year = shown[3].length === 2 ? 2000 + Number(shown[3]) : Number(shown[3]);
  } else if (iso) {
    year = Number(iso[1]); month = Number(iso[2]); day = Number(iso[3]);
  } else return '';
  if (!month || year < 1900 || year > 2100 || day < 1 || day > 31) return '';
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return '';
  const clock = Number.isFinite(Date.parse(original)) ? Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(original)).map(part => [part.type, part.value])) : { hour: 12, minute: 0, second: 0 };
  const result = viennaWallTimeToIso(year, month, day, Number(clock.hour), Number(clock.minute), Number(clock.second));
  if (!result) return '';
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(new Date(result)).map(part => [part.type, part.value]));
  return Number(dateParts.year) === year && Number(dateParts.month) === month && Number(dateParts.day) === day ? result : '';
}
