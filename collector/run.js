import { readFile, writeFile, rename } from 'node:fs/promises';
import { writeFileSync, renameSync } from 'node:fs';
import { load } from 'cheerio';
import { listingCandidates_, parseItem_, extractPage_, baselineScore_, selectArticles_, publicSummary_, feeds_, PUBLISHER_PAGES } from './rules.js';
import { adaptSelectedArticles, dedupeNativeEvents, limitBelarusStateAgency } from './dnuEdition.js';
import { selectWeekendStories, ensureUkraineWarLeads } from '../src/weekendEdition.js';
import { collectionDataPath, ensureCollectionData } from '../server/dataDirectory.js';
import { loadEditorialLearning } from './loadEditorialLearning.js';
import { matchingEditorialDecision } from '../src/editorialLearning.js';
import { extractDwLiveBlogEntries, isDwLiveBlog } from './dwLiveBlog.js';
import { extractSkyLiveBlogEntries, SKY_UKRAINE_LIVE_URL, SKY_UKRAINE_LIVE_FEED } from './skyLiveBlog.js';
import { extractCbsLiveBlogEntries, isCbsLiveBlog } from './cbsLiveBlog.js';
import { extractAlJazeeraLiveBlogEntries, isAlJazeeraLiveBlog, alJazeeraAmpUrl, alJazeeraMissingPostIds } from './alJazeeraLiveBlog.js';
import { extractBbcLiveBlogEntries, isBbcLiveBlog } from './bbcLiveBlog.js';

const root = new URL('../', import.meta.url);
ensureCollectionData();
const startedAt = new Date().toISOString();
const trigger = process.env.DNU_COLLECTION_TRIGGER === 'manual' ? 'manual' : 'automatic';
const progressFile = collectionDataPath('native-collection-progress.json');
function progress(state, phase, message, completed = 0, total = 0, details = {}) {
  const update = { state, phase, message, startedAt, updatedAt: new Date().toISOString(), completed, total, trigger, ...details };
  const temporary = collectionDataPath(`native-collection-progress.${process.pid}.tmp`);
  writeFileSync(temporary, JSON.stringify(update));
  renameSync(temporary, progressFile);
  console.log('DNU_PROGRESS ' + JSON.stringify(update));
}
const registry = JSON.parse(await readFile(new URL('sources.json',root)));
let editorialLearning = [];
try { editorialLearning = await loadEditorialLearning(); }
catch (error) { console.warn(`Could not load editor decisions: ${error.message}`); }
console.log(`Loaded ${editorialLearning.length} saved editor decisions for collection.`);
const end = new Date();
const hours = new Intl.DateTimeFormat('en',{weekday:'short',timeZone:'Europe/Vienna'}).format(end)==='Mon' ? 72 : 24;
const window = {end, start:new Date(+end-hours*3600000),hours};
const routes = new Map();
function route(source,url,kind,search=false) {
  if(url && !routes.has(url)) routes.set(url,{...source,url,publisherDomain:source.domain,kind,search});
}
for(const source of registry){
  for(const url of source.feedUrls || []) route(source,url,'rss');
  route(source,source.listingUrl,'html');
  route(source,source.url,'html');
  route(source,'https://news.google.com/rss/search?hl=en-US&gl=US&ceid=US:en&q='+encodeURIComponent('site:'+source.domain+' when:'+hours+'h'),'rss',true);
}
// The current live-blog URL changes each day; discover it from publisher listings.
for (const [domain, url] of [['cbsnews.com', 'https://www.cbsnews.com/'], ['aljazeera.com', 'https://www.aljazeera.com/'], ['bbc.com', 'https://www.bbc.com/']]) {
  const source = registry.find(item => item.domain === domain);
  if (source) route(source, url, 'html');
}
for(const [url] of PUBLISHER_PAGES){
  const host=new URL(url).hostname.replace(/^www\./,'');
  const source=registry.find(s=>host===s.domain||host.endsWith('.'+s.domain));
  if(source) route(source,url,'html');
}
for (const feed of feeds_(window,registry)) {
  if (routes.has(feed.url)) continue;
  const source = registry.find(s => s.domain === feed.publisherDomain || s.name === feed.name);
  routes.set(feed.url, {...source, ...feed, kind:feed.kind === 'publisher' ? 'html' : 'rss'});
}
function xmlElement($, node){
  return {getName:()=>node.name.split(':').pop(),getText:()=>$(node).text(),
    getChildren:()=>$(node).children().toArray().map(child=>xmlElement($, child)),
    getAttribute:name=>node.attribs[name] ? {getValue:()=>node.attribs[name]} : null};
}
function trustedPublisher(url) {
  const parsed = new URL(url);
  return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password && !parsed.port && registry.some(s => parsed.hostname === s.domain || parsed.hostname.endsWith('.' + s.domain));
}
async function request(url, publisherPage = false){
  if (publisherPage && !trustedPublisher(url)) throw Error('Publisher domain outside catalogue');
  const response=await fetch(url,{redirect:publisherPage?'error':'follow',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'DNU news collector/1.0'}});
  if(!response.ok) throw Error('HTTP '+response.status);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>4000000)throw Error('Page exceeds size limit');chunks.push(chunk);}
  return Buffer.concat(chunks).toString('utf8');
}
async function parallel(items,action){
  const queue=[...items];await Promise.all(Array.from({length:12},async()=>{while(queue.length)await action(queue.shift());}));
}
const candidates=[],outcomes=[];
const filter=process.env.DNU_TEST_DOMAIN;
const activeRoutes=[...routes.values()].filter(f=>!filter||f.domain===filter);
let routesDone=0;
progress('running','routes','Checking publisher feeds and pages…',0,activeRoutes.length);
await parallel(activeRoutes,async feed=>{
  let rows;
  try {const raw=await request(feed.url);
    if(feed.kind==='html')rows=listingCandidates_(raw,feed,window,registry);
    else {const $=load(raw,{xmlMode:true});rows=$('item,entry').toArray().map(n=>parseItem_(xmlElement($,n),feed,window,registry)).filter(x=>x.id);}
    candidates.push(...rows);outcomes.push({id:feed.id,url:feed.url,status:'checked',count:rows.length});
  }catch(error){outcomes.push({id:feed.id,url:feed.url,status:'failed',reason:error.message});}
  routesDone++;
  if(routesDone%20===0||routesDone===activeRoutes.length) progress('running','routes','Checking publisher feeds and pages…',routesDone,activeRoutes.length,{candidates:candidates.length,failedRoutes:outcomes.filter(x=>x.status==='failed').length});
});
const liveParents = [...new Map(candidates.filter(item => isDwLiveBlog(item.link) && !new URL(item.link).searchParams.has('dnu-update'))
  .map(item => [new URL(item.link).pathname, item])).values()].slice(0, 8);
await parallel(liveParents, async parent => {
  try {
    const entries = extractDwLiveBlogEntries(await request(parent.link, true), parent)
      .filter(item => Date.parse(item.published) >= +window.start && Date.parse(item.published) <= +end);
    candidates.push(...entries);
    console.log(`DW live blog ${parent.link}: ${entries.length} dated individual updates in window.`);
  } catch (error) { console.warn(`DW live blog ${parent.link}: ${error.message}`); }
});
if (!filter || filter === 'bbc.com') {
  const source = registry.find(item => item.domain === 'bbc.com');
  const parents = [...new Map(candidates.filter(item => isBbcLiveBlog(item.link) && !new URL(item.link).searchParams.has('post'))
    .map(item => [new URL(item.link).pathname, item])).values()].slice(0, 8);
  await parallel(parents, async parent => {
    try {
      const entries = extractBbcLiveBlogEntries(await request(parent.link, true), parent)
        .filter(item => Date.parse(item.published) >= +window.start && Date.parse(item.published) <= +end);
      candidates.push(...entries);
      outcomes.push({ id: source?.id, url: parent.link, status: 'checked', count: entries.length });
      console.log(`BBC live blog ${parent.link}: ${entries.length} dated individual updates in window.`);
    } catch (error) {
      outcomes.push({ id: source?.id, url: parent.link, status: 'failed', reason: error.message });
      console.warn(`BBC live blog ${parent.link}: ${error.message}`);
    }
  });
}
if (!filter || filter === 'cbsnews.com') {
  const cbsSource = registry.find(source => source.domain === 'cbsnews.com');
  const parents = [...new Map(candidates.filter(item => isCbsLiveBlog(item.link))
    .map(item => [new URL(item.link).pathname, item])).values()].slice(0, 8);
  await parallel(parents, async parent => {
    try {
      const entries = extractCbsLiveBlogEntries(await request(parent.link, true), parent)
        .filter(item => Date.parse(item.published) >= +window.start && Date.parse(item.published) <= +end);
      candidates.push(...entries);
      outcomes.push({ id: cbsSource?.id, url: parent.link, status: 'checked', count: entries.length });
      console.log(`CBS live blog ${parent.link}: ${entries.length} dated individual updates in window.`);
    } catch (error) {
      outcomes.push({ id: cbsSource?.id, url: parent.link, status: 'failed', reason: error.message });
      console.warn(`CBS live blog ${parent.link}: ${error.message}`);
    }
  });
}
if (!filter || filter === 'aljazeera.com') {
  const source = registry.find(item => item.domain === 'aljazeera.com');
  const parents = [...new Map(candidates.filter(item => isAlJazeeraLiveBlog(item.link))
    .map(item => [new URL(item.link).pathname, item])).values()].slice(0, 8);
  await parallel(parents, async parent => {
    try {
      const ampUrl = alJazeeraAmpUrl(parent.link);
      const entries = extractAlJazeeraLiveBlogEntries(await request(ampUrl, true), parent)
        .filter(item => Date.parse(item.published) >= +window.start && Date.parse(item.published) <= +end);
      const missing = alJazeeraMissingPostIds(await request(`${new URL(parent.link).origin}${new URL(parent.link).pathname}`, true), entries, window.start, end);
      for (let index = 0; index < missing.length; index += 4) {
        const older = await Promise.all(missing.slice(index, index + 4).map(async id => {
          try { return extractAlJazeeraLiveBlogEntries(await request(`${ampUrl}?update=${id}`, true), parent); }
          catch (error) { console.warn(`Al Jazeera live update ${id}: ${error.message}`); return []; }
        }));
        entries.push(...older.flat());
      }
      candidates.push(...entries);
      outcomes.push({ id: source?.id, url: parent.link, status: 'checked', count: entries.length });
      console.log(`Al Jazeera live blog ${parent.link}: ${entries.length} dated individual updates in window.`);
    } catch (error) {
      outcomes.push({ id: source?.id, url: parent.link, status: 'failed', reason: error.message });
      console.warn(`Al Jazeera live blog ${parent.link}: ${error.message}`);
    }
  });
}
if (!filter || filter === 'news.sky.com') {
  const skySource = registry.find(source => source.domain === 'news.sky.com');
  try {
    const parent = { link: SKY_UKRAINE_LIVE_URL, headline: 'Ukraine war latest', source: skySource?.name || 'Sky News',
      sourceDomain: 'news.sky.com', sourceCountry: 'International', sourceVerified: true };
    const skyFeed = JSON.parse((await request(SKY_UKRAINE_LIVE_FEED)).replace(/^\uFEFF/, ''));
    if (skyFeed?.success !== true || !Array.isArray(skyFeed.result)) throw Error('Unexpected Sky live feed response');
    const entries = extractSkyLiveBlogEntries(skyFeed, parent)
      .filter(item => Date.parse(item.published) >= +window.start && Date.parse(item.published) <= +end);
    candidates.push(...entries);
    outcomes.push({ id: skySource?.id, url: SKY_UKRAINE_LIVE_FEED, status: 'checked', count: entries.length });
    console.log(`Sky Ukraine live blog: ${entries.length} dated individual updates in window.`);
  } catch (error) {
    outcomes.push({ id: skySource?.id, url: SKY_UKRAINE_LIVE_FEED, status: 'failed', reason: error.message });
    console.warn(`Sky Ukraine live blog: ${error.message}`);
  }
}
const collectionKey = item => isBbcLiveBlog(item.link) ? item.link.replace(/#post$/i, '') : item.link;
const byLink = new Map(candidates.sort((a,b)=>a.id.localeCompare(b.id)).map(item => [collectionKey(item), item]));
for (const item of candidates) if (item.fromLiveBlog && item.articleBody) byLink.set(collectionKey(item), item);
const distinct = [...byLink.values()];
for(const item of distinct)item.score=baselineScore_(item);
const shortlist=distinct.filter(x=>x.score>0 && !x.fromLiveBlog && !x.link.startsWith('https://news.google.com/')).sort((a,b)=>b.score-a.score).slice(0,150);
let checkedPages=0;
progress('running','articles','Reading shortlisted original articles…',0,shortlist.length,{candidates:distinct.length});
await parallel(shortlist,async item=>{
  try {const page=extractPage_(await request(item.link,true),item.headline);if(page){item.published=page.published||item.published;item.pageVerified=Boolean(page.published);item.articleBody=page.text||'';}}catch{/* Feed evidence remains available. */}
  checkedPages++;
  if(checkedPages%10===0||checkedPages===shortlist.length) progress('running','articles','Reading shortlisted original articles…',checkedPages,shortlist.length,{candidates:distinct.length});
});
const inWindow = distinct.filter(x=>Date.parse(x.published)>=+window.start && Date.parse(x.published)<=+end);
const selected=selectArticles_(inWindow);
const selectedUrls = new Set(selected.map(item => item.link));
for (const item of inWindow) {
  if (selectedUrls.has(item.link) || matchingEditorialDecision(item, editorialLearning)?.action !== 'approve') continue;
  selected.push(item);
  selectedUrls.add(item.link);
}
const bodyOutcomes=[];
const bodyTargets=selected.filter(item=>!item.articleBody && !item.link.startsWith('https://news.google.com/'));
let bodiesDone=0;
progress('running','bodies','Checking full text for selected stories…',0,bodyTargets.length,{selected:selected.length});
await parallel(bodyTargets,async item=>{
  try {
    const page=extractPage_(await request(item.link,true),item.headline);
    if(page){item.published=page.published||item.published;item.pageVerified=Boolean(page.published);item.articleBody=page.text||'';}
    bodyOutcomes.push({id:item.id,status:item.articleBody?'extracted':'unavailable'});
  } catch(error){bodyOutcomes.push({id:item.id,status:'failed',reason:error.message});}
  bodiesDone++;
  if(bodiesDone%5===0||bodiesDone===bodyTargets.length) progress('running','bodies','Checking full text for selected stories…',bodiesDone,bodyTargets.length,{selected:selected.length});
});
progress('running','selection','Applying editorial rules and removing duplicates…',0,0,{selected:selected.length});
const verifiedSelected=selected.filter(item=>Date.parse(item.published)>=+window.start && Date.parse(item.published)<=+end);
const leads=new Set();
for (const item of verifiedSelected) item.publicSummary = publicSummary_(item, leads.has(item.id));
const adapted = adaptSelectedArticles(verifiedSelected, leads, registry, editorialLearning);
const reviewed = selectWeekendStories(adapted.articles);
const finalSelection = dedupeNativeEvents(reviewed.articles);
const balancedSelection = limitBelarusStateAgency(finalSelection.articles);
const leadSelection = ensureUkraineWarLeads(balancedSelection.articles, reviewed.leadOrigins);
const articles = leadSelection.articles;
const rejected = [...adapted.rejected, ...[...reviewed.removed, ...finalSelection.removed].map(item => ({ ...item.article,
  reason: 'Duplicate development; kept ' + item.preferred.sourceName })),
  ...balancedSelection.removed.map(article => ({ ...article,
    reason: 'Limit on Belarus state agency coverage' }))];
console.log(JSON.stringify({routes:outcomes.length,failed:outcomes.filter(x=>x.status==='failed').length,candidates:unique.length,selected:articles.length,rejected:rejected.length,bodies:articles.filter(x=>x.body).length,firstFailure:outcomes.find(x=>x.status==='failed')?.reason}));
if(!articles.length){progress('failed','selection','No qualifying articles. Previous edition retained.');throw Error('No qualifying articles. Previous edition retained.');}
const output=collectionDataPath(filter?'native-test-edition.json':process.argv.includes('--stage')?'native-pending.json':'prepared-update.json');
const temporary=output+'.'+process.pid+'.tmp';
await writeFile(temporary,JSON.stringify({nativeEdition:true,title:'DAILY NEWS UPDATE',checkedAt:end.toISOString(),windowStart:window.start.toISOString(),windowEnd:end.toISOString(),windowHours:hours,articles,sourceOutcomes:outcomes,bodyOutcomes,editorialRejections:rejected,leadOrigins:leadSelection.leadOrigins}));
await rename(temporary,output);
progress('complete','complete',`Draft ready: ${articles.length} stories; ${articles.filter(x=>x.body).length} full bodies. Review before publishing.`,articles.length,articles.length,{stories:articles.length,bodies:articles.filter(x=>x.body).length,checkedAt:end.toISOString()});
