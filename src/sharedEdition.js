import { createClient } from '@supabase/supabase-js';

const url = import.meta.env?.VITE_SUPABASE_URL;
const key = import.meta.env?.VITE_SUPABASE_ANON_KEY;
export const sharedClient = url && key ? createClient(url, key, {
  auth: { storageKey: 'dnu-editor-session', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
}) : null;

export const editorEmail = 'buddhuza@gmail.com';

export async function loadEditorProfile(user) {
  if (!sharedClient || !user?.id) return null;
  const { data, error } = await sharedClient.from('dnu_editors')
    .select('user_id,display_name,role,active').eq('user_id', user.id).maybeSingle();
  if (error) {
    // Keep the original editor usable until the one-time SQL migration runs.
    if (['PGRST205', '42P01'].includes(error.code) && user.email?.toLowerCase() === editorEmail)
      return { user_id: user.id, display_name: 'Buddhuza', role: 'owner', active: true };
    throw error;
  }
  return data?.active === true ? data : null;
}

export function sharedSettings(settings) {
  const { darkMode, ...published } = settings;
  return published;
}

export function sharedPayload(update, settings, excludedStoryIds, compiledAt) {
  return {
    update,
    settings: sharedSettings(settings),
    excluded_story_ids: [...excludedStoryIds].sort(),
    compiled_at: compiledAt
  };
}

export async function loadSharedEdition() {
  if (!sharedClient) return null;
  const { data, error } = await sharedClient.from('dnu_state')
    .select('revision,edition,settings,excluded_story_ids,compiled_at,updated_at')
    .eq('id', 'main').single();
  if (error) throw error;
  return data;
}

export async function publishSharedEdition(expectedRevision, payload, bodyChange = null) {
  if (!sharedClient) throw new Error('Shared DNU storage is not configured.');
  const { data, error } = await sharedClient.rpc('publish_dnu_state', {
    p_expected_revision: expectedRevision,
    p_update: payload.update,
    p_settings: payload.settings,
    p_excluded_story_ids: payload.excluded_story_ids,
    p_compiled_at: payload.compiled_at,
    p_bodies: bodyChange?.bodies || [],
    p_replace_bodies: bodyChange?.replace === true
  });
  if (error) throw error;
  if (data === null || data === undefined) throw new Error('The update changed in another session. Reload before saving again.');
  return Number(data);
}

export async function loadSharedBody(articleUrl) {
  if (!sharedClient) return null;
  const { data, error } = await sharedClient.from('dnu_bodies')
    .select('heading,body,translated').eq('url', articleUrl).maybeSingle();
  if (error) throw error;
  return data?.body ? data : null;
}
