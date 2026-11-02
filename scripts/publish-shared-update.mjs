import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';
import { articleJson } from '../src/articleTranslation.js';
import { appendEditionStories, latestCollectionArticles } from '../src/editionActions.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this process environment.');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const edition = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const incoming = latestCollectionArticles(edition);
const bodies = incoming.flatMap(article => {
  const page = cache.get(article.url)?.page;
  const body = extractArticleBody(page, article.title);
  return body.split(/\s+/).length >= 25 ? [{ url: article.url, heading: String(page?.metadata?.title || articleJson(page).exactHeadline || article.title).trim(), body, translated: article.translated === true }] : [];
});
if (bodies.length) {
  const { error } = await client.from('dnu_bodies').upsert(bodies, { onConflict: 'url' });
  if (error) throw error;
}

let published;
for (let attempt = 0; attempt < 3; attempt++) {
  const { data: state, error: readError } = await client.from('dnu_state')
    .select('revision,edition,settings,excluded_story_ids').eq('id', 'main').single();
  if (readError) throw readError;
  const customUrls = (state.settings?.customArticles || []).map(article => article.url);
  const update = appendEditionStories(state.edition?.articles ? state.edition : {}, { ...edition, articles: incoming }, customUrls);
  const { data, error } = await client.from('dnu_state').update({
    revision: Number(state.revision) + 1,
    edition: update,
    compiled_at: edition.checkedAt,
    updated_at: new Date().toISOString()
  }).eq('id', 'main').eq('revision', state.revision).select('revision').maybeSingle();
  if (error) throw error;
  if (data) {
    published = { revision: data.revision, added: update.articles.length - (state.edition?.articles?.length || 0), total: update.articles.length };
    break;
  }
}
if (!published) throw new Error('The shared edition changed during publication. Retry the run.');
console.log(`Published shared DNU revision ${published.revision}: ${published.added} new stories, ${published.total} total, ${bodies.length} cached full bodies. Existing editor stories, settings and exclusions remain.`);
