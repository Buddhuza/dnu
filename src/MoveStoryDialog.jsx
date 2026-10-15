import React, { useMemo, useState } from 'react';
import { MISCELLANEOUS_COUNTRIES } from './newsSections.js';
import { blockedPlacementReason } from './sourcePolicy.js';

const NEW = '__new__';

export default function MoveStoryDialog({ story, sections, articles, customCountries, onMove, onClose }) {
  const [sectionId, setSectionId] = useState(story.sectionId || story.section);
  const [subsectionChoice, setSubsectionChoice] = useState(story.subsection || '');
  const [countryChoice, setCountryChoice] = useState(story.country || '');
  const [newSubsection, setNewSubsection] = useState('');
  const [newCountry, setNewCountry] = useState('');
  const section = sections.find(item => item.id === sectionId);
  const miscellaneous = sectionId === 'Miscellaneous';
  const subsection = subsectionChoice === NEW ? newSubsection.trim() : subsectionChoice;
  const countries = useMemo(() => [...new Set([
    ...(MISCELLANEOUS_COUNTRIES[subsection] || []),
    ...(customCountries?.[subsection] || []),
    ...articles.filter(item => item.sectionId === sectionId && item.subsection === subsection).map(item => item.country).filter(Boolean),
    ...(story.country && story.subsection === subsection ? [story.country] : [])
  ])].sort((a, b) => a.localeCompare(b, 'en')), [articles, customCountries, sectionId, subsection, story.country, story.subsection]);
  const country = countryChoice === NEW ? newCountry.trim() : countryChoice;
  const sourceRestriction = blockedPlacementReason(story, { sectionId, subsection });
  const valid = Boolean(section && subsection && (!miscellaneous || country) && !sourceRestriction);

  const submit = event => {
    event.preventDefault();
    if (!valid) return;
    if (onMove({ sectionId, subsection, country: miscellaneous ? country : '', createSubsection: subsectionChoice === NEW, createCountry: miscellaneous && countryChoice === NEW })) onClose();
  };

  return <div className="move-dialog-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="move-dialog" role="dialog" aria-modal="true" aria-labelledby="move-story-title" onSubmit={submit} onKeyDown={event => { if (event.key === 'Escape') onClose(); }}>
      <div className="move-dialog-heading"><h2 id="move-story-title">Move story</h2><button type="button" aria-label="Close move dialog" onClick={onClose}>×</button></div>
      <p className="move-dialog-story">{story.title}</p>
      <label>Section<select autoFocus value={sectionId} onChange={event => { setSectionId(event.target.value); setSubsectionChoice(''); setCountryChoice(''); setNewSubsection(''); setNewCountry(''); }}>
        {sections.filter(item => item.visible).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></label>
      <label>{miscellaneous ? 'Subsection' : sectionId === 'Lead stories' ? 'Heading' : 'Country'}<select value={subsectionChoice} onChange={event => { setSubsectionChoice(event.target.value); setCountryChoice(''); setNewCountry(''); }}>
        <option value="">Choose a destination</option>
        {(section?.subsections || []).map(label => <option key={label} value={label}>{label}</option>)}
        <option value={NEW}>{miscellaneous ? 'Create subsection…' : 'Create country or heading…'}</option>
      </select></label>
      {subsectionChoice === NEW && <label>New {miscellaneous ? 'subsection' : 'country or heading'}<input value={newSubsection} onChange={event => setNewSubsection(event.target.value)} maxLength={100} placeholder="Enter a name"/></label>}
      {miscellaneous && subsection && <>
        <label>{subsection === 'INTERNATIONAL ORGANISATIONS' ? 'Organisation' : 'Country or organisation'}<select value={countryChoice} onChange={event => setCountryChoice(event.target.value)}>
          <option value="">Choose a destination</option>
          {countries.map(label => <option key={label} value={label}>{label}</option>)}
          <option value={NEW}>Create country or organisation…</option>
        </select></label>
        {countryChoice === NEW && <label>New country or organisation<input value={newCountry} onChange={event => setNewCountry(event.target.value)} maxLength={100} placeholder="Enter a name"/></label>}
      </>}
      {sourceRestriction && <p>{sourceRestriction}.</p>}
      <div className="move-dialog-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" disabled={!valid}>Move story</button></div>
    </form>
  </div>;
}
