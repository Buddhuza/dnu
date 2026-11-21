import { createClient } from '@supabase/supabase-js';

const projectUrl = 'https://epghsyajgspcywqqbfso.supabase.co';

async function publishingKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  if (!process.env.SUPABASE_ACCESS_TOKEN) return '';
  const response = await fetch('https://api.supabase.com/v1/projects/epghsyajgspcywqqbfso/api-keys', {
    headers: { authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` }, signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`Supabase key lookup failed (HTTP ${response.status})`);
  return (await response.json()).find(item => item.name === 'service_role')?.api_key || '';
}

export async function loadEditorialLearning() {
  const key = await publishingKey();
  if (!key) return [];
  const configuredUrl = process.env.SUPABASE_URL;
  const url = /^https:\/\/[^/]+\.supabase\.co\/?$/.test(configuredUrl || '') ? configuredUrl : projectUrl;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from('dnu_state').select('settings').eq('id', 'main').single();
  if (error) throw error;
  return Array.isArray(data?.settings?.editorialLearning) ? data.settings.editorialLearning : [];
}
