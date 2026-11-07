import { NEWS_SECTIONS, MISCELLANEOUS_COUNTRIES } from './newsSections.js';

const regionalSections = new Set(NEWS_SECTIONS.slice(1, 5).map(section => section.id));
const countryHeadings = new Set([
  ...NEWS_SECTIONS.slice(1, 5).flatMap(section => section.subsections),
  ...Object.entries(MISCELLANEOUS_COUNTRIES).filter(([subsection]) => subsection !== 'INTERNATIONAL ORGANISATIONS').flatMap(([, countries]) => countries)
]);

export function countCoveredCountries(articles) {
  const countries = new Set();
  for (const article of articles) {
    const section = article.sectionId || article.section;
    const country = regionalSections.has(section) ? article.subsection
      : section === 'Miscellaneous' && article.subsection !== 'INTERNATIONAL ORGANISATIONS' ? article.country
        : section === 'Lead stories' && countryHeadings.has(article.subsection) ? article.subsection : '';
    if (country) countries.add(country);
  }
  return countries.size;
}
