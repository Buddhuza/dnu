import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dueAutosendDate, isAutosendDate, viennaParts } from './autosend-schedule.js';
import { scheduledAutosendDecision } from './should-run-autosend.mjs';
const holidays = JSON.parse(readFileSync(new URL('../data/autosend-holidays.json', import.meta.url), 'utf8'));

test('only the nine Vienna holidays in the 2027 staff circular are scheduled', () => {
  assert.deepEqual(holidays, [
    '2027-01-01', '2027-03-09', '2027-03-22', '2027-03-26', '2027-03-29',
    '2027-05-03', '2027-05-17', '2027-10-26', '2027-12-24'
  ]);
  for (const date of holidays) assert.equal(isAutosendDate(date, holidays), true);
  for (const otherOfficeHoliday of ['2027-01-06', '2027-03-10', '2027-05-06', '2027-07-05', '2027-11-01', '2027-12-27'])
    assert.equal(isAutosendDate(otherOfficeHoliday, holidays), false);
  const edge = readFileSync(new URL('../supabase/functions/schedule-dnu-autosend/index.ts', import.meta.url), 'utf8');
  const edgeList = edge.match(/const holidays = new Set\(\[([\s\S]*?)\]\);/)?.[1].match(/'\d{4}-\d{2}-\d{2}'/g)?.map(value => value.slice(1, -1));
  assert.deepEqual(edgeList, holidays, 'GitHub and Supabase recovery must have the same holiday dates');
});

test('2027 holidays become due at 08:00 Vienna time on both sides of daylight saving', () => {
  const completedBefore = date => {
    const completed = {};
    for (let day = new Date('2026-11-20T12:00:00Z'); day.toISOString().slice(0, 10) < date; day.setUTCDate(day.getUTCDate() + 1)) {
      const earlier = day.toISOString().slice(0, 10);
      if (isAutosendDate(earlier, holidays)) completed[earlier] = 'email_submitted';
    }
    return completed;
  };
  const january = completedBefore('2027-01-01');
  assert.equal(dueAutosendDate(new Date('2027-01-01T06:59:00Z'), january, holidays), '');
  assert.equal(dueAutosendDate(new Date('2027-01-01T07:00:00Z'), january, holidays), '2027-01-01');
  const may = completedBefore('2027-05-03');
  assert.equal(dueAutosendDate(new Date('2027-05-03T05:59:00Z'), may, holidays), '');
  assert.equal(dueAutosendDate(new Date('2027-05-03T06:00:00Z'), may, holidays), '2027-05-03');
});

test('the one-time 22:15 Vienna test is due only from its appointed minute', () => {
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:14:00Z')), '');
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:15:00Z')), '2026-11-20');
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:20:00Z'), { '2026-11-20': 'email_submitted' }), '');
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:59:00Z'), { '2026-11-20': 'email_submitted' }), '');
  assert.equal(dueAutosendDate(new Date('2026-11-20T22:00:00Z'), { '2026-11-20': 'email_submitted' }), '2026-11-20-2300');
  assert.equal(dueAutosendDate(new Date('2026-11-20T22:05:00Z'), { '2026-11-20': 'email_submitted', '2026-11-20-2300': 'email_submitted' }), '');
  assert.equal(dueAutosendDate(new Date('2026-11-21T07:00:00Z')), '2026-11-21');
});

test('weekend AUTOSEND follows Vienna daylight saving time and catches missed days', () => {
  const done = { '2026-11-20': 'email_submitted' };
  assert.equal(viennaParts(new Date('2026-11-21T06:59:00Z')).time, '07:59');
  assert.equal(dueAutosendDate(new Date('2026-11-21T06:59:00Z'), done), '');
  assert.equal(dueAutosendDate(new Date('2026-11-21T07:00:00Z'), done), '2026-11-21');
  assert.equal(dueAutosendDate(new Date('2026-11-22T08:00:00Z'), done), '2026-11-21');
  assert.equal(dueAutosendDate(new Date('2026-11-22T08:00:00Z'), { ...done, '2026-11-21': 'email_submitted' }), '2026-11-22');
  assert.equal(dueAutosendDate(new Date('2027-06-12T06:00:00Z'), { ...done, '2026-11-21': 'email_submitted' }), '2026-11-22');
});

test('already submitted scheduled date is skipped; manual request still runs', () => {
  const now = new Date('2026-11-21T07:05:00Z');
  const history = { '2026-11-20': 'email_submitted', '2026-11-21': 'email_submitted' };
  assert.deepEqual(scheduledAutosendDecision({ eventName: 'schedule', now, history }), { run: false, date: '' });
  assert.deepEqual(scheduledAutosendDecision({ eventName: 'workflow_dispatch', scheduledRun: false, now, history }), { run: true, date: '' });
});
