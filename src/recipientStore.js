import { parseGmailRecipients } from './gmailRecipients.js';

export async function loadSelectedRecipients(client) {
  const { data, error } = await client.from('dnu_address_book').select('email').eq('selected', true).order('email').limit(401);
  if (error) throw error;
  return (data || []).map(item => item.email);
}

export async function saveSelectedRecipients(client, recipients) {
  const emails = parseGmailRecipients(recipients);
  const { data, error } = await client.rpc('set_dnu_recipients', { p_emails: emails });
  if (error) throw error;
  return data;
}
