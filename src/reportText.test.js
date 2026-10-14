import test from 'node:test';
import assert from 'node:assert/strict';
import { reportStoryText, sentenceCaseHeadline } from './reportText.js';

test('title case becomes sentence case while geopolitical names and abbreviations remain capitalised', () => {
  assert.equal(sentenceCaseHeadline('Bulgaria Summons Russian Envoy Over New Black Sea Drone Attacks'), 'Bulgaria summons Russian envoy over new Black Sea drone attacks');
  assert.equal(sentenceCaseHeadline('EU Ambassador Announces EUR 38 Mln in New Projects for Georgia'), 'EU ambassador announces EUR 38 mln in new projects for Georgia');
});

test('all caps introduction is normalised without turning pronouns into US', () => {
  assert.equal(sentenceCaseHeadline('IN BRIEF: FSB foils drone attack in Voronezh Region'), 'In brief: FSB foils drone attack in Voronezh region');
  assert.equal(sentenceCaseHeadline('VIDEO // European Commissioner: "Let us prepare"'), 'Video // European commissioner: "Let us prepare"');
});

test('report text places one period after the headline and summary', () => {
  assert.deepEqual(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy', summary: 'Seventeen nations are taking part' }), { headline: 'NATO begins annual nuclear exercise in Italy.', summary: 'Seventeen nations are taking part.' });
});
