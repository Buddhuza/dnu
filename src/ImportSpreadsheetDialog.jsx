import React, { useState } from 'react';
import { convertSpreadsheetRows, listSpreadsheetSheets, readSpreadsheet, readSpreadsheetGrid } from './spreadsheetImport.js';
import { DEFAULT_GOOGLE_SHEET_URL, readGoogleSheetEdition } from './googleSheetClient.js';
import { MISCELLANEOUS_COUNTRIES } from './newsSections.js';
import { useEscapeToClose } from './useEscapeToClose.js';

const NEW = '__create_new__';
const DIRECT = '__directly_under_section__';
const DIRECT_SUBSECTION = '__directly_under_subsection__';

function PlacementChooser({ item, sections, customCountries, onApply, onDelete }) {
  const hint = item.suggested || {};
  const initialSectionKnown = sections.some(section => section.id === hint.sectionId);
  const [sectionId, setSectionId] = useState(initialSectionKnown ? hint.sectionId : '');
  const [newSection, setNewSection] = useState(initialSectionKnown ? '' : hint.sectionId || '');
  const [createSection, setCreateSection] = useState(Boolean(hint.sectionId && !initialSectionKnown));
  const initialSection = sections.find(section => section.id === hint.sectionId);
  const initialSubsectionKnown = initialSection?.subsections.includes(hint.subsection);
  const [subsection, setSubsection] = useState(initialSubsectionKnown ? hint.subsection : '');
  const [newSubsection, setNewSubsection] = useState(initialSubsectionKnown ? '' : hint.subsection || '');
  const [createSubsection, setCreateSubsection] = useState(Boolean(hint.subsection && !initialSubsectionKnown));
  const [direct, setDirect] = useState(false);
  const initialCountries = [...(MISCELLANEOUS_COUNTRIES[hint.subsection] || []), ...(customCountries[hint.subsection] || [])];
  const [country, setCountry] = useState(initialCountries.includes(hint.country) ? hint.country : hint.country ? '' : DIRECT_SUBSECTION);
  const [newCountry, setNewCountry] = useState(initialCountries.includes(hint.country) ? '' : hint.country || '');
  const [createCountry, setCreateCountry] = useState(Boolean(hint.country && !initialCountries.includes(hint.country)));
  const section = sections.find(value => value.id === sectionId);
  const chosenSubsection = createSubsection ? newSubsection.trim() : subsection;
  const countryOptions = [...new Set([...(MISCELLANEOUS_COUNTRIES[chosenSubsection] || []), ...(customCountries[chosenSubsection] || [])])];
  const chosenSection = createSection ? newSection.trim() : sectionId;
  const directlyUnderSubsection = country === DIRECT_SUBSECTION && !createCountry;
  const chosenCountry = createCountry ? newCountry.trim() : directlyUnderSubsection ? '' : country;
  const showCountry = chosenSection === 'Miscellaneous' && Boolean(chosenSubsection) && !direct;
  const valid = chosenSection && (direct || chosenSubsection) && (chosenSection !== 'Miscellaneous' || direct || directlyUnderSubsection || chosenCountry);

  return <li className="import-placement-item">
    <button type="button" className="import-placement-delete" aria-label={`Delete story: ${item.title}`} title="Delete story from this import" onClick={() => onDelete(item.row)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m3 0-1 13H7L6 7m4 4v6m4-6v6"/></svg></button>
    <strong>{item.title}</strong><span>{item.sourceName} · row {item.row}</span>
    {item.reason && <p role="alert">{item.reason}. Choose another placement.</p>}
    <div className="import-placement-controls">
      <div className="import-placement-selects">
        <label>Section<select value={createSection ? NEW : sectionId} onChange={event => {
          const value = event.target.value;
          setCreateSection(value === NEW); setSectionId(value === NEW ? '' : value);
          setSubsection(''); setNewSubsection(''); setCreateSubsection(false); setDirect(false); setCountry(''); setNewCountry(''); setCreateCountry(false);
        }}><option value="">Choose section</option>{sections.filter(value => value.id !== 'Lead stories' && value.visible !== false).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}<option value={NEW}>Create section…</option></select></label>
        <label>{chosenSection === 'Miscellaneous' ? 'Subsection' : chosenSection ? 'Country or heading' : 'Subsection or country'}<select value={direct ? DIRECT : createSubsection ? NEW : subsection} disabled={!chosenSection} onChange={event => {
          const value = event.target.value;
          setDirect(value === DIRECT); setCreateSubsection(value === NEW); setSubsection(value === NEW || value === DIRECT ? '' : value);
          setCountry(DIRECT_SUBSECTION); setNewCountry(''); setCreateCountry(false);
        }}><option value="">{chosenSection ? 'Choose heading' : 'Choose section first'}</option><option value={DIRECT}>Directly under section</option>{(section?.subsections || []).map(value => <option key={value} value={value}>{value}</option>)}<option value={NEW}>Create heading…</option></select></label>
        <label>{chosenSubsection === 'INTERNATIONAL ORGANISATIONS' ? 'Organisation' : 'Country or organisation'}<select value={showCountry ? createCountry ? NEW : country : ''} disabled={!showCountry} onChange={event => { setCreateCountry(event.target.value === NEW); setCountry(event.target.value === NEW ? '' : event.target.value); }}><option value="">{chosenSection && chosenSection !== 'Miscellaneous' ? 'Not used for this section' : 'Choose subsection first'}</option><option value={DIRECT_SUBSECTION}>Directly under subsection</option>{countryOptions.map(value => <option key={value} value={value}>{value}</option>)}<option value={NEW}>Create country or organisation…</option></select></label>
      </div>
      {(createSection || createSubsection) && <div className="import-placement-extra">
        {createSection && <label>New section<input value={newSection} maxLength={80} onChange={event => setNewSection(event.target.value)} placeholder="Section name"/></label>}
        {createSubsection && <label>New heading<input value={newSubsection} maxLength={100} onChange={event => setNewSubsection(event.target.value)} placeholder="Country, organisation or subsection"/></label>}
      </div>}
      <div className="import-placement-details">
        <label>New country or organisation<input value={newCountry} maxLength={100} disabled={!showCountry || !createCountry} onChange={event => setNewCountry(event.target.value)} placeholder={showCountry ? 'Choose Create country or organisation above' : 'Choose a Miscellaneous subsection first'}/></label>
        <button type="button" disabled={!valid} onClick={() => onApply(item.row, { sectionId: chosenSection, subsection: direct ? '' : chosenSubsection, country: chosenSection === 'Miscellaneous' && !direct ? chosenCountry : '' })}>Use placement</button>
      </div>
    </div>
  </li>;
}

export default function ImportSpreadsheetDialog({ sections = [], customCountries = {}, existingArticles, sources, importedMode, sharedMode = false, publishedEmpty, hasStories, onImport, onRestore, onClear, onClose }) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [sheetName, setSheetName] = useState('');
  const [googleUrl, setGoogleUrl] = useState(DEFAULT_GOOGLE_SHEET_URL);
  const [rawRows, setRawRows] = useState([]);
  const [placementOverrides, setPlacementOverrides] = useState({});
  const [discardedRows, setDiscardedRows] = useState(new Set());

  useEscapeToClose('import-spreadsheet-title', onClose, !busy);

  function reviewedRows(overrides, discarded) {
    const converted = convertSpreadsheetRows(rawRows.filter(row => !discarded.has(row.rowNumber)), { existingArticles, sources, placementOverrides: overrides });
    return { ...converted, skipped: [...converted.skipped, ...[...discarded].map(row => ({ row, reason: 'Deleted during import review' }))] };
  }

  async function previewSheet(chosenFile, chosenSheet, link = googleUrl) {
    const online = chosenFile ? null : await readGoogleSheetEdition(link, chosenSheet);
    if (online?.tablePreview) {
      setSheetNames(online.sheetNames);
      setSheetName(online.sheetName);
      setFileName(`Google Sheet ${online.date}`);
      setRawRows([]);
      setPlacementOverrides({});
      setDiscardedRows(new Set());
      setResult({ articles: [], bodies: [], skipped: [], needsPlacement: [], total: online.totalRows, sheetName: online.sheetName, tablePreview: online.tablePreview, cacheWarning: online.cacheWarning });
      return;
    }
    let rows;
    try { rows = online?.rows || await readSpreadsheet(chosenFile, chosenSheet); }
    catch (failure) {
      if (!chosenFile || !/No column headings|needs Source, Source URL, and Heading/i.test(failure.message)) throw failure;
      const grid = await readSpreadsheetGrid(chosenFile, chosenSheet);
      setRawRows([]);
      setPlacementOverrides({});
      setDiscardedRows(new Set());
      setResult({ articles: [], bodies: [], skipped: [], needsPlacement: [], total: Math.max(0, grid.length - 1), sheetName: chosenSheet, tablePreview: grid.slice(0, 8) });
      return;
    }
    const converted = convertSpreadsheetRows(rows, { existingArticles, sources });
    if (!converted.articles.length && !converted.needsPlacement.length) throw new Error('No usable DNU stories were found in this sheet. This tab may not contain article columns, or all rows were excluded by editorial rules.');
    setRawRows(rows);
    setPlacementOverrides({});
    setDiscardedRows(new Set());
    if (online) {
      setSheetNames(online.sheetNames);
      setSheetName(online.sheetName);
      setFileName(`Google Sheet ${online.date}`);
    }
    setResult({ ...converted, total: rows.length, sheetName: online?.sheetName || chosenSheet, cacheWarning: online?.cacheWarning || '' });
  }

  async function loadGoogleSheet() {
    setFile(null);
    setFileName('');
    setResult(null);
    setError('');
    setSheetNames([]);
    setSheetName('');
    setBusy(true);
    try { await previewSheet(null, ''); }
    catch (failure) { setError(failure.message || 'Could not read the Google Sheet.'); }
    finally { setBusy(false); }
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
    if (!result || result.needsPlacement.length || busy) return;
    setBusy(true);
    setError('');
    try { await onImport(result, fileName); }
    catch (failure) { setError(failure.message || 'Could not import this spreadsheet.'); setBusy(false); }
  }

  function applyPlacement(row, placement) {
    const next = { ...placementOverrides, [row]: placement };
    const converted = reviewedRows(next, discardedRows);
    setPlacementOverrides(next);
    setResult(current => ({ ...current, ...converted }));
  }

  function deleteStory(row) {
    const nextDiscarded = new Set(discardedRows).add(row);
    const nextOverrides = { ...placementOverrides };
    delete nextOverrides[row];
    const converted = reviewedRows(nextOverrides, nextDiscarded);
    setDiscardedRows(nextDiscarded);
    setPlacementOverrides(nextOverrides);
    setResult(current => ({ ...current, ...converted }));
  }

  return <div className="add-backdrop" onMouseDown={event => { if (!busy && event.target === event.currentTarget) onClose(); }}>
    <section className="add-dialog import-spreadsheet-dialog" role="dialog" aria-modal="true" aria-labelledby="import-spreadsheet-title">
      <div className="add-dialog-heading"><h2 id="import-spreadsheet-title">Import spreadsheet</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Close spreadsheet import">×</button></div>
      <label className="import-file-label" htmlFor="import-google-sheet-url">Google Sheet URL</label>
      <div className="import-google-controls"><input id="import-google-sheet-url" type="url" value={googleUrl} onChange={event => { setGoogleUrl(event.target.value); setResult(null); setSheetNames([]); setSheetName(''); }} disabled={busy}/><button type="button" onClick={loadGoogleSheet} disabled={busy}>Load latest</button></div>
      <details className="import-file-fallback"><summary>Use an Excel or CSV file instead</summary><label className="import-file-label" htmlFor="import-spreadsheet-file">Spreadsheet file</label><input id="import-spreadsheet-file" type="file" accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" onChange={chooseFile} disabled={busy}/></details>
      {sheetNames.length > 1 && <label className="import-file-label" htmlFor="import-spreadsheet-sheet">Worksheet (exact tab name)<select id="import-spreadsheet-sheet" value={sheetName} onChange={chooseSheet} disabled={busy}>{sheetNames.map(name => <option key={name} value={name}>{name}</option>)}</select></label>}
      {busy && <p role="status">Preparing spreadsheet…</p>}
      {error && <p className="add-manual-error" role="alert">{error}</p>}
      {result && <div className="import-spreadsheet-preview" aria-live="polite">
        <p><strong>{result.articles.length} of {result.total}</strong> rows ready · {result.needsPlacement.length} need placement · {result.skipped.length} skipped · {result.articles.filter(article => !article.summary).length} without a short summary · {result.bodies.length} full bodies available for database export</p>
        {!result.bodies.length && <p className="import-spreadsheet-note">No full article bodies were found in this sheet or its matching workbook cache. It can populate the update, but database export will have no rows.</p>}
        {result.cacheWarning && <p className="import-spreadsheet-note">{result.cacheWarning}</p>}
        {sheetName.endsWith('_Audit') && <p className="import-spreadsheet-note">Audit includes candidates rejected by the source script’s selection rules. Review these stories before using them in the update.</p>}
        {result.tablePreview && <div className="import-technical-preview"><p>This tab has no importable article columns. Its first rows are shown below.</p><table><tbody>{result.tablePreview.map((row, index) => <tr key={index}>{row.slice(0, 8).map((value, column) => <td key={column} title={String(value ?? '').slice(0, 500)}>{String(value ?? '').slice(0, 120)}</td>)}</tr>)}</tbody></table></div>}
        {result.needsPlacement.length > 0 && <details open className="import-placement-review"><summary>Place {result.needsPlacement.length} stories before importing</summary><ul>{result.needsPlacement.map(item => <PlacementChooser key={item.row} item={item} sections={sections} customCountries={customCountries} onApply={applyPlacement} onDelete={deleteStory}/>)}</ul></details>}
        {result.skipped.length > 0 && <details><summary>Skipped rows</summary><ul>{result.skipped.map(item => <li key={`${item.row}-${item.reason}`}>Row {item.row}: {item.reason}</li>)}</ul></details>}
      </div>}
      <div className="add-dialog-actions">
        {sharedMode ? <button type="button" className="import-spreadsheet-clear" onClick={onClear} disabled={busy || !hasStories}>Clear all stories</button> : publishedEmpty && hasStories ? <button type="button" className="import-spreadsheet-clear" onClick={onClear} disabled={busy}>Clear update</button> : importedMode && <button type="button" onClick={onRestore} disabled={busy}>Restore published update</button>}
        <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        <button type="button" className="import-spreadsheet-confirm" onClick={importFile} disabled={!result?.articles.length || Boolean(result?.needsPlacement.length) || busy}>Import {result?.articles.length || ''} stories</button>
      </div>
    </section>
  </div>;
}
