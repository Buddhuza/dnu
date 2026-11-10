import { readFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = new URL('../',import.meta.url);
const staged = new URL('data/native-pending.json',root);
const active = new URL('data/prepared-update.json',root);
const dateFormat = new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Vienna'});
const hourFormat = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Vienna',hour:'2-digit',hourCycle:'h23'});
const run = promisify(execFile);
let busy = false, retryAfter = 0;

async function readEdition(path) {
  try { return JSON.parse(await readFile(path,'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function tick() {
  if (busy || Date.now() < retryAfter) return;
  busy = true;
  try {
    const now = new Date(), today = dateFormat.format(now), hour = Number(hourFormat.format(now));
    if (hour < 1) return;
    let pending = await readEdition(staged);
    const current = await readEdition(active);
    const isToday = edition => edition?.nativeEdition && dateFormat.format(new Date(edition.checkedAt)) === today;
    if (!isToday(current) && !isToday(pending)) {
      const {stdout} = await run(process.execPath,['--use-env-proxy','collector/run.js','--stage'],{cwd:fileURLToPath(root)});
      console.log(stdout.trim());
      pending = await readEdition(staged);
    }
    const latest = await readEdition(active);
    if (pending && Number(hourFormat.format(new Date())) >= 5 &&
        (!latest?.nativeEdition || Date.parse(pending.checkedAt) > Date.parse(latest.checkedAt))) {
      await rename(staged,active);
      console.log('Released daily edition',pending.checkedAt);
    }
  } catch(error) {
    console.error(error.message);
    retryAfter = Date.now()+15*60_000;
  } finally { busy=false; }
}
await tick();
setInterval(tick,60_000);
