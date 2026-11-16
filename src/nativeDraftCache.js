export const nativeDraftKey = 'dnu-native-review-draft-v1';

export function readNativeDraft(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage?.getItem(nativeDraftKey) || 'null');
    return saved?.edition?.checkedAt && Array.isArray(saved.edition.articles) && saved.settings?.sections ? saved : null;
  } catch { return null; }
}

export function saveNativeDraft(snapshot, storage = globalThis.localStorage) {
  if (!snapshot?.edition?.checkedAt || !Array.isArray(snapshot.edition.articles)) return false;
  try { storage?.setItem(nativeDraftKey, JSON.stringify(snapshot)); return true; }
  catch { return false; }
}

export function clearNativeDraft(storage = globalThis.localStorage) {
  try { storage?.removeItem(nativeDraftKey); } catch { /* A blocked browser store does not prevent leaving the draft. */ }
}
