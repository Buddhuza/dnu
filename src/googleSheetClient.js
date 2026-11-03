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

export async function readGoogleSheetEdition(link, sheetName = '', queryTable = googleTable) {
  const id = googleSheetId(link);
  if (!id) throw new Error('Enter a Google Sheets link from docs.google.com.');
  const status = googleTableGrid(await queryTable(id, 'NewsStatus'));
  const fields = new Map(status.slice(1).map(row => [String(row[0] || '').trim(), row[1]]));
  if (String(fields.get('status') || '').toUpperCase() !== 'COMPLETE') {
    throw new Error('The live news sheet is still being prepared. Try again when NewsStatus says COMPLETE.');
  }
  const date = editionDate(fields.get('edition'));
  if (!date) throw new Error('Could not find the latest edition date in NewsStatus.');
  const selected = sheetName || date;
  if (selected !== date && selected !== `${date}_Audit`) throw new Error('Choose the current Morning News or Audit worksheet.');
  const table = await queryTable(id, selected);
  const { bodies, warning } = await googleWorkingBodies(id, date, queryTable);
  return {
    date, sheetName: selected, sheetNames: [date, `${date}_Audit`],
    rows: spreadsheetRowsFromGrid(googleTableGrid(table), bodies), cacheWarning: warning
  };
}
