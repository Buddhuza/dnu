const color = value => /^#[0-9a-f]{6}$/i.test(value || '') ? value : undefined;
const number = (value, min, max) => value !== null && value !== '' && Number.isFinite(Number(value)) ? Math.max(min, Math.min(max, Number(value))) : undefined;

export function normalizePersonalAppearance(input) {
  if (!input || typeof input !== 'object') return {};
  const result = {};
  if (typeof input.darkMode === 'boolean') result.darkMode = input.darkMode;
  for (const [key, min, max] of [['fontSize', 14, 24], ['sectionHeadingSize', 20, 40], ['updateWidth', 480, 1400], ['countryHeadingSize', 14, 24], ['storyLineHeight', 1, 1.6], ['storySpacing', 2, 18], ['sectionSpacing', 8, 40]]) {
    const value = number(input[key], min, max);
    if (value !== undefined) result[key] = value;
  }
  const columnCount = number(input.columnCount, 1, 4);
  if (columnCount !== undefined) result.columnCount = Math.round(columnCount);
  if (typeof input.sectionHeadingUppercase === 'boolean') result.sectionHeadingUppercase = input.sectionHeadingUppercase;
  for (const mode of ['theme', 'darkTheme']) {
    if (!input[mode] || typeof input[mode] !== 'object') continue;
    const palette = {};
    for (const key of ['primary', 'background', 'surface', 'text', 'section', 'link', 'accent', 'headerTop', 'countryHighlight']) {
      const value = color(input[mode][key]);
      if (value) palette[key] = value;
    }
    if (Object.keys(palette).length) result[mode] = palette;
  }
  return result;
}

export function withPersonalAppearance(config, appearance) {
  return {
    ...config, ...appearance,
    theme: { ...config.theme, ...appearance.theme },
    darkTheme: { ...config.darkTheme, ...appearance.darkTheme }
  };
}
