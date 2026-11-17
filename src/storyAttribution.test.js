import test from 'node:test';
import assert from 'node:assert/strict';
import { contributorFromUser, contributorHue, storyAttributionStyle, storySourceLabel } from './storyAttribution.js';

test('owner remains purple and each editor has a stable distinct person colour', () => {
  const owner = contributorFromUser({ id: 'owner', editorProfile: { display_name: 'Buddhuza', role: 'owner' } });
  const editor = contributorFromUser({ id: 'colleague', editorProfile: { display_name: 'Colleague', role: 'editor' } });
  assert.equal(contributorHue(owner), 272);
  assert.notEqual(contributorHue(editor), contributorHue(owner));
  assert.equal(contributorHue(editor), contributorHue({ ...editor }));
});

test('add, import and scrape use progressively softer shades of the same person colour', () => {
  const person = { id: 'owner', name: 'Buddhuza', role: 'owner' };
  const article = { addedBy: person };
  const add = storyAttributionStyle(article, 'add');
  const imported = storyAttributionStyle(article, 'import');
  const scraped = storyAttributionStyle(article, 'scrape');
  assert.equal(add['--story-hue'], 272);
  assert.equal(imported['--story-hue'], 272);
  assert.equal(scraped['--story-hue'], 272);
  assert.ok(Number(add['--story-opacity']) > Number(imported['--story-opacity']));
  assert.ok(Number(imported['--story-opacity']) > Number(scraped['--story-opacity']));
  assert.equal(storySourceLabel('scrape'), 'Scrape');
});
