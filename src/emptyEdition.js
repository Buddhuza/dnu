export function emptyEdition(edition, clearedAt = new Date().toISOString()) {
  return {
    ...edition,
    checkedAt: clearedAt,
    windowStart: clearedAt,
    windowEnd: clearedAt,
    windowHours: 0,
    importedFromSpreadsheet: false,
    importedFileName: '',
    emptyPrepared: true,
    articles: [],
    sourceOutcomes: []
  };
}
