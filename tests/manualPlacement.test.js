import test from 'node:test';
import assert from 'node:assert/strict';
import { addCustomArticleInConfig, defaultSiteConfig, displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';

const article = (id, sectionId, subsection, country = '') => ({ id, url: `https://example.com/${id}`, sourceId: 'manual', sourceName: 'Example', title: `Story ${id}`, summary: '', publishedAt: '2026-10-16T12:00:00Z', sectionId, subsection, country });

test('manual article can create a regional country and survives reload', () => {
  const config = addCustomArticleInConfig(defaultSiteConfig(), article('regional', 'South Eastern Europe', 'Greece'), { createSubsection: true });
  const restored = normalizeSiteConfig(JSON.parse(JSON.stringify(config)));
  assert.ok(restored.sections.find(section => section.id === 'South Eastern Europe').subsections.includes('Greece'));
  assert.equal(displaySiteContent([], restored)[0]?.subsection, 'Greece');
});

test('manual article can create a Miscellaneous subsection and organisation', () => {
  const config = addCustomArticleInConfig(defaultSiteConfig(), article('organisation', 'Miscellaneous', 'OTHER ORGANISATIONS', 'Council of Europe'), { createSubsection: true, createCountry: true });
  const restored = normalizeSiteConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored.customCountries['OTHER ORGANISATIONS'], ['Council of Europe']);
  assert.equal(displaySiteContent([], restored)[0]?.country, 'Council of Europe');
});

test('manual article can be placed under existing lead heading', () => {
  const config = addCustomArticleInConfig(defaultSiteConfig(), article('lead', 'Lead stories', 'Middle East'));
  assert.equal(displaySiteContent([], config)[0]?.sectionId, 'Lead stories');
});
