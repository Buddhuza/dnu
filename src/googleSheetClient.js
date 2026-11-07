import { articleBodiesFromWorkData, inflateWorkJson, spreadsheetRowsFromGrid } from './spreadsheetImport.js';

export const DEFAULT_GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1DKd-UpEzx6P7RSWPOo_bY-LDzGkLY3EjIebVJhk4q2Y/edit';

export function googleSheetId(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return '';
    return url.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/)?.[1] || '';
  } catch { return ''; }
}

function googleTable(id, sheet) {
  return new Promise((resolve, reject) => {
    const callback = `__dnu_google_sheet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const url = new URL(`https://docs.google.com/spreadsheets/d/${id}/gviz/tq`);
    url.searchParams.set('sheet', sheet);
    url.searchParams.set('headers', '1');
    url.searchParams.set('tqx', `out:json;responseHandler:${callback}`);
    url.searchParams.set('_', String(Date.now()));
    const script = document.createElement('script');
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.remove();
      delete window[callback];
      if (error) reject(error); else resolve(value);
    };
    window[callback] = response => {
      if (response?.status !== 'ok' || !response.table) {
        finish(new Error(`Google could not read the “${sheet}” worksheet. Check that the sheet is shared with viewers.`));
      } else finish(null, response.table);
    };
    script.onerror = () => finish(new Error('Google Sheet could not be loaded. Check the link and viewer access, then try again.'));
    script.onload = () => setTimeout(() => {
      if (!settled) finish(new Error('Google did not return sheet data. Check that the sheet is shared with viewers.'));
    }, 1000);
    const timer = setTimeout(() => finish(new Error('Google Sheet took too long to respond. Try again.')), 30000);
    script.src = url.href;
    document.head.appendChild(script);
  });
}

function cellText(cell) {
  if (!cell) return '';
  const value = cell.v;
  if (value == null) return '';
  if (typeof value === 'string' && /^Date\(/.test(value)) return editionDate(value) || cell.f || value;
  return String(value);
}

export function googleTableGrid(table) {
  return [table.cols.map(column => column.label || column.id || ''),
    ...table.rows.map(row => (row.c || []).map(cellText))];
}

function editionDate(value) {
  const raw = String(value || '').trim();
  const googleDate = raw.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})/);
  if (googleDate) return `${googleDate[1]}-${String(Number(googleDate[2]) + 1).padStart(2, '0')}-${googleDate[3].padStart(2, '0')}`;
  const iso = raw.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return iso[0];
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : '';
}

function priorDate(date, days) {
  const instant = new Date(`${date}T12:00:00Z`);
  instant.setUTCDate(instant.getUTCDate() - days);
  return instant.toISOString().slice(0, 10);
}

function todayInVienna(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Vienna', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function datedNewsRows(table, date) {
  const rows = spreadsheetRowsFromGrid(googleTableGrid(table));
  if (!rows.length || !rows.some(row => editionDate(row.date) === date)) {
    throw new Error(`Google did not return the dated news worksheet ${date}.`);
  }
  return rows;
}

function knownGoogleTabs(date) {
  const tabs = [];
  for (let day = 0; day < 7; day++) {
    const name = priorDate(date, day);
    tabs.push(name, `${name}_Audit`);
  }
  return [...tabs, 'NewsStatus', 'NewsWork_A', 'NewsWork_B', 'NewsPreview', 'NewsEditionDiagnostics', 'ExtraFeeds', 'EditorialOverrides'];
}

async function googleWorkingBodies(id, date, queryTable) {
  const failures = [];
  for (const sheet of ['NewsWork_B', 'NewsWork_A']) {
    try {
      const rows = googleTableGrid(await queryTable(id, sheet)).slice(1);
      const runs = new Map();
      for (const row of rows) {
        const run = String(row[0] || '');
        const chunk = Number(row[1]);
        if (!run.startsWith(`${date}-`) || !Number.isInteger(chunk) || !String(row[2] || '').startsWith('gzip:')) continue;
        if (!runs.has(run)) runs.set(run, []);
        runs.get(run)[chunk] = row[2];
      }
      for (const [, chunks] of [...runs].sort(([a], [b]) => b.localeCompare(a))) {
        if (!chunks.length || chunks.some(chunk => !chunk)) continue;
        try { return { bodies: articleBodiesFromWorkData(await inflateWorkJson(chunks)), warning: '' }; }
        catch (error) { failures.push(`${sheet}: ${error.message}`); }
      }
    } catch (error) { failures.push(`${sheet}: ${error.message}`); }
  }
  return { bodies: new Map(), warning: failures.length ? 'The Google Sheet loaded, but its full article cache could not be read. Stories can still be imported; database export will omit bodies that are unavailable.' : '' };
}

export async function readGoogleSheetEdition(link, sheetName = '', queryTable = googleTable, now = new Date()) {
  const id = googleSheetId(link);
  if (!id) throw new Error('Enter a Google Sheets link from docs.google.com.');
  let fields = new Map();
  try {
    const status = googleTableGrid(await queryTable(id, 'NewsStatus'));
    fields = new Map(status.map(row => [String(row[0] || '').trim().toLowerCase(), row[1]]));
  } catch { /* Dated news tabs remain usable when NewsStatus is unavailable. */ }
  const runStatus = String(fields.get('status') || '').trim().toUpperCase();
  const statusDate = editionDate(fields.get('edition'));
  const today = todayInVienna(now);
  const preferred = sheetName.match(/^(\d{4}-\d{2}-\d{2})(?:_(?:Audit|Sources|Rejected))?$/)?.[1];
  const candidates = [...new Set([preferred, statusDate, ...Array.from({ length: 8 }, (_, index) => priorDate(today, index))])].filter(Boolean);
  let date = '', selected = '', selectedTable;
  for (const candidate of candidates) {
    if (runStatus && runStatus !== 'COMPLETE' && candidate === statusDate) continue;
    try {
      const morning = await queryTable(id, candidate);
      datedNewsRows(morning, candidate);
      const choice = sheetName && sheetName !== candidate && (sheetName.startsWith(`${candidate}_`) || !/^20\d{2}-\d{2}-\d{2}/.test(sheetName)) ? sheetName : candidate;
      selectedTable = choice === candidate ? morning : await queryTable(id, choice);
      const headings = googleTableGrid(selectedTable).slice(0, 2).flat();
      if (choice.endsWith('_Audit')) spreadsheetRowsFromGrid(googleTableGrid(selectedTable));
      const expected = choice.endsWith('_Sources') ? 'Status' : choice.endsWith('_Rejected') ? 'Reason'
        : choice === 'NewsStatus' ? 'Field' : /^NewsWork_[AB]$/.test(choice) ? 'RunID' : '';
      if (expected && !headings.some(header => String(header).toLowerCase() === expected.toLowerCase())) throw new Error('Google returned a different tab.');
      date = candidate;
      selected = choice;
      break;
    } catch { /* Try another dated news tab. */ }
  }
  if (!date) throw new Error('No recent dated news worksheet could be read from Google. Check that the sheet is shared with viewers and contains a date-named news tab.');
  const statusWarning = runStatus && runStatus !== 'COMPLETE' && statusDate
    ? `The ${statusDate} edition is ${runStatus.toLowerCase()}. Loaded the previous completed edition, ${date}, for review instead.`
    : !runStatus ? `NewsStatus was unavailable; the ${date} news worksheet was verified directly.` : '';
  const grid = googleTableGrid(selectedTable);
  let rows = [], tablePreview;
  try { rows = spreadsheetRowsFromGrid(grid); }
  catch (error) {
    if (!/No column headings|needs Source, Source URL, and Heading/i.test(error.message)) throw error;
    tablePreview = grid.slice(0, 8);
  }
  const { bodies, warning } = rows.length ? await googleWorkingBodies(id, date, queryTable) : { bodies: new Map(), warning: '' };
  return {
    date, runStatus, statusDate, sheetName: selected, sheetNames: [...new Set([...knownGoogleTabs(date), ...(/(?:^|_)(?:Sources|Rejected)$/i.test(selected) || /^SourceRegistry$/i.test(selected) ? [] : [selected])])], tablePreview, totalRows: Math.max(0, grid.length - 1),
    rows: rows.length ? spreadsheetRowsFromGrid(grid, bodies) : [], cacheWarning: [statusWarning, warning].filter(Boolean).join(' ')
  };
}
