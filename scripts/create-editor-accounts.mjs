import { createClient } from '@supabase/supabase-js';
import { editorAccounts } from '../src/editorAccounts.js';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const temporaryPassword = process.env.DNU_TEMP_PASSWORD;
if (!url || !serviceKey || !temporaryPassword) {
  throw new Error('Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DNU_TEMP_PASSWORD in the local environment. Never put them in the website build.');
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = Object.entries(editorAccounts).filter(([, account]) => account.role === 'editor');

async function existingUser(email) {
  for (let page = 1; page < 100; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const user = data.users.find(item => item.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 1000) return null;
  }
  throw new Error('Could not finish checking existing accounts.');
}

for (const [username, account] of accounts) {
  let user = await existingUser(account.email);
  let created = false;
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: account.email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: { display_name: account.name }
    });
    if (error) throw new Error(`${username}: ${error.message}. If Supabase rejects the temporary password, use a longer one permitted by the project's password policy.`);
    user = data.user;
    created = true;
  }
  const { error } = await admin.from('dnu_editors').upsert({
    user_id: user.id, username, display_name: account.name, role: 'editor', active: true
  }, { onConflict: 'user_id' });
  if (error) throw new Error(`${username}: account ${created ? 'created' : 'found'}, but editor access could not be saved: ${error.message}`);
  console.log(`${username}: ${created ? 'created' : 'already existed; existing password unchanged'} and editor access enabled`);
}
