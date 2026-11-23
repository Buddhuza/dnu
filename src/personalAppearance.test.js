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
