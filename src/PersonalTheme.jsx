import React from 'react';

const lightDefaults = { headerTop: '#80a1b4', countryHighlight: '#d7e7f0' };
const darkDefaults = { headerTop: '#1a2a35', countryHighlight: '#284254' };

export default function PersonalTheme({ config, onChange, onReset }) {
  const mode = config.darkMode ? 'darkTheme' : 'theme';
  const palette = config[mode];
  const defaults = config.darkMode ? darkDefaults : lightDefaults;
  const changeColor = (key, value) => onChange({ [mode]: { [key]: value } });
  return <div className="personal-theme">
    <h3>My appearance</h3>
    <p className="cms-help">These choices follow your login and do not change the shared update for other users.</p>
    <div className="personal-theme-controls">
      <label className="cms-check"><input type="checkbox" checked={config.darkMode} onChange={event => onChange({ darkMode: event.target.checked })}/> Dark mode</label>
      <label className="cms-font-label">Story text: {config.fontSize} px<input type="range" min="14" max="24" value={config.fontSize} onChange={event => onChange({ fontSize: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Section heading: {config.sectionHeadingSize} px<input type="range" min="20" max="40" value={config.sectionHeadingSize} onChange={event => onChange({ sectionHeadingSize: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Reading width: {config.updateWidth} px<input type="range" min="480" max="1400" step="20" value={config.updateWidth} onChange={event => onChange({ updateWidth: Number(event.target.value) })}/></label>
      <label className="cms-check"><input type="checkbox" checked={config.sectionHeadingUppercase} onChange={event => onChange({ sectionHeadingUppercase: event.target.checked })}/> Uppercase section headings</label>
    </div>
    <h3>{config.darkMode ? 'Dark' : 'Light'} colours</h3>
    <div className="cms-color-grid">{[
      ['background', 'Page background'], ['surface', 'Dialog and card background'],
      ['text', 'Text'], ['section', 'Section headings'],
      ['primary', 'Main buttons'], ['headerTop', 'Header top'], ['countryHighlight', 'Country highlights']
    ].map(([key, label]) => <label key={key}>{label}<span><input type="color" value={palette[key] || defaults[key]} onChange={event => changeColor(key, event.target.value)}/><code>{palette[key] || defaults[key]}</code></span></label>)}</div>
    <button type="button" className="cms-primary personal-theme-reset" onClick={onReset}>Reset my appearance</button>
  </div>;
}
