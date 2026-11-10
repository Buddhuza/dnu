import { readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dueCollectionSlot } from './slots.js';

const root = new URL('../', import.meta.url);
const stateFile = new URL('data/native-schedule-state.json', root);
const progressFile = new URL('data/native-collection-progress.json', root);
const editionFile = new URL('data/prepared-update.json', root);
const run = promisify(execFile);
let busy = false;
let retryAfter = 0;

async function lastCompletedSlot() {
  try { return JSON.parse(await readFile(stateFile, 'utf8')).slot; }
  catch (error) { if (error.code === 'ENOENT') return ''; throw error; }
}

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

async function markCompleted(slot) {
  const temporary = new URL(`data/native-schedule-state.${process.pid}.tmp`, root);
  await writeFile(temporary, JSON.stringify({ slot, completedAt: new Date().toISOString() }));
  await rename(temporary, stateFile);
}

async function tick() {
  const slot = dueCollectionSlot();
  if (!slot || busy || Date.now() < retryAfter) return;
  busy = true;
  try {
    if (await lastCompletedSlot() === slot) return;
    const progress = await readJson(progressFile);
    if (progress?.state === 'running' && Date.now() - Date.parse(progress.updatedAt) < 90 * 60_000) return;
    const edition = await readJson(editionFile);
    if (edition?.nativeEdition && dueCollectionSlot(new Date(edition.checkedAt)) === slot) {
      await markCompleted(slot);
      return;
    }
    const { stdout } = await run(process.execPath, ['--use-env-proxy', 'collector/run.js'], {
      cwd: fileURLToPath(root), maxBuffer: 4 * 1024 * 1024
    });
    console.log(`${slot}: ${stdout.trim()}`);
    await markCompleted(slot);
  } catch (error) {
    console.error(`${slot}: ${error.message}`);
    retryAfter = Date.now() + 15 * 60_000;
  } finally { busy = false; }
}

await tick();
setInterval(tick, 60_000);
