// Supabase Auth signs in with email. These private-use addresses let editors
// enter short usernames without exposing real mailbox addresses in the UI.
export const editorAccounts = Object.freeze({
  lkhubulava: { email: 'buddhuza@gmail.com', name: 'lkhubulava', role: 'owner' },
  gjordan: { email: 'gjordan@accounts.dnu.invalid', name: 'Gregory Jordan', role: 'editor' },
  vnikolov: { email: 'vnikolov@accounts.dnu.invalid', name: 'Vladimir Nikolov', role: 'editor' },
  vjosifovic: { email: 'vjosifovic@accounts.dnu.invalid', name: 'Vladimir Josifovic', role: 'editor' },
  mristevski: { email: 'mristevski@accounts.dnu.invalid', name: 'Marjan Ristevski', role: 'editor' }
});

export function accountForUsername(value) {
  return editorAccounts[String(value || '').trim().toLowerCase()] || null;
}

export function usernameForEmail(value) {
  const email = String(value || '').toLowerCase();
  return Object.entries(editorAccounts).find(([, account]) => account.email === email)?.[0] || '';
}
