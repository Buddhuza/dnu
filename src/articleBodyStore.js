const databaseName = 'dnu-article-bodies-v1';

function openStore() {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) return reject(new Error('Browser article cache is unavailable.'));
    const request = indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('articles');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transaction(url, mode, value) {
  const db = await openStore();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('articles', mode);
      const request = mode === 'readonly' ? tx.objectStore('articles').get(url) : tx.objectStore('articles').put(value, url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

export async function getStoredArticleBody(url) {
  try { return await transaction(url, 'readonly'); } catch { return null; }
}

export async function storeArticleBody(url, article) {
  if (!article?.body) return;
  try { await transaction(url, 'readwrite', article); } catch { /* Export can still use the fetched body. */ }
}
