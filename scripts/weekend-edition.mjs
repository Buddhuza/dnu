import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_GOOGLE_SHEET_URL, readGoogleSheetEdition } from '../src/googleSheetClient.js';
import { convertSpreadsheetRows } from '../src/spreadsheetImport.js';
import { defaultSiteConfig, displaySiteContent, normalizeSiteConfig } from '../src/siteConfig.js';
import { emailSubject, emailUpdateHtml } from '../src/emailUpdate.js';
import { selectWeekendStories, viennaSchedule } from '../src/weekendEdition.js';
import { viennaWallTimeToIso } from '../src/viennaTime.js';

const dryRun = process.argv.includes('--dry-run');
const sheetUrl = process.env.DNU_GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenant = process.env.MS_TENANT_ID;
const appId = process.env.MS_CLIENT_ID;
const appSecret = process.env.MS_CLIENT_SECRET;
const sender = process.env.DNU_MAIL_FROM;
const recipients = [...new Set(String(process.env.DNU_MAIL_TO || '').split(/[,;\n]+/).map(value => value.trim()).filter(Boolean))];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function requiredConfiguration() {
  if (dryRun) return;
  const missing = Object.entries({ SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey, MS_TENANT_ID: tenant, MS_CLIENT_ID: appId, MS_CLIENT_SECRET: appSecret, DNU_MAIL_FROM: sender, DNU_MAIL_TO: recipients.length }).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Weekend automation is not active; missing configuration: ${missing.join(', ')}`);
  if (!recipients.every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error('DNU_MAIL_TO contains an invalid address.');
}

function todayAndDue() {
  const now = viennaSchedule();
  const [year, month, day] = now.date.split('-').map(Number);
  return { now, due: Date.parse(viennaWallTimeToIso(year, month, day, 8, 0)) };
}

async function googleTable(id, sheet) {
  const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
  url.searchParams.set('sheet', sheet);
  url.searchParams.set('headers', '1');
  url.searchParams.set('tqx', 'out:json');
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Google worksheet ${sheet}: HTTP ${response.status}`);
  const payload = await response.text();
  const start = payload.indexOf('{'), end = payload.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`Google worksheet ${sheet}: invalid response`);
  const result = JSON.parse(payload.slice(start, end + 1));
  if (result.status !== 'ok' || !result.table) throw new Error(`Google worksheet ${sheet} is unavailable.`);
  return result.table;
}

async function latestComplete(date) {
  const sheet = await readGoogleSheetEdition(sheetUrl, date, googleTable);
  if (sheet.date !== date || sheet.sheetName !== date || sheet.runStatus !== 'COMPLETE' || sheet.statusDate !== date || !sheet.rows.length) {
    throw new Error(`Today's worksheet is not complete (worksheet ${sheet.sheetName}, NewsStatus ${sheet.runStatus || 'unavailable'} ${sheet.statusDate || ''}).`);
  }
  return sheet;
}

async function readState(client) {
  const { data, error } = await client.from('dnu_state').select('revision,edition,settings,excluded_story_ids').eq('id', 'main').single();
  if (error) throw error;
  return data;
}

async function updateState(client, state, fields) {
  const { data, error } = await client.from('dnu_state').update({ ...fields, revision: Number(state.revision) + 1, updated_at: new Date().toISOString() })
    .eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Shared edition changed during the weekend run; no email was sent.');
  return data.revision;
}

async function graphToken() {
  const body = new URLSearchParams({ client_id: appId, client_secret: appSecret, scope: 'https://graph.microsoft.com/.default', grant_type: 'client_credentials' });
  const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(30000)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(`Microsoft Graph sign-in failed: HTTP ${response.status}`);
  return result.access_token;
}

async function sendOutlook(edition, settings, token) {
  const articles = displaySiteContent(edition.articles, normalizeSiteConfig(settings, edition.articles), new Set());
  if (!articles.length) throw new Error('The published edition has no visible stories; email was not sent.');
  const logo = readFileSync(new URL('../public/osce-logo.png', import.meta.url)).toString('base64');
  const message = {
    subject: emailSubject(edition.checkedAt),
    body: { contentType: 'HTML', content: emailUpdateHtml({ title: settings.updateTitle || edition.title, compiledAt: edition.checkedAt, articles, logoUrl: 'cid:dnu-osce-logo' }) },
    toRecipients: recipients.map(address => ({ emailAddress: { address } })),
    attachments: [{ '@odata.type': '#microsoft.graph.fileAttachment', name: 'osce-logo.png', contentType: 'image/png', contentBytes: logo, isInline: true, contentId: 'dnu-osce-logo' }]
  };
  const response = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message, saveToSentItems: true }), signal: AbortSignal.timeout(30000)
  });
  if (response.status !== 202) throw new Error(`Microsoft Graph did not accept the email: HTTP ${response.status}`);
}

requiredConfiguration();
let { now, due } = todayAndDue();
if (!dryRun && (!now.weekend || now.hour !== 7)) {
  console.log('No action: this workflow slot is outside Saturday or Sunday at 07:00 Vienna time.');
  process.exit(0);
}
if (!dryRun && Date.now() >= due) throw new Error('The 08:00 Vienna deadline has passed; no late edition or email will be published.');
let sheet;
while (!sheet) {
  try { sheet = await latestComplete(now.date); }
  catch (error) {
    if (dryRun || Date.now() >= due - 120000) throw error;
    console.log(`Waiting for completed ${now.date} worksheet: ${error.message}`);
    await sleep(30000);
  }
}
const converted = convertSpreadsheetRows(sheet.rows, { importedAt: new Date().toISOString() });
const selection = selectWeekendStories(converted.articles);
if (!selection.articles.length) throw new Error('No publishable stories were found in the completed sheet.');
console.log(`Worksheet ${sheet.date}: ${sheet.rows.length} rows, ${converted.articles.length} eligible, ${selection.removed.length} duplicates removed, ${selection.articles.length} selected, ${converted.needsPlacement.length} needing placement, ${converted.skipped.length} rejected.`);
for (const removed of selection.removed) console.log(`Duplicate: ${removed.article.sourceName} — ${removed.article.title} → kept ${removed.preferred.sourceName}`);
if (dryRun) process.exit(0);
if (Date.now() >= due - 60000) throw new Error('The sheet was ready too late to prepare the edition before 08:00; no email was sent.');

const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let state = await readState(client);
if (state.edition?.weekendAutomation?.date === now.date) throw new Error('This weekend edition has already been prepared or sent; no duplicate email was sent.');
const selectedUrls = new Set(selection.articles.map(article => article.url));
const bodies = converted.bodies.filter(body => selectedUrls.has(body.url));
if (bodies.length) {
  const { error } = await client.from('dnu_bodies').upsert(bodies, { onConflict: 'url' });
  if (error) throw error;
}
const settings = normalizeSiteConfig(state.settings, selection.articles);
const selectedIds = new Set(selection.articles.map(article => article.id));
const newSettings = {
  ...settings, customArticles: [],
  articleEdits: Object.fromEntries(Object.entries(settings.articleEdits).filter(([id]) => selectedIds.has(id))),
  articleOrder: settings.articleOrder.filter(id => selectedIds.has(id)),
  leadOrigins: Object.fromEntries(Object.entries(settings.leadOrigins).filter(([id]) => selectedIds.has(id)))
};
if (!displaySiteContent(selection.articles, newSettings, new Set()).length) throw new Error('Site settings hide all selected stories; no weekend edition or email was published.');
const edition = {
  title: 'DAILY NEWS UPDATE', checkedAt: new Date(due).toISOString(),
  windowStart: new Date(due - 24 * 3600_000).toISOString(), windowEnd: new Date(due).toISOString(),
  articles: selection.articles, sourceOutcomes: [],
  weekendAutomation: { date: now.date, status: 'prepared', worksheet: sheet.sheetName }
};
await updateState(client, state, { edition, settings: newSettings, excluded_story_ids: [], compiled_at: edition.checkedAt });
console.log(`Published the ${now.date} weekend edition with ${edition.articles.length} stories.`);
const token = await graphToken();
state = await readState(client);
if (state.edition?.weekendAutomation?.date !== now.date || state.edition?.weekendAutomation?.status !== 'prepared') throw new Error('Edition changed before email sending; no email was sent.');
const sending = { ...state.edition, weekendAutomation: { ...state.edition.weekendAutomation, status: 'sending' } };
await updateState(client, state, { edition: sending });
const remaining = due - Date.now();
if (remaining > 0) await sleep(remaining);
if (Date.now() > due + 30000) throw new Error('The mail step missed the 08:00 window; edition published, email not sent.');
await sendOutlook(sending, state.settings, token);
state = await readState(client);
if (state.edition?.weekendAutomation?.date === now.date && state.edition?.weekendAutomation?.status === 'sending') {
  await updateState(client, state, { edition: { ...state.edition, weekendAutomation: { ...state.edition.weekendAutomation, status: 'accepted' } } });
}
console.log(`Microsoft Graph accepted the ${now.date} weekend email at ${new Date().toISOString()}.`);
