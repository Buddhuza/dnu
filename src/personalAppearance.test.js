import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePersonalAppearance, withPersonalAppearance } from './personalAppearance.js';

test('personal appearance changes the rendered view without changing shared settings', () => {
  const shared = { darkMode: false, fontSize: 18, theme: { primary: '#285a78', text: '#203744' }, darkTheme: { primary: '#15222b' }, scopeInclude: 'security' };
  const personal = normalizePersonalAppearance({ darkMode: true, fontSize: 21, theme: { primary: '#112233' }, scopeInclude: 'anything', darkTheme: { headerTop: '#224466' } });
  const view = withPersonalAppearance(shared, personal);
  assert.equal(view.darkMode, true);
  assert.equal(view.fontSize, 21);
  assert.equal(view.theme.primary, '#112233');
  assert.equal(view.theme.text, '#203744');
  assert.equal(view.darkTheme.headerTop, '#224466');
  assert.equal(view.scopeInclude, 'security');
  assert.equal(shared.darkMode, false);
  assert.equal(shared.theme.primary, '#285a78');
});

test('personal appearance rejects unsupported fields and invalid colours', () => {
  assert.deepEqual(normalizePersonalAppearance({ theme: { primary: 'red; background:black' }, showUpdate: false }), {});
});

test('reading columns stay personal and are clamped to one through four', () => {
  const shared = { columnCount: 2, theme: {}, darkTheme: {} };
  assert.equal(withPersonalAppearance(shared, normalizePersonalAppearance({ columnCount: 4 })).columnCount, 4);
  assert.equal(shared.columnCount, 2);
  assert.equal(normalizePersonalAppearance({ columnCount: 0 }).columnCount, 1);
  assert.equal(normalizePersonalAppearance({ columnCount: 8 }).columnCount, 4);
});

test('personal spacing, heading size and link colour are bounded', () => {
  const appearance = normalizePersonalAppearance({ countryHeadingSize: 30, storyLineHeight: 1.25, storySpacing: 0, sectionSpacing: 25, theme: { link: '#123456', accent: '#abcdef' } });
  assert.deepEqual({ countryHeadingSize: appearance.countryHeadingSize, storyLineHeight: appearance.storyLineHeight, storySpacing: appearance.storySpacing, sectionSpacing: appearance.sectionSpacing }, { countryHeadingSize: 24, storyLineHeight: 1.25, storySpacing: 2, sectionSpacing: 25 });
  assert.equal(appearance.theme.link, '#123456');
  assert.equal(appearance.theme.accent, '#abcdef');
});
