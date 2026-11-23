export function assignSectionsToColumns(sections, measuredHeights = {}) {
  const heights = [0, 0];
  return sections.map(({ sectionId, subsections }, index) => {
    const column = index < 2 ? index : heights[0] <= heights[1] ? 0 : 1;
    const estimatedHeight = 32 + subsections.length * 22 + subsections.reduce((total, [, stories]) => total + stories.length * 58, 0);
    heights[column] += measuredHeights[sectionId] || estimatedHeight;
    return column;
  });
}
