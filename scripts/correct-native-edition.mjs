import { createClient } from '@supabase/supabase-js';
import { correctNativeEdition } from '../src/nativeEditorialCorrections.js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Shared edition publishing credentials are missing.');
const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: state, error } = await client.from('dnu_state').select('revision,edition,settings').eq('id', 'main').single();
if (error) throw error;
console.log(JSON.stringify({ currentEdition: { revision: state.revision, checkedAt: state.edition?.checkedAt || null,
  nativeEdition: state.edition?.nativeEdition || false, stories: state.edition?.articles?.length || 0,
  customStories: state.settings?.customArticles?.length || 0, emptyPrepared: state.edition?.emptyPrepared || false,
  reviewedIdsPresent: state.edition?.articles?.filter(article => ['5c436006', '7673b6cf', 'e8f664ab', 'f6dbe806'].includes(article.id)).map(article => article.id) || [],
  reviewedCustomIdsPresent: state.settings?.customArticles?.filter(article => ['5c436006', '7673b6cf', 'e8f664ab', 'f6dbe806'].includes(article.id)).map(article => article.id) || [] } }));
const result = correctNativeEdition(state.edition, state.settings);
const { data: saved, error: saveError } = await client.from('dnu_state')
  .update({ edition: result.edition, settings: result.settings, revision: Number(state.revision) + 1, updated_at: new Date().toISOString() })
  .eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
if (saveError) throw saveError;
if (!saved) throw new Error('The shared edition changed during review; no correction was published.');
console.log(JSON.stringify({ result: 'published', revision: saved.revision, stories: result.edition.articles.length,
  removed: result.removed, moved: result.moved, checkedAt: result.edition.checkedAt }));
