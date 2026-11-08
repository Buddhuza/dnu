export function excludedHeadlineReason(value, summary = '', url = '') {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'osce.org' || host.endsWith('.osce.org')) return 'OSCE website links are excluded';
  } catch { /* Some callers check headlines before they have a URL. */ }
  const headline = String(value || '').trim().replace(/^\(文A\)\s*/, '');
  const detail = `${headline} ${summary}`;
  if (/\blive\s*:/i.test(headline) || /^live(?:\s+updates?)?\s*[:|–-]/i.test(headline) || /\/(?:liveblog|live-blog|live-updates)(?:\/|$)/i.test(String(url))) return 'Live blogs are excluded';
  if (/^why\b/i.test(headline)) return 'Why headlines are excluded';
  if (/^interview\b/i.test(headline)) return 'Interview headlines are excluded';
  if (headline.includes('?')) return 'Question headlines are excluded';
  if (/\bMehriban Aliyeva\b/i.test(detail)) return 'Mehriban Aliyeva stories are excluded';
  if (/^(?:analysis|opinion|commentary|editorial|feature|in depth|explainer)\b/i.test(headline)) return 'Analysis, opinion and feature headlines are excluded';
  if (/^Energy Efficiency in the Western Balkans: Building Markets and Creating Jobs$/i.test(headline) || /^CESEC: Europe is spending enormous sums on high energy costs$/i.test(headline)) return 'Analytical article without a specific news development';
  if (/^US[\s-]+Israel[\s-]+Iran War$/i.test(headline)) return 'Topic page rather than a specific news article';
  if (/^[-–]\s*[\w.-]+\.[a-z]{2,}$/i.test(headline) || /^[-–]\s*[\w.-]+\s*\([\w .-]+\)\s*\d{1,2}\s+[A-Z][a-z]{2}\s+\d{2,4}$/i.test(headline)) return 'Source listing rather than a news article';
  if (/\bthe outsider who led\b/i.test(headline)) return 'Profile features are excluded';
  if (/^Critical developments ahead of\b/i.test(headline) && /\bshifting balances\b/i.test(headline)) return 'Broad analytical summit preview rather than a specific news development';
  if (/\b(?:experts?|analysts?)\s+(?:say|says|warn|warns|argue|argues|believe|believes)\b/i.test(headline)) return 'Expert commentary is excluded';
  if (/(?:^|:\s*)(?:experts?|analysts?)\s*$/i.test(headline)) return 'Expert commentary is excluded';
  if (/\b(?:food poisoning|poisoning of \d+ children)\b/i.test(detail) &&
      !/\b(?:terror\w*|attack|deliberate|intentional|targeted|politic\w*|government|minister|resign\w*|security)\b/i.test(headline)) return 'Routine public-health incident outside the security and political scope';
  if (/\b(?:flights?|airlines?|airports?)\b/i.test(headline) && !/\b(?:attack|bomb|terror\w*|war|conflict|sanction|military|security|diplomatic|government|minister|parliament|election|protest|border|airspace)\b/i.test(headline)) return 'Travel and airline business outside the security and political scope';
  if (/^(?:agenda of events|events calendar)\b/i.test(headline)) return 'Event calendars are not news articles';
  return '';
}
