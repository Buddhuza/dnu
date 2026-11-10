import { readFile, writeFile, rename } from 'node:fs/promises';
import { writeFileSync, renameSync } from 'node:fs';
import { load } from 'cheerio';
import { listingCandidates_, parseItem_, extractPage_, baselineScore_, selectArticles_, publicSummary_, feeds_, PUBLISHER_PAGES } from './rules.js';
import { adaptSelectedArticles, dedupeNativeEvents } from './dnuEdition.js';
import { selectWeekendStories } from '../src/weekendEdition.js';

const root = new URL('../', import.meta.url);
const startedAt = new Date().toISOString();
const progressFile = new URL('data/native-collection-progress.json', root);
function progress(state, phase, message, completed = 0, total = 0, details = {}) {
  const update = { state, phase, message, startedAt, updatedAt: new Date().toISOString(), completed, total, ...details };
  const temporary = new URL(`data/native-collection-progress.${process.pid}.tmp`, root);
  writeFileSync(temporary, JSON.stringify(update));
  renameSync(temporary, progressFile);
  console.log('DNU_PROGRESS ' + JSON.stringify(update));
}
const registry = JSON.parse(await readFile(new URL('sources.json',root)));
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
const unique=[...new Map(candidates.sort((a,b)=>a.id.localeCompare(b.id)).map(x=>[x.link,x])).values()];
for(const item of unique)item.score=baselineScore_(item);
const shortlist=unique.filter(x=>x.score>0 && !x.link.startsWith('https://news.google.com/')).sort((a,b)=>b.score-a.score).slice(0,150);
let checkedPages=0;
progress('running','articles','Reading shortlisted original articles…',0,shortlist.length,{candidates:unique.length});
await parallel(shortlist,async item=>{
  try {const page=extractPage_(await request(item.link,true),item.headline);if(page){item.published=page.published||item.published;item.pageVerified=Boolean(page.published);item.articleBody=page.text||'';}}catch{/* Feed evidence remains available. */}
  checkedPages++;
  if(checkedPages%10===0||checkedPages===shortlist.length) progress('running','articles','Reading shortlisted original articles…',checkedPages,shortlist.length,{candidates:unique.length});
});
const selected=selectArticles_(unique.filter(x=>Date.parse(x.published)>=+window.start && Date.parse(x.published)<=+end));
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
const adapted = adaptSelectedArticles(verifiedSelected, leads, registry);
const reviewed = selectWeekendStories(adapted.articles);
const finalSelection = dedupeNativeEvents(reviewed.articles);
const articles = finalSelection.articles;
const rejected = [...adapted.rejected, ...[...reviewed.removed, ...finalSelection.removed].map(item => ({ id: item.article.id, title: item.article.title, reason: 'Duplicate development; kept ' + item.preferred.sourceName }))];
console.log(JSON.stringify({routes:outcomes.length,failed:outcomes.filter(x=>x.status==='failed').length,candidates:unique.length,selected:articles.length,rejected:rejected.length,bodies:articles.filter(x=>x.body).length,firstFailure:outcomes.find(x=>x.status==='failed')?.reason}));
if(!articles.length){progress('failed','selection','No qualifying articles. Previous edition retained.');throw Error('No qualifying articles. Previous edition retained.');}
const output=new URL(filter?'data/native-test-edition.json':process.argv.includes('--stage')?'data/native-pending.json':'data/prepared-update.json',root);
const temporary=new URL(output.href+'.'+process.pid+'.tmp');
await writeFile(temporary,JSON.stringify({nativeEdition:true,title:'DAILY NEWS UPDATE',checkedAt:end.toISOString(),windowStart:window.start.toISOString(),windowEnd:end.toISOString(),windowHours:hours,articles,sourceOutcomes:outcomes,bodyOutcomes,editorialRejections:rejected,leadOrigins:reviewed.leadOrigins}));
await rename(temporary,output);
progress('complete','complete',`Draft ready: ${articles.length} stories; ${articles.filter(x=>x.body).length} full bodies. Review before publishing.`,articles.length,articles.length,{stories:articles.length,bodies:articles.filter(x=>x.body).length,checkedAt:end.toISOString()});
