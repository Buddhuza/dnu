export function excludedHeadlineReason(value) {
  const headline = String(value || '').trim().replace(/^\(文A\)\s*/, '');
  if (headline.includes('?')) return 'Question headlines are excluded';
  if (/^(?:analysis|opinion|commentary|editorial|feature|in depth|explainer)\b/i.test(headline)) return 'Analysis, opinion and feature headlines are excluded';
  if (/(?:^|:\s*)(?:experts?|analysts?)\s*$/i.test(headline)) return 'Expert commentary is excluded';
  if (/\b(?:flights?|airlines?|airports?)\b/i.test(headline) && !/\b(?:attack|bomb|terror\w*|war|conflict|sanction|military|security|diplomatic|government|minister|parliament|election|protest|border|airspace)\b/i.test(headline)) return 'Travel and airline business outside the security and political scope';
  if (/^(?:agenda of events|events calendar)\b/i.test(headline)) return 'Event calendars are not news articles';
  return '';
}
