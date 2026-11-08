import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_GOOGLE_SHEET_URL, readGoogleSheetEdition } from '../src/googleSheetClient.js';
import { convertSpreadsheetRows } from '../src/spreadsheetImport.js';
import { defaultSiteConfig, displaySiteContent, extendSiteConfigForImportedPlacements, normalizeSiteConfig } from '../src/siteConfig.js';
import { emailSubject, emailUpdateHtml } from '../src/emailUpdate.js';
import { selectWeekendStories, viennaSchedule, weekendSheetReadiness } from '../src/weekendEdition.js';
import { resolveWeekendPlacementRows } from '../src/weekendPlacement.js';
import { viennaWallTimeToIso } from '../src/viennaTime.js';

const dryRun = process.argv.includes('--dry-run');
const publishOnly = process.argv.includes('--publish-only');
const sheetUrl = process.env.DNU_GOOGLE_SHEET_URL || DEFAULT_GOOGLE_SHEET_URL;
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const tenant = process.env.MS_TENANT_ID;
const appId = process.env.MS_CLIENT_ID;
const appSecret = process.env.MS_CLIENT_SECRET;
const sender = process.env.DNU_MAIL_FROM;
const recipients = [...new Set(String(process.env.DNU_MAIL_TO || '').split(/[,;\n]+/).map(value => value.trim()).filter(Boolean))];
const windowsDelivery = process.env.DNU_MAIL_DELIVERY === 'windows';
const graphConfigured = Boolean(tenant && appId && appSecret && sender && recipients.length);
const mailDelivery = publishOnly ? 'none' : windowsDelivery ? 'windows' : graphConfigured ? 'graph' : 'none';
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function requiredConfiguration() {
  if (dryRun) return;
  const required = { SUPABASE_URL: supabaseUrl, SUPABASE_SERVICE_ROLE_KEY: serviceKey };
  const missing = Object.entries(required).filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`Weekend automation is not active; missing configuration: ${missing.join(', ')}`);
  if (mailDelivery === 'graph' && !recipients.every(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))) throw new Error('DNU_MAIL_TO contains an invalid address.');
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

async function latestReady(date) {
  const sheet = await readGoogleSheetEdition(sheetUrl, date, googleTable);
  const readiness = weekendSheetReadiness(sheet, date);
  if (readiness === 'complete') return sheet;
  if (readiness !== 'verify-stable') throw new Error(`Today's worksheet is not ready (worksheet ${sheet.sheetName}, NewsStatus ${sheet.runStatus || 'unavailable'} ${sheet.statusDate || ''}).`);
  const clock = viennaSchedule();
  if (!dryRun && !publishOnly && clock.hour === 7 && clock.minute < 45) throw new Error('NewsStatus is unavailable; waiting until 07:45 Vienna time to verify a stable dated worksheet.');
  const fingerprint = value => createHash('sha256').update(JSON.stringify(value.rows.map(row => [row.url, row.heading, row.date]))).digest('hex');
  await sleep(60000);
  const repeat = await readGoogleSheetEdition(sheetUrl, date, googleTable);
  if (weekendSheetReadiness(repeat, date) === 'complete') return repeat;
  if (weekendSheetReadiness(repeat, date) !== 'verify-stable' || fingerprint(repeat) !== fingerprint(sheet)) throw new Error('Today’s dated worksheet is still changing or no longer readable.');
  console.log(`NewsStatus is unavailable; verified that the ${date} dated worksheet remained unchanged across two reads.`);
  return repeat;
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
if (!dryRun && (!now.weekend || !publishOnly && now.hour < 7)) {
  console.log('No action: this workflow slot is outside the Saturday or Sunday publication window.');
  process.exit(0);
}
let sheet;
let attempts = 0;
while (!sheet) {
  try { sheet = await latestReady(now.date); }
  catch (error) {
    attempts++;
    if (dryRun || publishOnly && attempts >= 3 || !publishOnly && Date.now() >= due + 3600_000) throw error;
    console.log(`Waiting for completed ${now.date} worksheet: ${error.message}`);
    await sleep(30000);
  }
}
const importedAt = new Date().toISOString();
const converted = resolveWeekendPlacementRows(sheet.rows, (rows, options = {}) => convertSpreadsheetRows(rows, { importedAt, ...options }));
const selection = selectWeekendStories(converted.articles);
if (!selection.articles.length) throw new Error('No publishable stories were found in the completed sheet.');
console.log(`Worksheet ${sheet.date}: ${sheet.rows.length} rows, ${converted.articles.length} eligible, ${converted.autoPlaced.length} automatically placed, ${selection.removed.length} duplicates removed, ${selection.articles.length} selected, ${converted.unplaced.length} still unplaced, ${converted.policyBlocked.length} blocked by placement policy, ${converted.skipped.length} otherwise rejected.`);
for (const item of converted.autoPlaced) console.log(`Auto placement: row ${item.row} ${item.title} → ${[item.placement.sectionId, item.placement.subsection, item.placement.country].filter(Boolean).join(' / ')}`);
for (const item of converted.unplaced) console.log(`Unplaced: row ${item.row} ${item.title}`);
for (const item of converted.policyBlocked) console.log(`Placement policy: row ${item.row} ${item.title} — ${item.reason}`);
for (const removed of selection.removed) console.log(`Duplicate: ${removed.article.sourceName} — ${removed.article.title} → kept ${removed.preferred.sourceName}`);
if (dryRun) process.exit(0);
const client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
let state = await readState(client);
if (state.edition?.weekendAutomation?.date === now.date) {
  console.log(`The ${now.date} weekend edition is already published. No duplicate publication or email was attempted.`);
  process.exit(0);
}
const selectedUrls = new Set(selection.articles.map(article => article.url));
const bodies = converted.bodies.filter(body => selectedUrls.has(body.url));
if (bodies.length) {
  const { error } = await client.from('dnu_bodies').upsert(bodies, { onConflict: 'url' });
  if (error) throw error;
}
const settings = extendSiteConfigForImportedPlacements(normalizeSiteConfig(state.settings, selection.articles), selection.articles);
const selectedIds = new Set(selection.articles.map(article => article.id));
const newSettings = {
  ...settings, customArticles: [],
  articleEdits: Object.fromEntries(Object.entries(settings.articleEdits).filter(([id]) => selectedIds.has(id))),
  articleOrder: settings.articleOrder.filter(id => selectedIds.has(id)),
  leadOrigins: Object.fromEntries(Object.entries(settings.leadOrigins).filter(([id]) => selectedIds.has(id)))
};
if (!displaySiteContent(selection.articles, newSettings, new Set()).length) throw new Error('Site settings hide all selected stories; no weekend edition or email was published.');
const edition = {
  title: 'DAILY NEWS UPDATE', checkedAt: new Date(Math.max(Date.now(), due)).toISOString(),
  windowStart: new Date(due - 24 * 3600_000).toISOString(), windowEnd: new Date(due).toISOString(),
  articles: selection.articles, sourceOutcomes: [],
  weekendAutomation: { date: now.date, status: mailDelivery === 'none' ? 'published' : 'prepared', delivery: mailDelivery, worksheet: sheet.sheetName }
};
await updateState(client, state, { edition, settings: newSettings, excluded_story_ids: [], compiled_at: edition.checkedAt });
console.log(`Published the ${now.date} weekend edition with ${edition.articles.length} stories.`);
if (mailDelivery !== 'graph') {
  if (mailDelivery === 'none') console.log('Email is not configured; the website edition was published without sending mail.');
  else console.log('Windows Outlook delivery is selected. The Windows task will send this prepared edition; Microsoft Graph was not called.');
  process.exit(0);
}
if (Date.now() >= due) {
  console.log('The website edition was published after 08:00 Vienna time; no late email was sent.');
  process.exit(0);
}
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
