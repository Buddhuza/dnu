import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { createArticleCache } from '../server/articleCache.js';
import { extractArticleBody } from '../server/articleBody.js';
import { articleJson } from '../src/articleTranslation.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in this process environment.');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const edition = JSON.parse(readFileSync(join(root, 'data/prepared-update.json'), 'utf8'));
const { data: state, error: readError } = await client.from('dnu_state').select('settings').eq('id', 'main').single();
if (readError) throw readError;
const settings = { ...(state.settings || {}), customArticles: [], articleEdits: {}, articleOrder: [], leadOrigins: {} };
const cache = createArticleCache(join(root, 'data/article-cache.jsonl'));
const bodies = edition.articles.flatMap(article => {
  const page = cache.get(article.url)?.page;
  const body = extractArticleBody(page, article.title);
  return body.split(/\s+/).length >= 25 ? [{ url: article.url, heading: String(page?.metadata?.title || articleJson(page).exactHeadline || article.title).trim(), body, translated: article.translated === true }] : [];
});
const { data: revision, error } = await client.rpc('publish_dnu_snapshot', { p_update: edition, p_settings: settings, p_bodies: bodies });
if (error) throw error;
console.log(`Published shared DNU revision ${revision}: ${edition.articles.length} stories, ${bodies.length} full bodies.`);
