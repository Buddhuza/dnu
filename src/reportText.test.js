import test from 'node:test';
import assert from 'node:assert/strict';
import { reportStoryText, sentenceCaseHeadline } from './reportText.js';

test('title case becomes sentence case while geopolitical names and abbreviations remain capitalised', () => {
  assert.equal(sentenceCaseHeadline('Bulgaria Summons Russian Envoy Over New Black Sea Drone Attacks'), 'Bulgaria summons Russian envoy over new Black Sea drone attacks');
  assert.equal(sentenceCaseHeadline('EU Ambassador Announces EUR 38 Mln in New Projects for Georgia'), 'EU ambassador announces EUR 38 mln in new projects for Georgia');
});

test('translated headlines keep their marker in report text', () => {
  assert.equal(sentenceCaseHeadline('(文A) Government Discusses Security Cooperation'), '(文A) Government discusses security cooperation');
});

test('all caps introduction is normalised without turning pronouns into US', () => {
  assert.equal(sentenceCaseHeadline('IN BRIEF: FSB foils drone attack in Voronezh Region'), 'In brief: FSB foils drone attack in Voronezh region');
  assert.equal(sentenceCaseHeadline('VIDEO // European Commissioner: "Let us prepare"'), 'Video // European commissioner: "Let us prepare"');
});

test('report text places one period after the headline and summary', () => {
  assert.deepEqual(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy', summary: 'Seventeen nations are taking part' }), { headline: 'NATO begins annual nuclear exercise in Italy.', summary: 'Seventeen nations are taking part.' });
});

test('compressed view removes a trailing headline period', () => {
  assert.equal(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy.' }, true).headline, 'NATO begins annual nuclear exercise in Italy');
  assert.equal(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy' }, true).headline, 'NATO begins annual nuclear exercise in Italy');
});

test('OSCE name uses Organisation in displayed report text', () => {
  const text = reportStoryText({ title: 'Organization for Security and Co-operation in Europe meets', summary: 'The Organization for Security and Co-operation in Europe sent observers' });
  assert.match(text.headline, /Organisation for Security and Co-operation in Europe/);
  assert.match(text.summary, /Organisation for Security and Co-operation in Europe/);
});
