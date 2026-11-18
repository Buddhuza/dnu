export const defaultGmailRecipients = ['buddhuza@gmail.com', 'ayabushady@gmail.com'];

const emailPattern = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/;

export function parseGmailRecipients(value) {
  const parts = (Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/))
    .map(item => String(item).trim().toLowerCase()).filter(Boolean);
  if (!parts.length) throw new Error('Add at least one recipient.');
  if (parts.length > 30) throw new Error('Use no more than 30 recipients.');
  if (parts.some(item => !emailPattern.test(item) || item.length > 254))
    throw new Error('Enter valid email addresses, one per line.');
  return [...new Set(parts)];
}

export function normalizedGmailRecipients(value) {
  try { return parseGmailRecipients(value); }
  catch { return [...defaultGmailRecipients]; }
}
