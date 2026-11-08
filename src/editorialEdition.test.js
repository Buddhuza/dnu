import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewPublishedEdition } from './editorialEdition.js';

test('review removes excluded automatic stories and keeps agency and headline corrections', () => {
  const articles = [
    { id: 'bad', sourceName: 'World Bank', url: 'https://worldbank.org/news/a', title: 'Energy Efficiency in the Western Balkans: Building Markets and Creating Jobs', sectionId: 'South Eastern Europe', subsection: 'Albania' },
    { id: 'good', sourceName: 'vreme.com', url: 'https://vreme.com/story', title: '🔴 Serbian parliament approves new security agreement ⤵️', sectionId: 'South Eastern Europe', subsection: 'Serbia' }
  ];
  const settings = { articleEdits: { bad: { summary: 'Old' } }, articleOrder: ['bad', 'good'], leadOrigins: { bad: { sectionId: 'South Eastern Europe' } } };
  const reviewed = reviewPublishedEdition({ articles }, settings);
  assert.deepEqual(reviewed.edition.articles.map(article => [article.id, article.sourceName, article.title]), [['good', 'Vreme', 'Serbian parliament approves new security agreement']]);
  assert.deepEqual(reviewed.settings.articleOrder, ['good']);
  assert.equal(reviewed.removed.length, 1);
});
