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
      <label className="cms-font-label">Country / organisation headings: {config.countryHeadingSize ?? 18} px<input type="range" min="14" max="24" value={config.countryHeadingSize ?? 18} onChange={event => onChange({ countryHeadingSize: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Story line spacing: {(config.storyLineHeight ?? 1.1).toFixed(2)}<input type="range" min="1" max="1.6" step="0.05" value={config.storyLineHeight ?? 1.1} onChange={event => onChange({ storyLineHeight: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Between stories: {config.storySpacing ?? 6} px<input type="range" min="2" max="18" value={config.storySpacing ?? 6} onChange={event => onChange({ storySpacing: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Between sections: {config.sectionSpacing ?? 18} px<input type="range" min="8" max="40" value={config.sectionSpacing ?? 18} onChange={event => onChange({ sectionSpacing: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Reading width: {config.updateWidth} px<input type="range" min="480" max="1400" step="20" value={config.updateWidth} onChange={event => onChange({ updateWidth: Number(event.target.value) })}/></label>
      <label className="cms-font-label">Reading columns<select value={config.columnCount ?? 3} onChange={event => onChange({ columnCount: Number(event.target.value) })}>{[1, 2, 3, 4].map(count => <option key={count} value={count}>{count}</option>)}</select></label>
      <label className="cms-check"><input type="checkbox" checked={config.sectionHeadingUppercase} onChange={event => onChange({ sectionHeadingUppercase: event.target.checked })}/> Uppercase section headings</label>
    </div>
    <h3>{config.darkMode ? 'Dark' : 'Light'} colours</h3>
    <div className="cms-color-grid">{[
      ['background', 'Page background'], ['surface', 'Dialog and card background'],
      ['text', 'Text'], ['section', 'Section headings'], ['link', 'Story links'], ['accent', 'Accent'],
      ['primary', 'Main buttons'], ['headerTop', 'Header top'], ['countryHighlight', 'Country highlights']
    ].map(([key, label]) => <label key={key}>{label}<span><input type="color" value={palette[key] || defaults[key] || palette.section} onChange={event => changeColor(key, event.target.value)}/><code>{palette[key] || defaults[key] || palette.section}</code></span></label>)}</div>
    <button type="button" className="cms-primary personal-theme-reset" onClick={onReset}>Reset my appearance</button>
  </div>;
}
