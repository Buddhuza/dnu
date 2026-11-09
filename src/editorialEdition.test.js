import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPublishedEdition } from './editorialEdition.js';

test('review removes excluded automatic stories and keeps agency and headline corrections', () => {
  const articles = [
    { id: 'bad', sourceName: 'World Bank', url: 'https://worldbank.org/news/a', title: 'Energy Efficiency in the Western Balkans: Building Markets and Creating Jobs', sectionId: 'South Eastern Europe', subsection: 'Albania' },
    { id: 'good', sourceName: 'vreme.com', url: 'https://vreme.com/story', title: '🔴 Serbian parliament approves new security agreement ⤵️', sectionId: 'South Eastern Europe', subsection: 'Serbia' },
    { id: 'president', sourceName: 'president.uz', url: 'https://president.uz/news/statement', title: 'President issues statement', sectionId: 'Central Asia', subsection: 'Uzbekistan' },
    { id: 'osce', sourceName: 'osce.org', url: 'https://osce.org/press-release', title: 'OSCE releases statement', sectionId: 'Miscellaneous', subsection: 'INTERNATIONAL ORGANISATIONS', country: 'OSCE' }
  ];
  const settings = { articleEdits: { bad: { summary: 'Old' } }, articleOrder: ['bad', 'good'], leadOrigins: { bad: { sectionId: 'South Eastern Europe' } } };
  const reviewed = reviewPublishedEdition({ articles }, settings);
  assert.deepEqual(reviewed.edition.articles.map(article => [article.id, article.sourceName, article.title]), [['good', 'Vreme', 'Serbian parliament approves new security agreement']]);
  assert.deepEqual(reviewed.settings.articleOrder, ['good']);
  assert.equal(reviewed.removed.length, 3);
});

test('an old Yahoo agency edit does not override an editor-attributed dpa article', () => {
  const article = { id: 'yahoo', sourceName: 'dpa', url: 'https://example.com/story', title: 'US military strikes cargo ship accused of violating Iran blockade', sectionId: 'Miscellaneous', subsection: 'NORTH AMERICA', country: 'United States' };
  const result = reviewPublishedEdition({ articles: [article] }, { articleEdits: { yahoo: { sourceName: 'Yahoo' } } });
  assert.equal(result.edition.articles[0].sourceName, 'dpa');
  assert.equal(result.settings.articleEdits.yahoo.sourceName, 'dpa');
});
