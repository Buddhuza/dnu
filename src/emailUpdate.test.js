import test from 'node:test';
import assert from 'node:assert/strict';
import { emailSubject, emailUpdateHtml, emailUpdateText } from './emailUpdate.js';

const article = { section: 'Miscellaneous', subsection: 'WESTERN / CENTRAL EUROPE', country: 'France', title: 'EU leaders discuss security talks', summary: 'Ministers agreed to meet in Paris.', sourceName: 'Example News', url: 'https://example.com/story?a=1&b=2' };
const options = { title: 'DAILY NEWS UPDATE', compiledAt: '2026-10-15T22:30:00Z', articles: [article] };

test('email subject uses the Vienna compilation date with a two-digit day', () => {
  assert.equal(emailSubject(options.compiledAt), 'OSCE SITROOM DAILY NEWS UPDATE, 16 October 2026');
});

test('formatted email follows Word headings, source links, and disclaimer', () => {
  const html = emailUpdateHtml({ ...options, logoUrl: 'https://example.com/osce-logo.png' });
  assert.match(html, /<img src="https:\/\/example.com\/osce-logo.png" alt="OSCE"/);
  assert.match(html, /Organization for Security and Co-operation in Europe/);
  assert.match(html, /WESTERN \/ CENTRAL EUROPE/);
  assert.match(html, /background-color:#d9e2f3[^>]*>FRANCE/);
  assert.match(html, /href="https:\/\/example.com\/story\?a=1&amp;b=2"/);
  assert.match(html, /<strong>EU leaders discuss security talks\.<\/strong> Ministers agreed to meet in Paris\./);
  assert.match(html, /Disclaimer:/);
  assert.doesNotMatch(emailUpdateHtml({ ...options, headlineOnly: true }), /Ministers agreed to meet/);
  assert.doesNotMatch(emailUpdateText({ ...options, headlineOnly: true }), /Ministers agreed to meet/);
});
