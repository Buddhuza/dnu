import { appendFileSync, readFileSync } from 'node:fs';
import { collectionDecision } from '../collector/slots.js';

const statusPath = process.argv[2];
let status = null;
try { status = JSON.parse(readFileSync(statusPath, 'utf8')); }
catch { /* A missing status means no completed slot is known. */ }
let decision = collectionDecision(process.env.GITHUB_EVENT_NAME, process.env.GITHUB_EVENT_SCHEDULE,
  status?.lastCompletedSlot || '', new Date(), process.env.SCHEDULED_RECOVERY === 'true');
// The first 19:00 slot before this schedule was deployed was never due.
if (decision.scheduledSlot && decision.scheduledSlot < '2026-11-21T07:00 Europe/Vienna')
  decision = { run: false, scheduledSlot: '', recordSkip: false };
if (!process.env.GITHUB_OUTPUT) throw new Error('GitHub Actions output path is required.');
appendFileSync(process.env.GITHUB_OUTPUT,
  `run=${decision.run}\nrecord_skip=${decision.recordSkip}\nscheduled_slot=${decision.scheduledSlot}\n`);
console.log(decision.run ? `Collecting ${decision.scheduledSlot || 'manual draft'}`
  : decision.recordSkip ? `Slot ${decision.scheduledSlot} arrived after the next slot; recording a skipped attempt.`
    : 'No collection is due; the slot is already complete or this is a DST candidate.');
