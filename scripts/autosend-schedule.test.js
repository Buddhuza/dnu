import test from 'node:test';
import assert from 'node:assert/strict';
import { dueAutosendDate, viennaParts } from './autosend-schedule.js';
import { scheduledAutosendDecision } from './should-run-autosend.mjs';

test('the one-time 22:15 Vienna test is due only from its appointed minute', () => {
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:14:00Z')), '');
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:15:00Z')), '2026-11-20');
  assert.equal(dueAutosendDate(new Date('2026-11-20T21:20:00Z'), { '2026-11-20': 'email_submitted' }), '');
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
