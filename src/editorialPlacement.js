export function editorialPlacement(title) {
  const headline = String(title || '').trim();
  if (/^Tokayev outlines key areas of cooperation with Tajikistan\b/i.test(headline))
    return { sectionId: 'Central Asia', subsection: 'Kazakhstan', country: '' };
  if (/^(?:Rubio|Trump)\s+(?:says|teases)\b/i.test(headline) || /^French presidential candidate\b/i.test(headline)) {
    const country = /^French presidential candidate\b/i.test(headline) ? 'France' : 'United States';
    return { sectionId: 'Miscellaneous', subsection: country === 'France' ? 'WESTERN / CENTRAL EUROPE' : 'NORTH AMERICA', country };
  }
  if (/^Baku['’]s joy is Ankara['’]s pride\b/i.test(headline))
    return { sectionId: 'South Caucasus', subsection: 'Azerbaijan', country: '' };
  if (/\bKrakow shooting\b|\bshooting in Krakow\b/i.test(headline))
    return { sectionId: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'Poland' };
  return null;
}
