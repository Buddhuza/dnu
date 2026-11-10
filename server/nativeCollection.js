import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { editorEmail } from '../src/sharedEdition.js';
import { readCompletedEdition } from './nativeEdition.js';
import { collectionDataPath } from './dataDirectory.js';

let status = { state: 'idle' };

export function collectionStatus() { return status; }

export async function collectionStatusForClient(cwd) {
  try {
    const path = process.env.DNU_DATA_DIR ? collectionDataPath('native-collection-progress.json') : join(cwd, 'data/native-collection-progress.json');
    const saved = JSON.parse(await readFile(path, 'utf8'));
    if (status.state !== 'idle' && Date.parse(status.updatedAt || status.startedAt) > Date.parse(saved.updatedAt)) return status;
    if (saved.state === 'running' && Date.now() - Date.parse(saved.updatedAt) > 90 * 60_000)
      return { ...saved, state: 'failed', message: 'Collection stopped before completion. Run it again.' };
    if (Date.parse(saved.startedAt) >= Date.parse(status.startedAt || 0)) return saved;
  } catch { /* A new deployment may not have a collection status yet. */ }
  return status;
}

export async function authorisedEditor(authorization) {
  const token = String(authorization || '').match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && data.user?.email?.toLowerCase() === editorEmail;
}

export function startNativeCollection({ cwd, onComplete = () => {} }) {
  if (status.state === 'running') return status;
  status = { state: 'running', startedAt: new Date().toISOString(), message: 'Checking publisher sources…' };
  const env = { ...process.env };
  delete env.DNU_TEST_DOMAIN;
  const child = spawn(process.execPath, ['--use-env-proxy', 'collector/run.js'], { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const collect = chunk => { output = (output + chunk.toString()).slice(-6000); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('error', error => { status = { ...status, state: 'failed', updatedAt: new Date().toISOString(), message: error.message }; });
  child.on('close', code => {
    if (code === 0) {
      try {
        const edition = readCompletedEdition();
        status = { ...status, state: 'complete', updatedAt: new Date().toISOString(), checkedAt: edition.checkedAt, stories: edition.articles.length, message: `Draft ready: ${edition.articles.length} stories. Review before publishing.` };
        onComplete(edition);
      } catch (error) { status = { ...status, state: 'failed', updatedAt: new Date().toISOString(), message: error.message }; }
    } else status = { ...status, state: 'failed', updatedAt: new Date().toISOString(), message: `Collection failed; the previous edition is unchanged. ${output.slice(-500)}` };
  });
  return status;
}
