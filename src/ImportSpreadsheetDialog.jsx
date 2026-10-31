import React, { useState } from 'react';
import { convertSpreadsheetRows, listSpreadsheetSheets, readSpreadsheet } from './spreadsheetImport.js';

export default function ImportSpreadsheetDialog({ existingArticles, sources, importedMode, sharedMode = false, publishedEmpty, hasStories, onImport, onRestore, onClear, onClose }) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetName, setSheetName] = useState('');

  async function previewSheet(chosenFile, chosenSheet) {
    const rows = await readSpreadsheet(chosenFile, chosenSheet);
    const converted = convertSpreadsheetRows(rows, { existingArticles, sources });
    if (!converted.articles.length) throw new Error('No usable DNU stories were found in this sheet. Check the column names and the skipped-row reasons.');
    setResult({ ...converted, total: rows.length, sheetName: chosenSheet });
  }

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    setFile(file || null);
    setFileName(file?.name || '');
    setResult(null);
    setError('');
    setSheetNames([]);
    setSheetName('');
    if (!file) return;
    setBusy(true);
    try {
      const names = await listSpreadsheetSheets(file);
      const chosen = names.find(name => /^\d{4}-\d{2}-\d{2}$/.test(name)) || names[0] || '';
      setSheetNames(names);
      setSheetName(chosen);
      await previewSheet(file, chosen);
    } catch (failure) { setError(failure.message || 'Could not read this spreadsheet.'); }
    finally { setBusy(false); }
  }

  async function chooseSheet(event) {
    const chosen = event.target.value;
    setSheetName(chosen);
    setResult(null);
    setError('');
    setBusy(true);
    try { await previewSheet(file, chosen); }
    catch (failure) { setError(failure.message || 'Could not read this worksheet.'); }
    finally { setBusy(false); }
  }

  async function importFile() {
    if (!result || busy) return;
    setBusy(true);
    setError('');
    try { await onImport(result, fileName); }
    catch (failure) { setError(failure.message || 'Could not import this spreadsheet.'); setBusy(false); }
  }

  return <div className="add-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog import-spreadsheet-dialog" role="dialog" aria-modal="true" aria-labelledby="import-spreadsheet-title">
      <div className="add-dialog-heading"><h2 id="import-spreadsheet-title">Import spreadsheet</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close spreadsheet import">×</button></div>
      <p>Choose a DNU database export or a similar Excel or CSV sheet. For SITCEN workbooks, Import also reads full articles stored in the workbook’s compressed working-data sheets. Import replaces the previous article cache; paywalled rows are skipped.</p>
      <label className="import-file-label" htmlFor="import-spreadsheet-file">Spreadsheet file</label>
      <input id="import-spreadsheet-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={chooseFile} disabled={busy}/>
      {sheetNames.length > 1 && <label className="import-file-label" htmlFor="import-spreadsheet-sheet">Worksheet<select id="import-spreadsheet-sheet" value={sheetName} onChange={chooseSheet} disabled={busy}>{sheetNames.map(name => <option key={name} value={name}>{name.endsWith('_Audit') ? `${name} — all collected candidates` : `${name} — Morning News selection`}</option>)}</select></label>}
      {busy && <p role="status">Preparing spreadsheet…</p>}
      {error && <p className="add-manual-error" role="alert">{error}</p>}
      {result && <div className="import-spreadsheet-preview" aria-live="polite">
        <p><strong>{result.articles.length} of {result.total}</strong> rows ready · {result.skipped.length} skipped · {result.articles.filter(article => !article.summary).length} without a short summary · {result.bodies.length} full bodies available for database export</p>
        {!result.bodies.length && <p className="import-spreadsheet-note">No full article bodies were found in this sheet or its matching workbook cache. It can populate the update, but database export will have no rows.</p>}
        {sheetName.endsWith('_Audit') && <p className="import-spreadsheet-note">Audit includes candidates rejected by the source script’s selection rules. Review these stories before using them in the update.</p>}
        <ul>{result.articles.slice(0, 5).map(article => <li key={article.id}><strong>{article.title}</strong><span>{article.sectionId} · {article.subsection === 'INTERNATIONAL ORGANISATIONS' ? article.country : article.subsection} · {article.sourceName}</span></li>)}</ul>
        {result.skipped.length > 0 && <details><summary>Skipped rows</summary><ul>{result.skipped.map(item => <li key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</li>)}</ul></details>}
      </div>}
      <p className="import-spreadsheet-note">{sharedMode ? 'Import replaces the shared DNU update for all visitors. Clear all stories hides them for everyone while preserving the section structure and article cache.' : 'Import replaces the update displayed in this browser. It does not change the public edition; you can restore that edition here later.'}</p>
      <div className="add-dialog-actions">
        {sharedMode && hasStories ? <button type="button" onClick={onClear} disabled={busy}>Clear all stories</button> : !sharedMode && (publishedEmpty && hasStories ? <button type="button" onClick={onClear} disabled={busy}>Clear update</button> : importedMode && <button type="button" onClick={onRestore} disabled={busy}>Restore published update</button>)}
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="import-spreadsheet-confirm" onClick={importFile} disabled={!result?.articles.length || busy}>Import {result?.articles.length || ''} stories</button>
      </div>
    </section>
  </div>;
}
