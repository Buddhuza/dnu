export function assignSectionsToColumns(sections, measuredHeights = {}, columnCount = 3) {
  const heights = Array(Math.max(1, Math.min(4, Math.round(columnCount) || 3))).fill(0);
  return sections.map(({ sectionId, subsections }, index) => {
    const column = index < heights.length ? index : heights.indexOf(Math.min(...heights));
    const estimatedHeight = 32 + subsections.length * 22 + subsections.reduce((total, [, stories]) => total + stories.length * 58, 0);
    heights[column] += measuredHeights[sectionId] || estimatedHeight;
    return column;
  });
}
