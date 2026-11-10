import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl } from './apiUrl.js';

test('the public site routes API requests to its configured HTTPS server', () => {
  const previous = globalThis.window;
  try {
    globalThis.window = { DNU_API_URL: 'https://dnu-node-api.onrender.com/' };
    assert.equal(apiUrl('/api/collection'), 'https://dnu-node-api.onrender.com/api/collection');
    globalThis.window.DNU_API_URL = 'http://untrusted.example';
    assert.throws(() => apiUrl('/api/collection'), /HTTPS/);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
