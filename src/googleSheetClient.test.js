import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { DEFAULT_GOOGLE_SHEET_URL, googleSheetId, readGoogleSheetEdition } from './googleSheetClient.js';
import { convertSpreadsheetRows } from './spreadsheetImport.js';

const table = (headers, rows) => ({
  cols: headers.map(label => ({ label })),
  rows: rows.map(row => ({ c: row.map(value => value == null ? null : { v: value }) }))
});
const testNow = new Date('2026-11-03T12:00:00Z');

test('the configured Google link loads the completed dated sheet and its article cache', async () => {
  const url = 'https://apnews.com/article/ukraine-border-talks';
  const body = 'Officials will meet in Geneva next week to discuss border monitoring and prisoner exchanges.';
  const encoded = gzipSync(JSON.stringify({ items: [{ link: url, articleBody: body }] })).toString('base64');
  const id = googleSheetId(DEFAULT_GOOGLE_SHEET_URL);
  const calls = [];
  const query = async (sheetId, sheet) => {
    assert.equal(sheetId, id);
    calls.push(sheet);
    if (sheet === 'NewsStatus') return table(['Field', 'Value'], [['status', 'COMPLETE'], ['edition', 'Date(2026,10,3)']]);
    if (sheet === '2026-11-03') return table(['Date', 'Category', 'Headline', 'Source', 'Link', 'PublishedUTC', 'Country'], [
      ['2026-11-03', 'Eastern Europe', 'Ukraine and Russia hold border talks', 'AP', url, '2026-11-02T12:00:00Z', 'Ukraine']
    ]);
    if (sheet === 'NewsWork_B') return table(['RunID', 'Chunk', 'JSON'], [
      ['2026-11-03-run', 0, `gzip:${encoded}`], ['2026-11-03-run', 1, 'gzip:AAAA']
    ]);
    throw new Error('Unexpected sheet');
  };
  const result = await readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', query, testNow);
  assert.equal(result.date, '2026-11-03');
  assert.deepEqual(result.sheetNames.slice(0, 4), ['2026-11-03', '2026-11-03_Audit', '2026-11-02', '2026-11-02_Audit']);
  assert.deepEqual(calls, ['NewsStatus', '2026-11-03', 'NewsWork_B']);
  assert.equal(result.rows[0].body, body);
  const converted = convertSpreadsheetRows(result.rows);
  assert.equal(converted.articles.length, 1);
  assert.equal(converted.bodies[0].body, body);
});

test('Google import accepts a complete status with extra whitespace', async () => {
  const query = async (_id, sheet) => {
    if (sheet === 'NewsStatus') return table(['Field', 'Value'], [['status', ' COMPLETE '], ['edition', 'Date(2026,10,3)']]);
    if (sheet === '2026-11-03') return table(['Date', 'Headline', 'Source', 'Link'], [['2026-11-03', 'Ukraine security talks begin', 'AP', 'https://apnews.com/article/talks']]);
    return table(['RunID', 'Chunk', 'JSON'], []);
  };
  const result = await readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', query, testNow);
  assert.equal(result.date, '2026-11-03');
  assert.equal(result.rows.length, 1);
});

test('an active Google run offers the previous completed dated worksheet', async () => {
  const calls = [];
  const query = async (_id, sheet) => {
    calls.push(sheet);
    if (sheet === 'NewsStatus') return table(['Field', 'Value'], [['status', 'RUNNING'], ['edition', 'Date(2026,10,3)']]);
    if (sheet === '2026-11-02') return table(['Date', 'Headline', 'Source', 'Link'], [['2026-11-02', 'Ukraine security talks begin', 'AP', 'https://apnews.com/article/talks']]);
    return table(['RunID', 'Chunk', 'JSON'], []);
  };
  const result = await readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', query, testNow);
  assert.equal(result.date, '2026-11-02');
  assert.match(result.cacheWarning, /previous completed edition/);
  assert.deepEqual(calls, ['NewsStatus', '2026-11-02', 'NewsWork_B', 'NewsWork_A']);
});

test('Google import rejects non-Google links and gives a clear error when no finished date is readable', async () => {
  assert.equal(googleSheetId('https://docs.google.com.evil.example/spreadsheets/d/abc/edit'), '');
  await assert.rejects(readGoogleSheetEdition('https://example.com/sheet'), /Google Sheets link/);
  await assert.rejects(readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', async () => table(['Field', 'Value'], [
    ['status', 'RUNNING'], ['edition', 'Date(2026,10,3)']
  ]), testNow), /No recent dated news worksheet/);
});

test('Google import finds a dated news tab when NewsStatus returns an unrelated table', async () => {
  const calls = [];
  const query = async (_id, sheet) => {
    calls.push(sheet);
    if (sheet === 'NewsStatus') return table(['Old', 'Table'], [['unrelated', 'value']]);
    if (sheet === '2026-11-03') return table(['Date', 'Headline', 'Source', 'Link'], [
      ['2026-11-03', 'Ukraine security talks begin', 'AP', 'https://apnews.com/article/talks']
    ]);
    return table(['RunID', 'Chunk', 'JSON'], []);
  };
  const result = await readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', query, testNow);
  assert.equal(result.date, '2026-11-03');
  assert.equal(result.rows[0].heading, 'Ukraine security talks begin');
  assert.doesNotMatch(result.cacheWarning, /NewsStatus/);
  assert.deepEqual(calls, ['NewsStatus', '2026-11-03', 'NewsWork_B', 'NewsWork_A']);
});

test('Google Sources tab can be inspected by exact name but stays out of the menu', async () => {
  const query = async (_id, sheet) => {
    if (sheet === 'NewsStatus') return table(['Field', 'Value'], [['status', 'COMPLETE'], ['edition', 'Date(2026,10,3)']]);
    if (sheet === '2026-11-03') return table(['Date', 'Headline', 'Source', 'Link'], [
      ['2026-11-03', 'Ukraine security talks begin', 'AP', 'https://apnews.com/article/talks']
    ]);
    if (sheet === '2026-11-03_Sources') return table(['Source', 'Status', 'FeedItems'], [['AP', 'ok', 20]]);
    throw new Error('Unexpected tab');
  };
  const result = await readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '2026-11-03_Sources', query, testNow);
  assert.equal(result.sheetName, '2026-11-03_Sources');
  assert.equal(result.rows.length, 0);
  assert.deepEqual(result.tablePreview, [['Source', 'Status', 'FeedItems'], ['AP', 'ok', '20']]);
  assert.ok(result.sheetNames.includes('NewsStatus'));
  assert.ok(!result.sheetNames.some(name => /(?:^|_)(?:Sources|Rejected)$/i.test(name)));
});

test('Google import rejects a different worksheet served under a dated tab name', async () => {
  const query = async (_id, sheet) => sheet === 'NewsStatus'
    ? table(['Old', 'Table'], [['unrelated', 'value']])
    : table(['Date', 'Headline', 'Source', 'Link'], [['2025-01-01', 'Old headline', 'AP', 'https://apnews.com/article/old']]);
  await assert.rejects(readGoogleSheetEdition(DEFAULT_GOOGLE_SHEET_URL, '', query, testNow), /No recent dated news worksheet/);
});
