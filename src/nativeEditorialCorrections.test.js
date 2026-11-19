import test from 'node:test';
import assert from 'node:assert/strict';
import { correctNativeEdition, expectedNativeDraft } from './nativeEditorialCorrections.js';

test('exact native correction rejects a different edition', () => {
  assert.throws(() => correctNativeEdition({ checkedAt: 'later', articles: [] }), /not the reviewed/);
  assert.throws(() => correctNativeEdition({ checkedAt: expectedNativeDraft, articles: [] }), /absent/);
});
