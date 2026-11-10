import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { editorEmail } from '../src/sharedEdition.js';
import { readCompletedEdition } from './nativeEdition.js';

let status = { state: 'idle' };

export function collectionStatus() { return status; }

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
  const child = spawn(process.execPath, ['--use-env-proxy', 'collector/run.js'], { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  const collect = chunk => { output = (output + chunk.toString()).slice(-6000); };
  child.stdout.on('data', collect);
  child.stderr.on('data', collect);
  child.on('error', error => { status = { state: 'failed', message: error.message }; });
  child.on('close', code => {
    if (code === 0) {
      try {
        const edition = readCompletedEdition();
        status = { state: 'complete', checkedAt: edition.checkedAt, stories: edition.articles.length, message: `Draft ready: ${edition.articles.length} stories. Review before publishing.` };
        onComplete(edition);
      } catch (error) { status = { state: 'failed', message: error.message }; }
    } else status = { state: 'failed', message: `Collection failed; the previous edition is unchanged. ${output.slice(-500)}` };
  });
  return status;
}
