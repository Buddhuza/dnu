import React, { useState } from 'react';
import { convertSpreadsheetRows, readSpreadsheet } from './spreadsheetImport.js';

export default function ImportSpreadsheetDialog({ existingArticles, sources, importedMode, publishedEmpty, hasStories, onImport, onRestore, onClear, onClose }) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function chooseFile(event) {
    const file = event.target.files?.[0];
    setFileName(file?.name || '');
    setResult(null);
    setError('');
    if (!file) return;
    setBusy(true);
    try {
      const rows = await readSpreadsheet(file);
      const converted = convertSpreadsheetRows(rows, { existingArticles, sources });
      if (!converted.articles.length) throw new Error('No usable DNU stories were found in this sheet. Check the column names and the skipped-row reasons.');
      setResult({ ...converted, total: rows.length });
    } catch (failure) { setError(failure.message || 'Could not read this spreadsheet.'); }
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
      <p>Choose a DNU database export or a similar Excel or CSV sheet. Import replaces the previous browser article cache with full bodies from this sheet. Paywalled rows are skipped. Database export uses only those imported bodies.</p>
      <label className="import-file-label" htmlFor="import-spreadsheet-file">Spreadsheet file</label>
      <input id="import-spreadsheet-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={chooseFile} disabled={busy}/>
      {busy && <p role="status">Preparing spreadsheet…</p>}
      {error && <p className="add-manual-error" role="alert">{error}</p>}
      {result && <div className="import-spreadsheet-preview" aria-live="polite">
        <p><strong>{result.articles.length} of {result.total}</strong> rows ready · {result.skipped.length} skipped · {result.articles.filter(article => !article.summary).length} without a short summary</p>
        <ul>{result.articles.slice(0, 5).map(article => <li key={article.id}><strong>{article.title}</strong><span>{article.sectionId} · {article.subsection === 'INTERNATIONAL ORGANISATIONS' ? article.country : article.subsection} · {article.sourceName}</span></li>)}</ul>
        {result.skipped.length > 0 && <details><summary>Skipped rows</summary><ul>{result.skipped.map(item => <li key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</li>)}</ul></details>}
      </div>}
      <p className="import-spreadsheet-note">Import replaces the update displayed in this browser. It does not change the public edition; you can restore that edition here later.</p>
      <div className="add-dialog-actions">
        {publishedEmpty && hasStories ? <button type="button" onClick={onClear} disabled={busy}>Clear update</button> : importedMode && <button type="button" onClick={onRestore} disabled={busy}>Restore published update</button>}
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="import-spreadsheet-confirm" onClick={importFile} disabled={!result?.articles.length || busy}>Import {result?.articles.length || ''} stories</button>
      </div>
    </section>
  </div>;
}
