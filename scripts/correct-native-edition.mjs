import { createClient } from '@supabase/supabase-js';
import { correctNativeEdition } from '../src/nativeEditorialCorrections.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Shared edition publishing credentials are missing.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: state, error } = await client.from('dnu_state').select('revision,edition,settings').eq('id', 'main').single();
if (error) throw error;
const result = correctNativeEdition(state.edition, state.settings);
const { data: saved, error: saveError } = await client.from('dnu_state')
  .update({ edition: result.edition, settings: result.settings, revision: Number(state.revision) + 1, updated_at: new Date().toISOString() })
  .eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
if (saveError) throw saveError;
if (!saved) throw new Error('The shared edition changed during review; no correction was published.');
console.log(JSON.stringify({ result: 'published', revision: saved.revision, stories: result.edition.articles.length,
  removed: result.removed, moved: result.moved, checkedAt: result.edition.checkedAt }));
