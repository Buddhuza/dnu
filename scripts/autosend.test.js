import test from 'node:test';
import assert from 'node:assert/strict';
import { autosendEdition } from './autosend.mjs';

const draft = {
  nativeEdition: true, checkedAt: '2026-11-19T19:51:51Z', windowStart: '2026-11-18T19:51:51Z',
  articles: [{ id: 'new-story', url: 'https://example.com/new', title: 'New story', section: 'Eastern Europe', subsection: 'Ukraine', body: 'Full article text' }]
};
const status = { runId: 123, checkedAt: draft.checkedAt, stories: 1 };

test('autosend replaces old stories and edits while retaining section settings and the address book', () => {
  const { edition, settings, bodies } = autosendEdition(draft, status, {
    gmailRecipients: ['editor@example.com'], customArticles: [{ id: 'old' }], articleEdits: { old: { title: 'Old' } },
    articleOrder: ['old'], sections: ['Eastern Europe'], customCountries: { 'Eastern Europe': ['Ukraine'] },
    editorialLearning: [{ action: 'reject', title: 'Old story', sourceName: 'BBC', url: 'https://example.com/old' }]
  });
  assert.deepEqual(edition.articles.map(item => item.id), ['new-story']);
  assert.equal(edition.articles[0].body, undefined);
  assert.deepEqual(settings.customArticles, []);
  assert.equal(Object.keys(settings.articleEdits).length, 0);
  assert.deepEqual(settings.articleOrder, []);
  assert.deepEqual(settings.gmailRecipients, ['editor@example.com']);
  assert.equal(settings.editorialLearning[0].title, 'Old story');
  assert.equal(bodies[0].body, 'Full article text');
});

test('autosend rejects a missing or mismatched latest scrape before clearing anything', () => {
  assert.throws(() => autosendEdition(draft, { ...status, checkedAt: '2026-11-18T00:00:00Z' }, {}), /not changed/);
  assert.throws(() => autosendEdition({ ...draft, articles: [] }, status, {}), /not changed/);
});

test('scheduled AUTOSEND requires a scrape from the due Vienna date or later', () => {
  assert.throws(() => autosendEdition(draft, status, {}, '2026-11-20'), /older than 2026-11-20 in Vienna/);
  const fresh = { ...draft, checkedAt: '2026-11-19T23:05:00Z' };
  assert.equal(autosendEdition(fresh, { ...status, checkedAt: fresh.checkedAt }, {}, '2026-11-20').edition.articles.length, 1);
});

test('autosend promotes two suitable Ukraine stories from an older draft with no leads', () => {
  const ukraine = { sectionId: 'Eastern Europe', section: 'Eastern Europe', subsection: 'Ukraine', country: '', publishedAt: draft.checkedAt, sourceName: 'Reuters' };
  const updated = { ...draft, articles: [
    { ...ukraine, id: 'talks', title: 'Russia agrees security guarantees for Ukraine', url: 'https://reuters.com/talks' },
    { ...ukraine, id: 'strike', title: 'Russian missile strikes hit Kyiv', url: 'https://reuters.com/strike' }
  ] };
  const result = autosendEdition(updated, { ...status, stories: 2 }, {});
  assert.equal(result.edition.articles.filter(article => article.sectionId === 'Lead stories').length, 2);
  assert.deepEqual(Object.keys(result.settings.leadOrigins), ['talks', 'strike']);
});
