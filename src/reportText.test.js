import test from 'node:test';
import assert from 'node:assert/strict';
import { reportStoryText, sentenceCaseHeadline } from './reportText.js';

test('mixed and title case headlines keep publisher capitalisation', () => {
  assert.equal(sentenceCaseHeadline('Bulgaria Summons Russian Envoy Over New Black Sea Drone Attacks'), 'Bulgaria Summons Russian Envoy Over New Black Sea Drone Attacks');
  assert.equal(sentenceCaseHeadline('EU Ambassador Announces EUR 38 Mln in New Projects for Georgia'), 'EU Ambassador Announces EUR 38 Mln in New Projects for Georgia');
});

test('translated headlines keep their marker in report text', () => {
  assert.equal(sentenceCaseHeadline('(文A) Government Discusses Security Cooperation'), '(文A) Government Discusses Security Cooperation');
});

test('only a fully all-caps headline is normalised', () => {
  assert.equal(sentenceCaseHeadline('IN BRIEF: FSB foils drone attack in Voronezh Region'), 'IN BRIEF: FSB foils drone attack in Voronezh Region');
  assert.equal(sentenceCaseHeadline('VIDEO // European Commissioner: "Let us prepare"'), 'VIDEO // European Commissioner: "Let us prepare"');
  assert.equal(sentenceCaseHeadline('IRAN AND THE US HOLD TALKS IN GENEVA'), 'Iran and the US hold talks in Geneva');
});

test('report text places one period after the headline and summary', () => {
  assert.deepEqual(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy', summary: 'Seventeen nations are taking part' }), { headline: 'NATO Begins Annual Nuclear Exercise in Italy.', summary: 'Seventeen nations are taking part.' });
});

test('compressed view removes a trailing headline period', () => {
  assert.equal(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy.' }, true).headline, 'NATO Begins Annual Nuclear Exercise in Italy');
  assert.equal(reportStoryText({ title: 'NATO Begins Annual Nuclear Exercise in Italy' }, true).headline, 'NATO Begins Annual Nuclear Exercise in Italy');
});

test('OSCE name uses Organisation in displayed report text', () => {
  const text = reportStoryText({ title: 'Organization for Security and Co-operation in Europe meets', summary: 'The Organization for Security and Co-operation in Europe sent observers' });
  assert.match(text.headline, /Organisation for Security and Co-operation in Europe/);
  assert.match(text.summary, /Organisation for Security and Co-operation in Europe/);
});
