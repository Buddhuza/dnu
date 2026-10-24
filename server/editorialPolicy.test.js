import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialScore, isEnglishArticle, isEnglishListingText, passesSourcePolicy } from './editorialPolicy.js';

test('English-language checks reject Cyrillic listings and non-English article metadata', () => {
  assert.equal(isEnglishListingText('В ФРГ задержали третьего подозреваемого', 'Задержанная в Берлине женщина подозревается в поджоге'), false);
  assert.equal(isEnglishListingText('OSCE chair to visit Armenia', 'The foreign minister will discuss the peace process.'), true);
  assert.equal(isEnglishArticle({ data: { metadata: { language: 'fr-FR' } } }, 'OSCE chair to visit Armenia', 'The minister will discuss the peace process.'), false);
  assert.equal(isEnglishArticle({ data: { metadata: {} } }, 'Правительство обсудило безопасность', 'The government discussed international security cooperation.'), false);
  assert.equal(isEnglishArticle({ data: { metadata: { ogLocale: 'sq_AL' }, markdown: 'The government and parliament held talks on security cooperation with neighboring countries. '.repeat(12) } }, 'Kosovo asks US to restart talks', 'Officials discussed their commitments to the Serb minority.'), true);
});

test('Russian outlets are limited to Russia-focused English articles', () => {
  const tass = { id: 'source-97' };
  assert.equal(passesSourcePolicy(tass, 'Russia to cooperate with ASEAN on marine security', 'Lavrov held talks in Moscow.'), true);
  assert.equal(passesSourcePolicy(tass, 'Ukraine rejects ceasefire offer after attacks', 'Russian officials spoke in Moscow.'), false);
  assert.equal(passesSourcePolicy({ id: 'source-1' }, 'Ukraine rejects ceasefire offer after attacks', 'Russian officials spoke in Moscow.'), true);
});

test('OSCE and international cooperation rank ahead of local politics', () => {
  assert.ok(editorialScore('OSCE chair to visit Armenia') > editorialScore('Mayoral party wins local election'));
  assert.ok(editorialScore('Armenia and Azerbaijan hold peace talks') > editorialScore('Mayoral party wins local election'));
});

test('question, analysis and opinion headlines are excluded before article scraping', () => {
  const source = { id: 'source-1' };
  const summary = 'Officials discussed security cooperation between the governments.';
  assert.equal(passesSourcePolicy(source, 'Ukraine seeks new security agreement?', summary), false);
  assert.equal(passesSourcePolicy(source, 'Analysis: Ukraine seeks new security agreement', summary), false);
  assert.equal(passesSourcePolicy(source, 'Opinion | Ukraine seeks new security agreement', summary), false);
  assert.equal(passesSourcePolicy(source, 'Feature: How a lawmaker sees Albania’s protests', summary), false);
  assert.equal(passesSourcePolicy(source, 'Tougher security response won’t solve Albania’s crisis: Experts', summary), false);
  assert.equal(passesSourcePolicy(source, 'Calls for more Algarve flights following Lufthansa’s TAP deal', summary), false);
  assert.equal(passesSourcePolicy(source, 'Ukraine seeks new security agreement', summary), true);
});
