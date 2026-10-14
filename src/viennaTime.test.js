import test from 'node:test';
import assert from 'node:assert/strict';
import { formatViennaCompactDateTime } from './viennaTime.js';

test('compact article times follow Vienna daylight and standard time', () => {
  assert.equal(formatViennaCompactDateTime('2026-10-14T18:07:00Z'), '14.10.2026 20:07');
  assert.equal(formatViennaCompactDateTime('2026-01-14T18:07:00Z'), '14.01.2026 19:07');
  assert.equal(formatViennaCompactDateTime('2026-10-14T21:59:00Z'), '14.10.2026 23:59');
  assert.equal(formatViennaCompactDateTime('invalid'), '');
});
