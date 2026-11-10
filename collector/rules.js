var NEWS = {
  TIMEZONE: 'Europe/Vienna', CUT_OFF_HOUR: 8, CUT_OFF_MINUTE: 0,
  MAX_EXECUTION_MS: 180000, MAX_CANDIDATES: 480, AI_BATCH_SIZE: 12,
  INTERNATIONAL_POOL_SHARE: 0.40, INTERNATIONAL_SELECTION_SHARE: 0.40,
  AI_ENABLED: true, MODEL: 'gemini-2.5-flash-lite', TEMPERATURE: 0.1,
  MAX_FEEDS: 200, MAX_PER_SOURCE_FEED: 20, MAX_ARTICLE_FETCHES: 150,
  RESERVE_ARTICLES: 36, MIN_EVIDENCE_WORDS: 35, SUMMARY_WORDS: 65, TOP_SUMMARY_WORDS: 55, SUMMARY_SENTENCES: 2, GOOGLE_RPC_ENABLED: true,
  EMAIL_BODY_BUDGET: 180000, AI_SUMMARIES: true, TOP_REQUIRE_SUMMARY: false, MIN_AUTO_TEXT_RATIO: 0.60, MIN_AUTO_MODEL_RATIO: 0.80,
  MIN_SCORE: 50, MAX_TOTAL: 125, TOP_STORIES: 5,
  DESK_LIMITS: {'South Eastern Europe':26,'Eastern Europe':29,
    'South Caucasus Region':27,'Central Asia Region':20,'General':8,'International':56},
  MAX_ONE_PUBLISHER_PER_DESK: 12, SOURCE_SEARCH_GROUP_SIZE: 5,
  INCLUDE_AI_BRIEF: true, INCLUDE_SOCIAL: false,
  // A single modest source-fit feature; official/state claims stay attributed.
  WEIGHTS: {relevance:35,impact:25,novelty:20,prominence:10,source_fit:10}
};

var DESK_COUNTRIES = {
 'South Eastern Europe':['Albania','Bosnia and Herzegovina','Montenegro','North Macedonia','Serbia','Kosovo'],
 'Eastern Europe':['Belarus','Moldova','Ukraine'],
 'South Caucasus Region':['Armenia','Azerbaijan','Georgia'],
 'Central Asia Region':['Kazakhstan','Kyrgyzstan','Tajikistan','Turkmenistan','Uzbekistan'],
 'General':[], 'International':[]
};

var COUNTRY_TO_DESK={};
for(const [desk,countries] of Object.entries(DESK_COUNTRIES)) for(const country of countries) COUNTRY_TO_DESK[country]=desk;

var COUNTRY_PATTERNS={
 'Albania':/\b(albania[n]?|tirana|rama)\b/i,
 'Bosnia and Herzegovina':/\b(bih|bosni[a-n]*|herzegovina|sarajevo|srebrenica|dodik|republika srpska|brcko|banja luka)\b/i,
 'Montenegro':/\b(montenegro|montenegrin|podgorica|milatovic)\b/i,
 'North Macedonia':/\b(north macedonia|macedonian|skopje)\b/i,
 'Serbia':/\b(serbia[n]?|belgrade|student list|vucic|novi sad|nis refinery|srbijagas)\b/i,
 'Kosovo':/\b(kosov[oae]r?|pristi?na|prishtina|kurti|kfor|unmik|mitrovica)\b/i,
 'Belarus':/\b(belarus(?:ian)?s?|minsk|lukashenk[oa]|tsikhanouskaya)\b/i,
 'Moldova':/\b(moldova[n]?s?|dodon|darii|grosu|chisinau|chișinău|transnistria|tiraspol|gagauz(?:ia|ian)?s?|sandu|dnies?ter|nistru)\b/i,
 'Ukraine':/\b(ukrain[a-z]*|vinnytsia|vinnytsa|chernihiv|kryvyi rih|mariupol|kupiansk|izium|izyum|kyiv|kiev|kharkiv|kharkov|kramatorsk|pryluky|sumy|mykolaiv|lugansk|odes[sa]+|donbas[s]?|dnipro|zelensk[yi][a-z]*|zaporizh[a-z]*|donetsk|luhansk)\b/i,
 'Armenia':/\b(armen[ia-n]*|yerevan|pashiny?an|mirzoyan|artsakh)\b/i,
 'Azerbaijan':/\b(azerbaijan[i]?|baku|aliyev|karabakh|artsakh)\b/i,
 'Georgia':/\b(tbilisi|georgian|abkhazia|south ossetia|saakashvili|zurabishvili|papuashvili)\b/i,
 'Kazakhstan':/\b(kazakhstan|kazakh[a-z]*|qazaqgaz|maslikhat[a-z]*|astana|almaty|tokayev)\b/i,
 'Kyrgyzstan':/\b(kyrgyz[a-z]*|bishkek|japarov)\b/i,
 'Tajikistan':/\b(tajik[a-z]*|dushanbe|rog[h]?un|rahmon)\b/i,
 'Turkmenistan':/\b(turkmen[a-z]*|ashgabat|berdym[a-z]*|tapi)\b/i,
 'Uzbekistan':/\b(uzbek[a-z]*|tashkent|samarkand|mirziyoyev|mirziyoyeva)\b/i
};

var TOPIC_RULES=[
 ['armed conflict and security',/\b(war|conflict|security|landmines?|weapons?|arms|fighter|attack[s]?|strike[s]?|missile[s]?|drone[s]?|shelling|troop[s]?|defen[cs]e|military|terroris[a-z]*|antiterror|counterterrorism|military exercise|killed|nuclear threat|ceasefire|hostilities|airspace|naval|maritime)\b/i],
 ['elections and governance',/\b(election[s]?|parliament[a-z]*|cabinet|presiden[a-z]*|constitution[a-z]*|opposition|political|government|reform|protest[s]?|student list|confidence vote|institutions|unrest)\b/i],
 ['human rights and rule of law',/\b(human rights|prisoner[s]?|detain[a-z]*|arrest[a-z]*|war crimes?|war criminal|missing (?:persons|citizens)|genocide|court|justice|sentenced|conviction|hate crimes|media|journalist[s]?|censorship|religio[a-z]*|church|assembly|hate speech|discrimination|corruption|repression|extradition|asylum)\b/i],
 ['diplomacy and cooperation',/\b(meets?|meeting|visit[s]?|talks|cooperation|ambassador|ministers?|consulate|consular|envoy|dialogue|partnership|agreement|commitments?|heads of state|cis|commonwealth|summit|accession|enlargement|peace|negotiat[a-z]*|osce|odihr|eufor|unmik|kfor|nato|eu)\b/i],
 ['energy economy and connectivity',/\b(energy|gas|oil|pipeline|electricity|power|sanction[s]?|trade|investment|transport|corridor|railway|infrastructure|budget|refinery|nuclear plant|water|river|dnies?ter|nistru)\b/i],
 ['migration borders and hybrid threats',/\b(migra[a-z]*|refugee[s]?|border[s]?|cyber[a-z]*|disinformation|foreign interference|intelligence|spying|extremis[a-z]*|drug[s]?|trafficking|whatsapp|information manipulation)\b/i]
];

function now_(){return new Date();}

function stripTags_(s){return String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();}

function cleanText_(s){return decodeHTMLEntities_(stripTags_(decodeHTMLEntities_(s)));}

function safeURL_(s){s=String(s||'').trim();return /^https?:\/\/[^\s<>"']+$/i.test(s)?s:'';}

function getHost_(u){var m=String(u||'').match(/^https?:\/\/([^/:?#]+)/i);return m?m[1].replace(/^www\./,'').toLowerCase():'';}

function canonicalURL_(u){return String(u||'').replace(/#.*$/,'').replace(/([?&])(utm_[^=]+|fbclid|gclid)=[^&]*/g,'$1').replace(/[?&]+$/,'').replace(/\?&/,'?').replace(/&&/g,'&');}

function hash_(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return ('00000000'+(h>>>0).toString(16)).slice(-8);}

function tokens_(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').split(' ').filter(function(w){return w.length>2&&!/^(the|and|for|from|with|that|this|after|says|said|new|news|has|are|its|over|into|will|their)$/.test(w);});}

function similarity_(a,b){var aa=new Set(tokens_(a)),bb=new Set(tokens_(b)),n=0;aa.forEach(function(w){if(bb.has(w))n++;});return n/Math.max(1,aa.size+bb.size-n);}

function countryHits_(t){t=geographyText_(t);var result=[];Object.keys(COUNTRY_PATTERNS).forEach(function(c){if(COUNTRY_PATTERNS[c].test(t))result.push(c);});if(/\bgeorgia\b/i.test(t)&&!/(atlanta|savannah|georgia tech|bulldogs|u\.s\. state|us state|gop|north carolina|homecoming|block party|sheriff|georgia election board|georgia park)/i.test(t))result.push('Georgia');return Array.from(new Set(result));}

function usGeorgia_Prior13_(t){return /\bgeorgia\b/i.test(t)&&/\b(atlanta|savannah|gop|north carolina|homecoming|block party|sheriff|georgia tech|bulldogs|georgia election board|georgia park)\b/i.test(t)&&!/\b(tbilisi|abkhazia|south ossetia)\b/i.test(t);}

function topics_(t){return TOPIC_RULES.filter(function(x){return x[1].test(t);}).map(function(x){return x[0];});}

function child_(el,n){var ch=el.getChildren();for(var i=0;i<ch.length;i++)if(ch[i].getName()===n)return ch[i];return null;}

function textChild_(el,n){var c=child_(el,n);return c?c.getText():'';}

function score_(f){var s=0;Object.keys(NEWS.WEIGHTS).forEach(function(k){s+=NEWS.WEIGHTS[k]*Math.max(0,Math.min(5,Number(f[k])||0))/5;});return Math.round(s);}

function englishLikely_(it){var t=it.headline+' '+it.description;if(/[\u0400-\u04ff\u0600-\u06ff\u4e00-\u9fff]/.test(it.headline))return false;return /\b(the|to|in|on|for|and|with|of|at|as|is|says|from|after|by|new|over|a|an)\b/i.test(t)||!/[\u0080-\uffff]/.test(t);}

function resolveURL_(href,base){if(/^https?:\/\//i.test(href))return safeURL_(href);var origin=String(base).match(/^https?:\/\/[^/]+/i);if(!origin)return '';if(/^\/\//.test(href))return 'https:'+href;if(href.charAt(0)==='/')return origin[0]+href;return base.replace(/[^/]*$/,'')+href;}

var COUNTRY_LIMITS={'Albania':4,'Bosnia and Herzegovina':7,'Montenegro':4,'North Macedonia':4,'Serbia':7,'Kosovo':5,'Belarus':5,'Moldova':9,'Ukraine':15,'Armenia':10,'Azerbaijan':8,'Georgia':10,'Kazakhstan':6,'Kyrgyzstan':7,'Tajikistan':4,'Turkmenistan':4,'Uzbekistan':4};

var CPC_ACTORS={'Albania':/\brama\b/i,'Bosnia and Herzegovina':/\b(dodik|becirovic|kapidzic)\b/i,'Serbia':/\b(vucic|tepic|ponos)\b/i,'Kosovo':/\bkurti\b/i,'Belarus':/\b(lukashenk[oa]|tsikhanouskaya)\b/i,'Moldova':/\bsandu\b/i,'Ukraine':/\bzelensk[yi][a-z]*\b/i,'Armenia':/\b(pashiny?an|pashinian|mirzoyan)\b/i,'Azerbaijan':/\baliyev\b/i,'Georgia':/\b(kobakhidze|papuashvili|botchorishvili)\b/i,'Kazakhstan':/\btokayev\b/i,'Kyrgyzstan':/\b(japarov|zhaparov|atambayev|sultanbekov|tashiev)\b/i,'Tajikistan':/\brahmon\b/i,'Turkmenistan':/\bberdym[a-z]*\b/i,'Uzbekistan':/\bmirziyoyev[a]?\b/i};

function geographyText_(t){return String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}

var FOREIGN_SUBJECT=/\b(saudi arabia|saudi|riyadh|king khalid|yemen|houthi[a-z]*|greece|greek|jordan|united states|u\.s\.?|american|new york|texas|iran(?:ian)?|turkey|turkiye|türkiye|turkish|syria[n]?|israel[i]?|gaza|leban(?:on|ese)|iraq[i]?|south africa[n]?|zambia[n]?|sudan(?:ese)?|ethiopia[n]?|eritrea[n]?|brazil|venezuela|india[n]?|pakistan[i]?|china|chinese|taiwan|japan(?:ese)?|south korea[n]?|north korea[n]?|germany|german|france|french|italy|italian|spain|spanish|poland|polish|lithuania[n]?|latvia[n]?|estonia[n]?|croatia[n]?|bulgaria[n]?|romania[n]?|portugal|portuguese|slovakia[n]?|united kingdom|british|royal navy|russia[n]?)\b/i;

var WATCH_GEOGRAPHY=/\b(europe[a-z]*|european union|eu\b|nato|osce|odihr|russia[n]?|ukrain[a-z]*|belarus[a-z]*|moldova[n]?|balkan[a-z]*|caucasus|central asia|middle east|saudi arabia|saudi|riyadh|king khalid|yemen|houthi[a-z]*|jordan|iran[a-z]*|israel[a-z]*|gaza|leban[a-z]*|hormuz|houthi[a-z]*|afghan[a-z]*|taliban|pkk|turkey|turkish|turkiye|türkiye|syria[n]?|iraq[i]?|germany|german|france|french|italy|italian|spain|spanish|poland|polish|lithuania[n]?|latvia[n]?|estonia[n]?|croatia[n]?|bulgaria[n]?|romania[n]?|portugal|portuguese|slovakia[n]?|britain|british|united kingdom|royal navy|berlin|paris|london|scotland|ireland|sweden|finland|norway|denmark|austria|australia|australian|czech|hungary|greece|greek|cyprus|malta|netherlands|belgium|luxembourg|switzerland|canada|united states|u\.s\.?|washington|white house|trump|rubio|china|chinese|taiwan|japan[a-z]*|south korea|north korea)\b/i;

function countryFor_Prior11_(it){
 var h=geographyText_(it.headline),d=geographyText_(it.description);if(usGeorgia_(h+' '+d))return '';
 var actors=Object.keys(CPC_ACTORS).filter(function(c){return CPC_ACTORS[c].test(h);});
 if(actors.length){actors.sort(function(a,b){return h.match(CPC_ACTORS[a]).index-h.match(CPC_ACTORS[b]).index;});return actors[0];}
 var hits=countryHits_(h);if(hits.length){
  // Leading subject wins over registry order: Kosovo's court is not a Serbian story.
  hits.sort(function(a,b){var ma=h.match(COUNTRY_PATTERNS[a]),mb=h.match(COUNTRY_PATTERNS[b]);return (ma?ma.index:999)-(mb?mb.index:999);});return hits[0];
 }
 hits=countryHits_(d);if(hits.length&&!FOREIGN_SUBJECT.test(h))return hits[0];
 // Use publisher location only for an otherwise local domestic headline.
 return COUNTRY_TO_DESK[it.sourceCountry]&&!FOREIGN_SUBJECT.test(h)&&!/\b(nato|european union|united nations|un security council)\b/i.test(h)?it.sourceCountry:'';
}

function remit_Prior11_(it){
 var t=it.headline+' '+(it.description||'');return !!COUNTRY_TO_DESK[it.country]||WATCH_GEOGRAPHY.test(t)||/\b(uk|u\.k\.?|un security council|united nations security council|iaea|international criminal court|tusk|fico|rutte|macron|merz|starmer)\b/i.test(t)||(!FOREIGN_SUBJECT.test(t)&&/^(Reuters|AP$|BBC|DW)/i.test(it.source)&&/\b(court|political prisoner|media freedom|censorship)\b/i.test(t))||(!FOREIGN_SUBJECT.test(t)&&/^(ERR|BTA|BGNES|Hina|Ekathimerini|TVP)/i.test(it.source)&&topics_(t).length>0);
}

function baselineScore_Prior11_(it){
 var h=it.headline||'',text=h+' '+(it.description||''),topics=topics_(text),regional=!!COUNTRY_TO_DESK[it.country];
 if(usGeorgia_(text)){it.decision='US_state_local_story';return 0;}
 if(!remit_(it)){it.decision='outside_monitoring_geography';return 0;}
 if(/\b(exchange rates?|currency quotations?|currency to world currency|payment cards?|cards in circulation|chatbot market|monthly pay|trade deficit falls|banks.*net foreign assets|stock market|wall street|commodity prices?)\b/i.test(h)&&!/\b(sanctions|crisis|war|strategic|critical infrastructure)\b/i.test(h)){it.decision='routine_statistics_or_market';return 0;}
 if(/\b(birthday|congratulat[a-z]*|anniversary.*diplomatic relations|festival of national culture|culinary festival|arrives? at.*(?:complex|summit site)|footage.*visit|official reception|photo gallery|cartoon|gen z.s heart)\b/i.test(h)&&!/\b(agreement|signed|treaty|security policy|sanctions|peace deal|border agreement)\b/i.test(h)){it.decision='ceremonial_or_promotional';return 0;}
 if(/\b(football|basketball|tennis|celebrity|horoscope|box office|recipe|pop concert|fashion show|premier league|notre dame|cevapi)\b/i.test(text)&&!/\b(political|protest|rights|government|security|attack|sanction|election)\b/i.test(text)){it.decision='out_of_scope';return 0;}
 if(/\b(museum.*robbery|robbery.*museum|artworks|live.broadcasted execution|will.*executed|concert hall.*shooting|shooting.*concert hall)\b/i.test(h)&&!/\b(terror|political|rights|war crime|hate crime)\b/i.test(h)){it.decision='ordinary_crime_without_policy_development';return 0;}
 var osce=/\b(osce|odihr|eufor|kfor|unmik)\b/i.test(text);
 if(!topics.length&&!osce){it.decision='no_editorial_relevance';return 0;}
 var rights=/\b(political prisoners?|transnational repression|impeachment|extradition|asylum|freedom of (?:expression|assembly)|selective political persecution|war criminal|opposition.*ban|ban.*opposition)\b/i.test(text);
 var commemorative=/\b(honou?rs?|commemorat[a-z]*|memorial)\b.*\b(victims|dead|strike|attack)\b/i.test(h);
 var acute=!commemorative&&/\b(killed|deadly|missile|attack|strike|invasion|escalation|ceasefire|blackouts?|power cuts?|nuclear (?:threat|warning|weapons?|exercise|drill)|constitutional|arrest|spy|spying|hypersonic|landmine|military conscription|armed forces|military withdrawal)\b/i.test(h);
 var mass=/\b(?:[2-9]\d|[1-9]\d{2,})\s+(?:people\s+)?(?:killed|dead|deaths)|kills\s+(?:[2-9]\d|[1-9]\d{2,})\b/i.test(h);
 var chair=/\b(osce)\b/i.test(h)&&/\b(chairmanship|chair.in.office|chair.*2027)\b/i.test(h);
 var negotiation=/\b(talks|negotiat|peace|settlement|stalemate|war)\b/i.test(h)&&/\b(ukrain|russia|iran|gaza|hormuz)/i.test(h);
 var institutional=/\b(presiden|minister|government|parliament|court|nato|commission|sand[u]?|pashinyan|tokayev|japarov|zhaparov|rahmon|mirziyoyev|municipalities|sovereignty|EU accession|entry talks)/i.test(text);
 var fit=/^(Reuters|AP$|BBC|DW|OSCE|Ukrinform|BelTA|FENA|MIA|RTK|APA|Interfax|Civil ge|IPN Moldova|Infotag|24 kg|Trend|Armenpress|N1|BIRN|DTT|TemA|Kabar|Moldpres|Astana Times|Asia Plus)/i.test(it.source)?4:3;
 it.features={relevance:chair?5:(regional?5:(osce||rights?4:3)),impact:mass?5:(acute||rights||chair||negotiation?4:2),novelty:3,prominence:chair?5:(institutional?4:2),source_fit:fit};
 it.reason=regional?'Concrete domestic politics, security, rights, diplomacy or strategic development in a monitored country':'Substantive development within the international monitoring remit';
 it.urgent=!!(acute&&(mass||/\b(major|massive|nuclear (?:threat|attack|strike)|ceasefire|blackouts?|power cuts?|invasion|hypersonic)\b/i.test(h)));it.eventId='';return score_(it.features);
}

function evidenceKey_Prior11_(it){
 var h=(it.headline||'').toLowerCase();
 // Narrow actor/place/action anchors; response stories remain separate.
 if(/kramatorsk/.test(h)&&/bus(?:es)?|passenger/.test(h)&&/strike|attack|kills?|killed/.test(h))return 'kramatorsk-passenger-bus-strike';
 if(/eu|european union/.test(h)&&/sanctions/.test(h)&&/hybrid/.test(h)&&/extend|another year/.test(h))return 'eu-russia-hybrid-sanctions-extension';
 if(/(?:kyrgyzstan|kyrgyz)/.test(h)&&/(?:uk|britain)/.test(h)&&/sanctions/.test(h)&&/three|3/.test(h))return 'uk-three-kyrgyz-company-sanctions';
 return '';
}

function duplicates_(a,b){
 if(canonicalURL_(a.link)===canonicalURL_(b.link))return true;
 if(a.published&&b.published&&Math.abs(new Date(a.published)-new Date(b.published))>36*3600000)return false;
 var ka=evidenceKey_(a),kb=evidenceKey_(b);if(ka&&ka===kb)return true;
 if(a.country!==b.country)return false;
 var an=(a.headline.match(/\b\d+(?:[.,]\d+)*\b/g)||[]).join('|'),bn=(b.headline.match(/\b\d+(?:[.,]\d+)*\b/g)||[]).join('|');
 if(an&&bn&&an!==bn)return false;
 var sim=similarity_(a.headline,b.headline);if(sim>=0.80)return true;
 return !!(a.eventId&&a.eventId===b.eventId&&sim>=0.40);
}

function editorialRank_(it){return Number(it.score||0)+(evidenceWords_(it)>=25?3:0)+(it.sourceVerified?2:0);}

function topRank_Prior11_(it){var h=it.headline||'',chair=/\bosce\b/i.test(h)&&/chairmanship|chair.in.office/i.test(h);return Number(it.score||0)+(it.urgent?18:0)+(chair?15:0)+(/\b(talks|negotiat|stalemate|ceasefire)\b/i.test(h)&&/ukrain|russia|iran/i.test(h)?8:0);}

var PUBLISHER_PAGES=[
 ['https://english.gazetatema.net/','TemA','Albania'],['https://www.albaniandailynews.com/','Albanian Daily News','Albania'],
 ['https://n1info.ba/english/','N1 Bosnia','Bosnia and Herzegovina'],['https://dtt-net.com/','DTT NET','Regional'],
 ['https://www.cdm.me/english/','CdM','Montenegro'],['https://mina.news/','MINA','Montenegro'],
 ['https://mia.mk/en?lang=en','MIA','North Macedonia'],['https://skopjediem.com/','Skopje Diem','North Macedonia'],
 ['https://n1info.rs/english/news/','N1 Serbia','Serbia'],['https://www.tanjug.rs/english','Tanjug','Serbia'],
 ['https://www.rtklive.com/en/index.php','RTK','Kosovo'],['https://prishtinainsight.com/category/news/','Prishtina Insight','Kosovo'],
 ['https://eng.belta.by/','BelTA','Belarus'],['https://pozirk.online/en/','Pozirk','Belarus'],
 ['https://www.ipn.md/en','IPN Moldova','Moldova'],['https://www.infotag.md/','Infotag','Moldova'],['https://www.moldpres.md/eng/','Moldpres','Moldova'],
 ['https://www.ukrinform.net/','Ukrinform','Ukraine'],['https://kyivindependent.com/','Kyiv Independent','Ukraine'],
 ['https://armenpress.am/en/articles','Armenpress','Armenia'],['https://news.am/en','News am','Armenia'],['https://news.am/en/news/politics','News am','Armenia'],['https://www.azatutyun.am/z/1089','Armenia Liberty','Armenia'],
 ['https://en.apa.az/all-news','APA','Azerbaijan'],['https://www.azernews.az/latest/','Azernews','Azerbaijan'],
 ['https://civil.ge/','Civil ge','Georgia'],['https://1tv.ge/lang/en/','1TV Georgia','Georgia'],['https://oc-media.org/news/','OC Media','Regional'],
 ['https://astanatimes.com/','Astana Times','Kazakhstan'],['https://kaztag.kz/en/','KazTag','Kazakhstan'],
 ['https://24.kg/english/','24 kg','Kyrgyzstan'],['https://en.kabar.kg/','Kabar','Kyrgyzstan'],
 ['https://asiaplus.news/en/','Asia Plus','Tajikistan'],['https://eng.khovar.tj/','Khovar','Tajikistan'],
 ['https://en.turkmen.news/','Turkmen news','Turkmenistan'],['https://orient.tm/en','Orient','Turkmenistan'],
 ['https://www.uzdaily.uz/en/','UzDaily','Uzbekistan'],['https://www.gazeta.uz/en/','Gazeta uz','Uzbekistan'],
 ['https://timesca.com/','Times of Central Asia','Regional'],['https://www.euronews.com/','Euronews','International'],
 ['https://www.france24.com/en/','France 24','International'],['https://www.ekathimerini.com/','Ekathimerini','International'],
 ['https://www.arabnews.com/','Arab News','International'],['https://www.timesofisrael.com/','Times of Israel','International'],
 ['https://www.ariananews.af/','Ariana','Afghanistan']
];

var SOURCE_ALIASES={'ap news':'AP','associated press':'AP','bbc news':'BBC','dw.com':'DW','politico.eu':'Politico Europe','trend news agency':'Trend','24.kg':'24 kg','akipress news agency':'AKIpress','news.am':'News am','1tv.ge':'1TV Georgia','georgia today':'Georgia Today','agencija mina':'MINA','skopjediem':'Skopje Diem','rtsh - radio televizioni shqiptar':'RTSH','radio moldova':'Radio Moldova','north atlantic treaty organization | nato':'NATO'};

function sourceDomainsMatch_Prior13_(url,domain){var h=getHost_(url);return !!domain&&(h===domain||h.endsWith('.'+domain));}

function parseItem_(el,feed,win,registry){
 var title=cleanText_(textChild_(el,'title')),src=textChild_(el,'source'),srcEl=child_(el,'source'),srcAttr=srcEl&&srcEl.getAttribute?srcEl.getAttribute('url'):null;
 var links=el.getChildren().filter(function(c){return c.getName()==='link';}),link='';
 links.some(function(c){var href=c.getAttribute('href'),rel=c.getAttribute('rel');if(href&&(!rel||rel.getValue()==='alternate')){link=href.getValue();return true;}if(!href&&c.getText()){link=c.getText();return true;}return false;});
 var dateText=textChild_(el,'pubDate')||textChild_(el,'published')||textChild_(el,'date')||textChild_(el,'updated'),published=new Date(dateText);
 if(!title||!safeURL_(link))return {reject:'missing_title_or_valid_link'};
 if(!dateText||isNaN(published.getTime()))return {reject:'unknown_publication_time',headline:title};
 if(published<win.start||published>win.end)return {reject:'outside_edition_window',headline:title};
 var source=sourceFor_(src,srcAttr?srcAttr.getValue():link,feed,registry);
 if(src)title=title.replace(new RegExp('\\s+-\\s+'+src.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$','i'),'').trim();
 var description=descriptionEvidence_(title,textChild_(el,'description')||textChild_(el,'summary')||textChild_(el,'encoded')||textChild_(el,'content'),feed.search);
 var it={id:hash_(canonicalURL_(link)+'|'+title),headline:title,source:source.name,sourceCountry:source.country,sourceDomain:source.domain,sourceVerified:source.verified,
 link:canonicalURL_(link),originalLink:canonicalURL_(link),description:description,published:published.toISOString(),collected:now_().toISOString(),feed:feed.url,
 contentStatus:description?'feed_excerpt':'headline_only',wire:'',selected:false,aiStatus:'rules',decision:'candidate',dateEvidence:feed.search?'aggregator_timestamp':'publisher_feed'};
 it.country=countryFor_(it);it.countries=countryHits_(title+' '+description);if(!it.countries.length&&it.country)it.countries=[it.country];
 it.category=COUNTRY_TO_DESK[it.country]||(/\b(osce|odihr)\b/i.test(title+' '+description)?'General':'International');it.topic=topics_(title+' '+description).join('; ');it.summary=description||title;return it;
}

function htmlAttrs_(tag){var a={};String(tag).replace(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g,function(_,k,q,v){a[k.toLowerCase()]=decodeHTMLEntities_(v);return _;});return a;}

function jsonArticleNodes_(html){var out=[],rx=/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,m;
 function visit(x){if(!x||typeof x!=='object')return;if(Array.isArray(x)){x.forEach(visit);return;}var type=[].concat(x['@type']||[]);if(type.some(function(t){return /^(NewsArticle|Article|ReportageNewsArticle|LiveBlogPosting)$/.test(t);}))out.push(x);if(x['@graph'])visit(x['@graph']);if(x.itemListElement)visit(x.itemListElement);if(x.item)visit(x.item);}
 while((m=rx.exec(html))!==null){try{visit(JSON.parse(m[1]));}catch(e){}}return out;
}

function metaValue_(html,names){var tags=String(html).match(/<meta\b[^>]*>/gi)||[];for(var i=0;i<tags.length;i++){var a=htmlAttrs_(tags[i]);if(names.indexOf((a.property||a.name||a.itemprop||'').toLowerCase())>=0&&a.content)return a.content;}return '';}

function explicitUTC_(value){value=String(value||'').trim();if(!/^\d{4}-\d\d-\d\d[T ]\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:?\d\d)$/i.test(value))return '';var d=new Date(value);return isNaN(d.getTime())?'':d.toISOString();}

function listingCandidates_(html,feed,win,registry){
 var rows=[],seen={},domain=feed.publisherDomain||getHost_(feed.url),source=sourceFor_(feed.name,feed.url,feed,registry);
 function add(title,url,date,description){title=cleanText_(title);url=canonicalURL_(resolveURL_(url,feed.url));
  if(!sourceDomainsMatch_(url,domain)||!title||tokens_(title).length<5||tokens_(title).length>50||/^(read more|latest news|privacy policy|terms of|subscribe|contact us|about us)/i.test(title)||seen[url]||url.replace(/\/$/,'')===feed.url.replace(/\/$/,''))return;
  if(/\/(?:tag|category|author|search)\/|[?&](?:s|page)=/i.test(url))return;seen[url]=true;
  var pub=explicitUTC_(date);if(pub&&(new Date(pub)<win.start||new Date(pub)>win.end))return;
  var it={id:hash_(url+'|'+title),headline:title,source:source.name,sourceCountry:source.country,sourceDomain:domain,sourceVerified:source.verified,
   link:url,originalLink:url,description:descriptionEvidence_(title,description||'',false),published:pub,collected:now_().toISOString(),feed:feed.url,
   contentStatus:'headline_only',wire:'',selected:false,aiStatus:'rules',decision:'candidate',pendingPublication:!pub,dateEvidence:pub?'publisher_listing':'publication_verification_pending'};
  it.country=countryFor_(it);it.countries=countryHits_(title+' '+it.description);if(!it.countries.length&&it.country)it.countries=[it.country];
  it.category=COUNTRY_TO_DESK[it.country]||(/\b(osce|odihr)\b/i.test(title)?'General':'International');it.topic=topics_(title).join('; ');it.summary=it.description||title;if(it.description)it.contentStatus='publisher_listing_excerpt';rows.push(it);
 }
 jsonArticleNodes_(html).forEach(function(x){add(x.headline||x.name,x.url||x.mainEntityOfPage&&x.mainEntityOfPage['@id']||'',x.datePublished,x.description);});
 var rx=/<a\b([^>]*)>([\s\S]*?)<\/a>/gi,m;while((m=rx.exec(html))!==null){var a=htmlAttrs_(m[1]);if(a.href)add(a.title||cleanText_(m[2]),a.href,'','');}
 return rows.filter(englishLikely_);
}

function extractPage_Prior11_(html,expectedTitle){
 if(/<title[^>]*>\s*(?:just a moment|access denied|sign in|login|robot|captcha)/i.test(html))return null;
 var nodes=jsonArticleNodes_(html),h1=(String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1];
 if(expectedTitle&&nodes.some(function(x){return x.headline;})){var matching=nodes.filter(function(x){return x.headline&&similarity_(cleanText_(x.headline),expectedTitle)>=0.25;});nodes=matching;}
 var title=cleanText_(nodes[0]&&nodes[0].headline||h1||metaValue_(html,['og:title']));
 if(expectedTitle&&title&&similarity_(title,expectedTitle)<0.25)return null;
 var date=explicitUTC_(nodes[0]&&nodes[0].datePublished)||explicitUTC_(metaValue_(html,['article:published_time','datepublished','pubdate','publishdate','publication_date']))||publishedTimeTag_(html);
 var text='',status='';nodes.forEach(function(x){var body=cleanText_(x.articleBody||'');if(body.length>text.length){text=body;status='publisher_article_body';}});
 if(!text){var container=articleContainer_(html);container=container.replace(/<(aside|nav|script|style|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  var paras=[],rx=/<p\b[^>]*>([\s\S]*?)<\/p>/gi,m;while((m=rx.exec(container))!==null){var p=cleanText_(m[1]);if(tokens_(p).length<8||/^(subscribe|sign up|read also|read more|related|advertisement|all rights reserved|we use cookies|follow us|share this)/i.test(p))continue;paras.push(p);}text=paras.join('\n\n');if(text)status='publisher_article_html';
 }
 if(!text){text=descriptionEvidence_(expectedTitle||title,metaValue_(html,['og:description','description']),false);if(text)status='publisher_meta_excerpt';}
 if(!text&&!date)return null;
 var canonical='';(String(html).match(/<link\b[^>]*>/gi)||[]).some(function(tag){var a=htmlAttrs_(tag);if(/canonical/i.test(a.rel||'')&&safeURL_(a.href)){canonical=a.href;return true;}return false;});
 var wire='',authors=[];nodes.forEach(function(x){[].concat(x.author||[]).forEach(function(a){authors.push(typeof a==='string'?a:a&&a.name||'');});});authors.push(metaValue_(html,['author']));
 authors.some(function(a){if(/^(Reuters|AFP|AP|Associated Press|Agence France-Presse|dpa)$/i.test(String(a).trim())){wire=/Associated Press/i.test(a)?'AP':/Agence France-Presse/i.test(a)?'AFP':String(a).trim();return true;}return false;});
 if(!wire){var credit=(text.slice(0,500).match(/(?:by|reporting by|copyright|©|\(c\))\s+[^.]{0,80}\b(Reuters|AFP|AP|dpa)\b/i)||[])[1];if(credit)wire=credit;}
 wire=newsExplicitWire_(authors,text)||wire;
 return {text:text.slice(0,14000),status:status||'headline_only',published:date,title:title,canonical:canonical,wire:wire};
}

function evidenceExcerpt_(text,maxWords){
 var words=String(text||'').trim().split(/\s+/);if(words.length<=maxWords)return words.join(' ');
 var cut=words.slice(0,maxWords).join(' '),last=Math.max(cut.lastIndexOf('. '),cut.lastIndexOf('! '),cut.lastIndexOf('? '));return last>cut.length*0.5?cut.slice(0,last+1):cut+'…';
}

function selectArticles_Prior13_(items){
 items.forEach(function(it){it.selected=false;});
 var eligible=items.filter(function(it){return !it.forceExclude&&!it.publicationRejected&&(it.forceInclude||(!it.previouslyPrinted&&it.score>=NEWS.MIN_SCORE&&remit_(it)));});
 eligible.sort(function(a,b){return Number(!!b.forceInclude)-Number(!!a.forceInclude)||editorialRank_(b)-editorialRank_(a)||b.published.localeCompare(a.published)||a.id.localeCompare(b.id);});
 var chosen=[],deskCounts={},pubCounts={},countryCounts={};
 function add(it){if(it.selected)return false;var desk=it.category,key=desk+'|'+it.source,c=it.country;
  if(!it.forceInclude&&chosen.some(function(old){return duplicates_(it,old);})){it.decision='duplicate_development';return false;}
  if(!it.forceInclude&&((deskCounts[desk]||0)>=(NEWS.DESK_LIMITS[desk]||8)||(pubCounts[key]||0)>=NEWS.MAX_ONE_PUBLISHER_PER_DESK||(c&&(countryCounts[c]||0)>=(COUNTRY_LIMITS[c]||8))||chosen.length>=NEWS.MAX_TOTAL)){it.decision='capacity_or_source_diversity';return false;}
  it.selected=true;it.decision=it.forceInclude?'editor_included':'selected';chosen.push(it);deskCounts[desk]=(deskCounts[desk]||0)+1;pubCounts[key]=(pubCounts[key]||0)+1;if(c)countryCounts[c]=(countryCounts[c]||0)+1;return true;}
 function countryRound(round){Object.keys(COUNTRY_TO_DESK).forEach(function(c){if((countryCounts[c]||0)>round)return;var pool=eligible.filter(function(it){return it.country===c&&!it.selected;});for(var i=0;i<pool.length;i++)if(add(pool[i]))break;});}
 eligible.filter(function(it){return it.forceInclude;}).forEach(add);countryRound(0);
 // Coverage target, not a quota: ordinary eligibility, deduplication and caps apply.
 var target=Math.floor(NEWS.MAX_TOTAL*NEWS.INTERNATIONAL_SELECTION_SHARE),globalCount=chosen.filter(function(it){return !COUNTRY_TO_DESK[it.country];}).length;
 eligible.filter(function(it){return !COUNTRY_TO_DESK[it.country];}).forEach(function(it){if(globalCount<target&&add(it))globalCount++;});
 countryRound(1);countryRound(2);eligible.forEach(add);chosen.sort(function(a,b){return editorialRank_(b)-editorialRank_(a)||b.published.localeCompare(a.published);});
 items.forEach(function(it){if(it.previouslyPrinted&&!it.selected&&!it.forceInclude)it.decision='unchanged_recent_story';if(!it.selected&&it.decision==='candidate')it.decision=it.score<NEWS.MIN_SCORE?'below_threshold':'not_selected';});return chosen;
}

function publishedTimeTag_(html){
 var dates=[];(String(html).match(/<time\b[^>]*>/gi)||[]).forEach(function(tag){var a=htmlAttrs_(tag),label=[a.itemprop,a.class,a.id,a['aria-label']].join(' ');
  if(/updated|modified/i.test(label)||!/(?:datepublished|(?:^|[\s_-])published(?:$|[\s_-])|publication)/i.test(label))return;
  var date=explicitUTC_(a.datetime);if(date&&dates.indexOf(date)<0)dates.push(date);});
 // Ambiguous page clocks are not used; a timezone must be explicit.
 return dates.length===1?dates[0]:'';
}

function decodeHTMLEntities_Prior13_(s){var named={nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',rsquo:'’',lsquo:'‘',rdquo:'”',ldquo:'“',ndash:'–',mdash:'—',hellip:'…',euro:'€',pound:'£',middot:'·'};return String(s||'').replace(/&([a-z]+);/gi,function(m,k){return named[k.toLowerCase()]===undefined?m:named[k.toLowerCase()];}).replace(/&#(x[\da-f]+|\d+);/gi,function(m,n){var v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return Number.isInteger(v)&&v>=0&&v<=0x10ffff?String.fromCodePoint(v):'';});}

function foreignIncident_(h){return /\b(saudi|riyadh|king khalid|yemen|houthi|greek refinery|greece|tel aviv|gaza|sanaa|pyongyang)\b/i.test(h)&&/\b(attack|attacks|strike|strikes|hit|hits|explosion|kills?|killed|injur|dead|fire|retaliat|vows|missile|airport|conflict|tension|war)\b/i.test(h);}

function regionalInstitution_(h){return /\b(mfa|foreign ministry|foreign affairs|ministry|president|prime minister|pm|embassy|consular|condemns?|citizens|nationals|workers?)\b/i.test(h)&&(/\b(condemns?|advises?|warns?|responds?|statement|assistance|evacuat[a-z]*|not among|no .*citizens|sustain.*injur[a-z]*)\b/i.test(h)||Object.keys(CPC_ACTORS).some(function(c){return CPC_ACTORS[c].test(geographyText_(h));}));}

function foreignInstitutionPrimary_Prior13_(h){if(/\b(?:echr|court)\b.*\bcomplaint\b.*\b(?:georgian|armenian|moldovan|serbian)\b/i.test(h))return false;return /^(?:Canada|Canadian|France|French|Germany|German|Netherlands|Dutch|Lithuania|Lithuanian|Estonia|Estonian|Poland|Polish|United States|US|EU|European Commission)\b/i.test(h)&&/\b(prime minister|pm|parliament|government|president|minister|intercepts?|detains?|arrests?|condemns?|denounces?|pledges?|announces?)\b/i.test(h)&&!/\b(support|aid|funding|training)\b.*\b(armenia|moldova|georgia|ukraine|kosovo|serbia)\b.*\b(border|institution|project|programme|assistance|training)\b/i.test(h);}

function countryFor_Prior13_(it){if(foreignIncident_(it.headline)&&!regionalInstitution_(it.headline)||foreignInstitutionPrimary_(it.headline))return '';return countryFor_Prior11_(it);}

function remit_Prior13_(it){return remit_Prior11_(it)||/\b(?:brussels|dutch|netherlands|flydubai|uae|tel aviv|putin|kremlin|medvedev|carney|canadian|canada|nobel.*human rights)\b/i.test(it.headline)||/^US\b/.test(it.headline);}

function baselineScore_Prior13_(it){var h=it.headline||'';
 if(/\b(judo|football|basketball|tennis|world championships?|championships|tournament)\b/i.test(h)&&!/\b(rights|political|sanctions|corruption|protest)\b/i.test(h)){it.decision='sports_without_policy_development';return 0;}
 if(/\b(arrived?|arrives?|touch down|touches down|welcome[sd]?)\b/i.test(h)&&/\b(state visit|king|queen|summit|sco|president)\b/i.test(h)&&!/\b(agreement|signed|talks|security|negotiation|policy)\b/i.test(h)){it.decision='arrival_without_substantive_development';return 0;}
 var original=h;if(/birthday visit/i.test(h)&&/leader|outraged|putin|schroeder/i.test(h))it.headline=h.replace(/birthday/ig,'private');var score=baselineScore_Prior11_(it);it.headline=original;if(!score)return score;
 var severe=/\b(?:[1-9]\d{1,}|hundreds)\s+(?:people\s+)?(?:injured|killed|dead)|kills?\s+(?:1[0-9]|[2-9]\d|\d{3,})\b/i.test(h),critical=/airport|power (?:plant|grid)|critical infrastructure/i.test(h)&&/attack|strike|blackout|disrupt|suspend|closed/i.test(h);
 if(severe||critical){it.features.impact=Math.max(it.features.impact,4);if(severe&&critical)it.urgent=true;score=score_(it.features);}return score;
}

function evidenceKey_Prior13_(it){var h=String(it.headline||'').toLowerCase(),old=evidenceKey_Prior11_(it);if(old)return old;
 if(/energy ceasefire/.test(h)&&/trump|russia|ukrain|kyiv|zelensky/.test(h)&&!/accuses|despite|continue|violat|after.*(?:announcement|ceasefire)|power plant/.test(h)&&!/what.s behind|watch:|analysis/.test(h))return 'ukraine-russia-energy-ceasefire-announcement';
 if(/energy ceasefire/.test(h)&&/accuses|despite|attacks continue|violat/.test(h))return 'ukraine-response-energy-ceasefire-violations';
 if(/riyadh|king khalid|saudi.*airport/.test(h)&&/attack|strike|killed|kills|hit/.test(h)&&!/condemn|citizens|nationals|retaliat|respond|analysis|tense conflict/.test(h))return /second|new attack|fresh|sunday|one dead|at least 1|in two days/.test(h)?'riyadh-airport-follow-up-strike':'riyadh-airport-initial-strike';
 if(/poland|polish/.test(h)&&/tusk/.test(h)&&/arrest|detain|plot|attack|assassination/.test(h))return 'poland-tusk-assassination-plot-arrest';return '';
}

function topRank_Prior13_(it){var h=it.headline||'',rank=topRank_Prior11_(it);if(/airport|power grid|critical infrastructure/i.test(h)&&/attack|strike|damage|disrupt|ceasefire/i.test(h))rank+=12;if(/children/i.test(h)&&/killed|dead|strikes/i.test(h))rank+=10;return rank;}

function articleContainer_(html){var rx=/<\/?(article|div|section|main)\b[^>]*>/gi,m,stack=[];
 while((m=rx.exec(html))!==null){var tag=m[0],closing=/^<\//.test(tag),type=m[1].toLowerCase();if(!closing){var a=htmlAttrs_(tag),label=[a.class,a.id,a.itemprop,a['data-component']].join(' '),named=type==='article'||/articlebody|article[-_ ]?body|article[-_ ]?content|entry-content|post-content|story[-_ ]?(?:body|content)|news-content|rich-text|text-block|wysiwyg/i.test(label);stack.push({type:type,start:rx.lastIndex,named:named});}else{var i=stack.length-1;while(i>=0&&stack[i].type!==type)i--;if(i<0)continue;var f=stack[i];stack=stack.slice(0,i);if(f.named){var body=html.slice(f.start,m.index);if(/<p\b/i.test(body))return body;}}}return '';}

function extractPage_Prior13_(html,expectedTitle){if(/<title[^>]*>\s*(?:just a moment|access denied|sign in|login|robot|captcha)/i.test(html))return null;var page=extractPage_Prior11_(html,expectedTitle);if(page&&page.text)return page;
 var h1=cleanText_((String(html).match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)||[])[1]||metaValue_(html,['og:title']));if(!h1||expectedTitle&&similarity_(h1,expectedTitle)<0.35)return page;
 var main=(String(html).match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)||[])[1]||'',titlePos=main.search(/<h1\b/i);if(titlePos<0)return page;main=main.slice(titlePos).replace(/<(nav|aside|footer|figure|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
 var p=main.match(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)||[],text=p.map(cleanText_).filter(function(t){return tokens_(t).length>=8&&!/^(subscribe|sign up|read more|related|advertisement|image|photo|credit|copyright|we use cookies)/i.test(t);}).slice(0,8).join('\n\n');if(!text)return page;
 return Object.assign(page||{published:publishedTimeTag_(html),wire:'',canonical:'',title:h1},{text:text.slice(0,14000),status:'publisher_article_html'});
}

function descriptionEvidence_Prior13_(title,description,isSearch){var d=cleanText_(description),tt=tokens_(title),dt=tokens_(d),set=new Set(dt),covered=tt.filter(function(t){return set.has(t);}).length/Math.max(1,tt.length);
 if(isSearch||!d||d.length<60||/stay informed with.*latest|latest breaking news from.*all in one place|subscribe to our|sign up for our|all rights reserved/i.test(d)||similarity_(title,d)>0.72||(covered>0.9&&dt.length<=tt.length+9))return '';return d.slice(0,4000);}

function usGeorgia_(text,source){return usGeorgia_Prior13_(text)||/\bgeorgia\b/i.test(text)&&(/\b(six flags|roller coaster|rollercoaster|amusement park|gubernatorial|governor debate|governor.*election|atlanta)\b/i.test(text)||/wsb.?tv|wsbtv\.com|ajc\.com|fox5atlanta|atlantanewsfirst|georgiarecorder/i.test(source||'')&&!/tbilisi|abkhazia|south ossetia|georgian dream/i.test(text));}

function newsPolicyExclusion_(it){var h=it.headline||'',s=it.sourceDomain+' '+it.source,t=h+' '+(it.description||'');
 if(usGeorgia_(t,s))return 'US_state_Georgia_out_of_scope';
 if(/\b(six flags|roller coaster|rollercoaster|amusement park)\b/i.test(h)&&!/\b(terror|political violence|safety regulation|government inquiry)\b/i.test(h))return 'ordinary_accident_without_policy';
 if(/\b(ronaldo|russell brand|footballer|superstar|singer|new album|music album|band|musical|celebrity|comedian)\b/i.test(h)&&!/\b(censorship|rights|hate crime|terrorism|political|dissent|court.*government|regulation|curriculum|(?:public|state|government|arts) funding|corruption|opposition)\b/i.test(h))return 'culture_or_celebrity_without_policy';
 if(/^(?:project\s+)?fact\s*sheet|^project factsheet|^brochure|^vacanc(?:y|ies)|^job opening/i.test(h)&&!/\b(launch|released?|announces?|new funding|evaluation)\b/i.test(h))return 'static_reference_not_daily_development';
 return '';
}

function foreignInstitutionPrimary_(h){if(/\b(kosovo|georgian|georgia|armenian|armenia|moldovan|moldova)\b/i.test(h)&&/\b(court|chambers|law|laws|opposition|political backsliding|new projects|funded projects)\b/i.test(h))return false;return foreignInstitutionPrimary_Prior13_(h);}

function countryFor_(it){if(usGeorgia_(it.headline+' '+(it.description||''),it.sourceDomain+' '+it.source))return '';return countryFor_Prior13_(it);}

function remit_(it){return remit_Prior13_(it)||/\b(?:greenland|unctad|unhcr|icc|international criminal court|international court of justice)\b/i.test(it.headline+' '+(it.description||''));}

function baselineScore_(it){var excluded=newsPolicyExclusion_(it);if(excluded){it.decision=excluded;it.urgent=false;return 0;}var h=it.headline,political=/\b(papuashvili|georgian parliament speaker)\b/i.test(h)&&/congratulat/i.test(h)&&/hatred|critici|days.*towards europe/i.test(h);if(political)it.headline=h.replace(/congratulat[a-z]*/ig,'criticises');var score=baselineScore_Prior13_(it);it.headline=h;return score;}

function selectArticles_(items){items.forEach(function(it){var reason=newsPolicyExclusion_(it);if(reason&&!it.forceInclude){it.score=0;it.urgent=false;it.country='';it.countries=[];it.category='International';it.decision=reason;}else if(/\bvinnytsia\b/i.test(it.headline)||foreignIncident_(it.headline)&&regionalInstitution_(it.headline)||/^(?:EU|European)/i.test(it.headline)&&/\b(?:court|chambers|law|new projects)\b/i.test(it.headline)){var c=countryFor_(it);if(c){it.country=c;it.countries=Array.from(new Set([c].concat(it.countries||[])));it.category=COUNTRY_TO_DESK[c];}}});return selectArticles_Prior13_(items);}

function sourceFor_(raw,url,feed,registry){var host=getHost_(url),label=String(raw||'').trim();label=SOURCE_ALIASES[label.toLowerCase()]||label;var match=registry.find(function(s){return host===s.domain||host.endsWith('.'+s.domain);})||registry.find(function(s){return label.toLowerCase()===s.name.toLowerCase();}),domain=match?match.domain:(feed.publisherDomain||(host&&host!=='news.google.com'?host:''));if(match&&/^(?:bbc\.com|bbc\.co\.uk|bbci\.co\.uk)$/.test(host)&&/^BBC$/i.test(match.name))domain=host;return {name:match?match.name:(label||feed.name||host),country:match?match.country:feed.country,domain:domain,verified:!!match};}

function sourceDomainsMatch_(url,domain){var host=getHost_(url),bbc=/^(?:bbc\.com|bbc\.co\.uk|bbci\.co\.uk)$/;if(bbc.test(domain||''))return bbc.test(host);return sourceDomainsMatch_Prior13_(url,domain);}

function decodeHTMLEntities_(text){var names={bdquo:'„',sbquo:'‚',eacute:'é',Eacute:'É',aacute:'á',iacute:'í',oacute:'ó',uacute:'ú',agrave:'à',egrave:'è',ouml:'ö',auml:'ä',uuml:'ü',Ouml:'Ö',Auml:'Ä',Uuml:'Ü',szlig:'ß',ccedil:'ç',ntilde:'ñ'};return decodeHTMLEntities_Prior13_(String(text||'').replace(/&([A-Za-z]+);/g,function(m,n){return names[n]===undefined?m:names[n];}));}

function newsCleanEvidence_(text){var t=newsRepairEncoding_(String(text||'')).replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/p>/gi,'\n\n');t=decodeHTMLEntities_(t);
 var parts=t.split(/\n+/).map(cleanText_).filter(function(p){return p&&!/^(?:this|the)\s+(?:live\s*)?blog\s+is\s+(?:now\s+)?closed\b|^(?:this|it)\s+was\s+a\s+roundup\s+of\s+headlines|^live (?:blog|coverage) has (?:ended|closed)|^an in.depth look at the key polling/i.test(p);});t=parts.join(' ');
 t=t.replace(/(?:The )?Astana Times provides news and information from Kazakhstan and around the world\.?\s*/gi,'').replace(/(?:This|The) (?:live\s*)?blog is (?:now )?closed\.[\s\S]*?(?:It was a roundup of headlines[^.]*\.)?/gi,'').replace(/It was a roundup of headlines[^.]*\./gi,'');
 return cleanText_(t).replace(/\s+/g,' ').trim();
}

function newsSentenceBank_(text){var t=newsCleanEvidence_(text),parts=[],start=0,rx=/[.!?](?:["”’])?(?:\s+|$)/g,m;
 while((m=rx.exec(t))!==null){var before=t.slice(Math.max(0,m.index-14),m.index);if(/\b(?:Mr|Mrs|Ms|Dr|Prof|Gen|Col|Maj|Capt|Lt|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|U\.S|U\.K|No)$/i.test(before))continue;parts.push(t.slice(start,rx.lastIndex).trim());start=rx.lastIndex;}
 if(start<t.length)parts.push(t.slice(start).trim());return parts.filter(function(p){return p.split(/\s+/).length>=3;}).slice(0,40);
}

function compactSummary_(text,words){var t=newsCleanEvidence_(text).replace(/^By\s+(?:Reuters|AFP|AP|Associated Press|dpa)[.:\s]+/i,'');var bank=newsSentenceBank_(t),parts=bank.slice(0,NEWS.SUMMARY_SENTENCES);return t?evidenceExcerpt_(parts.length?parts.join(' '):t,words||NEWS.SUMMARY_WORDS):'';}

function descriptionEvidence_(title,description,isSearch){var t=newsCleanEvidence_(description);if(!t)return '';if(/\blive\s*:/i.test(title)){var target=title.split(/live\s*:/i).pop(),keys=tokens_(target).filter(function(k){return !/^(war|live|news|updates|latest|breaking|says|urges|efforts|stronger)$/.test(k);}),found=keys.filter(function(k){return tokens_(t).includes(k);});if(found.length<Math.min(2,keys.length))return '';}
 return descriptionEvidence_Prior13_(title,t,isSearch);
}

function publicSummary_(it,top){var candidates=[it.summary,it.articleBody,it.description];if(it.contentStatus==='headline_only'&&!it.articleBody)return '';for(var i=0;i<candidates.length;i++){var text=descriptionEvidence_(it.headline,candidates[i]||'',false);if(i===0&&/;extractive_summary_selected/.test(it.aiStatus||'')){var trusted=newsCleanEvidence_(it.summary);if(trusted.length>=20&&tokens_(trusted).length>=3)text=trusted;}if(!text)continue;var h=cleanText_(it.headline),tail=text.slice(h.length);if(text.toLowerCase().startsWith(h.toLowerCase())&&/^\s+[A-Z]/.test(tail)&&tokens_(tail).length>=8)text=tail.trim();var summary=compactSummary_(text,top?NEWS.TOP_SUMMARY_WORDS:NEWS.SUMMARY_WORDS);if(summary)return summary;}return '';}

function evidenceWords_(it){var t=descriptionEvidence_(it.headline,it.articleBody||it.description||'',false);return t?t.split(/\s+/).filter(Boolean).length:0;}

function extractPage_(html,title){var page=extractPage_Prior13_(html,title);if(!page)return null;page.text=newsCleanEvidence_(page.text);if(!page.text||/\blive\s*:/i.test(title||page.title)&&!descriptionEvidence_(title||page.title,page.text,false)){page.text='';page.status='headline_only';}return page;}

function evidenceKey_(it){var h=String(it.headline||'').toLowerCase();if(/\b(?:energy|power|electricity)\b/.test(h)&&/\b(?:ceasefire|truce)\b/.test(h)&&/despite|continu|doubt|since.*announc|accuses|violation|strikes.*(?:sites|facilities)/.test(h)&&!/\b(?:macron|france|french|retaliat|will respond|kremlin|peskov|lavrov|kharkiv|lviv|zaporizh|izium|izyum)\b/.test(h))return 'ukraine-energy-ceasefire-implementation-update';
 if(/\bnato\b/.test(h)&&/commander|general|grynkewich/.test(h)&&/foolish|utterly futile/.test(h)&&/russia|russian/.test(h))return 'nato-commander-foolish-attack-deterrence';
 if(/\bnato\b/.test(h)&&/commander/.test(h)&&/theory of victory|plan for victory/.test(h))return 'nato-commander-theory-of-victory';
 if(/\b(?:uk|british|burnham)\b/.test(h)&&/raf fairford/.test(h)&&/iran|irgc/.test(h)&&/behind|directed|responsib/.test(h)&&!/condemn|calls? for|sanctions|arrests?/.test(h))return 'uk-fairford-iran-attribution';
 return evidenceKey_Prior13_(it);}

function newsTopFamily_(it){var sea=newsBlackSeaIncident_(it);if(sea)return 'black-sea-shipping-attacks';var h=String(it.headline||'').toLowerCase();if(/ceasefire|energy truce/.test(h)&&/energy|power|electricity/.test(h)&&/ukrain|russia|zelensk|trump/.test(h)&&!/kremlin|peskov|lavrov|60.day|will respond|retaliat/.test(h))return 'ukraine-energy-ceasefire-implementation';if(/\bnato\b/.test(h)&&/commander|theory of victory|ready to fight|utterly futile|foolish/.test(h))return 'nato-commander-deterrence-statement';if(/\bnato\b/.test(h)&&/steadfast noon|nuclear (?:exercise|drill)/.test(h))return 'nato-current-nuclear-exercise';if(/\beu\b|european union/.test(h)&&/sanction/.test(h)&&/russia|russian/.test(h)&&/1[, ]?600|biggest|largest|military.industri|drone.*missile/.test(h))return 'eu-russia-current-sanctions-package';return evidenceKey_(it)||'';}

function newsRoutineMilitaryTally_(h){return /neutraliz|shot down|shoots down|intercepts?|loses another|troops.*(?:one day|past day)|daily.*loss/i.test(h)&&/\b(?:\d[\d,]*|drones?|troops|soldiers)\b/i.test(h)&&!/civilian|children|deadly|casualt|blackout|critical infrastructure|massive attack/i.test(h);}

function newsMajorSanctions_(h){return /\beu\b|european union/i.test(h)&&/sanction/i.test(h)&&/Russia|Russian/i.test(h)&&/biggest|largest|1[, ]?600|drone.*missile|military.industri/i.test(h);}

function topRank_(it){var rank=topRank_Prior13_(it);if(newsMajorSanctions_(it.headline))rank+=22;var summary=publicSummary_(it,true);return rank+(summary?10:0);}

function topItems_(items){
 var chosen=[],families={},regions={};
 var pool=items.filter(newsTopEligible_);
 // Relevance first, then the best publisher for each incident; local coverage only
 // when no major outlet in this edition covers that incident.
 pool=pool.filter(function(it){return newsTopSourceTier_(it)>0||!pool.some(function(other){return newsTopSourceTier_(other)>0&&newsSameLead_(it,other);});});
 pool.sort(function(a,b){return newsOSCEPriority_(b)-newsOSCEPriority_(a)||newsTopSourceTier_(b)-newsTopSourceTier_(a)||topRank_(b)-topRank_(a);});
 pool.forEach(function(it){
  var region=COUNTRY_TO_DESK[it.country]||it.category||'International',family=newsTopFamily_(it);
  if(chosen.length>=NEWS.TOP_STORIES||(regions[region]||0)>=2||family&&families[family]||chosen.some(function(old){return newsSameLead_(it,old);}))return;
  chosen.push(it);if(family)families[family]=true;regions[region]=(regions[region]||0)+1;
 });return chosen;
}

function newsRepairEncoding_(text){
 // Repair only known UTF-8 punctuation misread as Windows-1252/Latin-1.
 // Never transcode entire strings: correctly encoded names must stay intact.
 var t=String(text||''),pairs=[['\u00e2\u20ac\u2122','\u2019'],['\u00e2\u20ac\u02dc','\u2018'],['\u00e2\u20ac\u0153','\u201c'],['\u00e2\u20ac\u009d','\u201d'],['\u00e2\u20ac\u201c','\u2013'],['\u00e2\u20ac\u201d','\u2014'],['\u00e2\u20ac\u00a6','\u2026'],['\u00e2\u2030\u02c6','\u2248'],['\u00c2\u00a0',' '],['\u00e2\u0080\u0099','\u2019'],['\u00e2\u0080\u0098','\u2018'],['\u00e2\u0080\u009c','\u201c'],['\u00e2\u0080\u009d','\u201d'],['\u00e2\u0080\u0093','\u2013'],['\u00e2\u0080\u0094','\u2014'],['\u00e2\u0080\u00a6','\u2026']];
 pairs.forEach(function(p){t=t.split(p[0]).join(p[1]);});return t;
}

function newsNormalWire_(label){var t=String(label||'').trim();return /^(?:AP|AP News|Associated Press)$/i.test(t)?'AP':/^(?:AFP|AFP\.com|Agence France.Presse)$/i.test(t)?'AFP':/^Reuters$/i.test(t)?'Reuters':/^dpa$/i.test(t)?'dpa':'';}

function newsExplicitWire_(authors,text){
 var wire='';(authors||[]).some(function(a){
  var t=String(a||'').trim();if(/photo|image|picture|video|illustration/i.test(t))return false;
  wire=newsNormalWire_(t);if(!wire){var m=t.match(/(?:^|[,/|]\s*|\s+(?:with|and)\s+)(AFP|Reuters|Associated Press|Agence France-Presse|AP|dpa)\s*$/i);if(m)wire=newsNormalWire_(m[1]);}return !!wire;
 });
 if(!wire){var lead=String(text||'').slice(0,240),m=lead.match(/^[^.!?\n]{0,150}\((AP|AFP|Reuters|dpa)\)\s*(?:[-\u2013\u2014:]|[A-Z])/);if(m&&!/photo|image|picture|video|illustration/i.test(lead.slice(0,m.index+m[0].indexOf('('))))wire=newsNormalWire_(m[1]);}
 return wire;
}

var NEWS_EU_SOURCES=[
 {domain:'gulfnews.com',name:'Gulf News',country:'International'},
 {domain:'english.aawsat.com',name:'Asharq Al-Awsat',country:'International'},
 {domain:'indopremier.com',name:'IPOT News',country:'International'},
 {domain:'en.philenews.com',name:'Phileleftheros',country:'International'}
];

function newsTopSourceTier_(it){
 var wire=newsNormalWire_(it.wire),own=newsNormalWire_(it.source);
 if(/^(AP|AFP|Reuters|dpa)$/.test(wire||own))return 3;
 return /^(BBC(?: News)?|CNN|DW|France 24|Al Jazeera|Guardian|The Guardian|Financial Times|Bloomberg|New York Times|The New York Times|Washington Post|Wall Street Journal|Sky News|Euronews|Politico Europe)$/i.test(String(it.source||'').trim())?2:0;
}

function newsTopEligible_(it){
 if(!newsOSCEPriority_(it)||newsUnverifiedPlatform_(it)||it.forceExclude||it.publicationRejected||it.pendingPublication||!safeURL_(it.link)||Number(it.score)<NEWS.MIN_SCORE)return false;
 if(newsPolicyExclusion_(it)||newsRoutineMilitaryTally_(it.headline)||/\b(opinion|editorial|in photos|photo gallery|live updates)\b/i.test(it.headline))return false;
 if(!newsTopSourceTier_(it)&&newsOSCEPriority_(it)<3)return false;
 return !!(it.urgent||Number((it.features||{}).impact)>=4||newsMajorSanctions_(it.headline)||/attack|strike|ceasefire|sanction|election|protest|nato|osce|missile|summit|peace talks|detain|court|government|security|defen[cs]e/i.test(it.headline));
}

var NEWS_BRIEF_THEMES=[
 {id:'black-sea-shipping',label:'Black Sea shipping and NATO response',test:/\b(?:black sea|romanian waters|romania.{0,30}coast|bulgaria.{0,30}coast)\b.*\b(?:ship|vessel|tanker|drone|attack|strike)|\b(?:ship|vessel|tanker|drone)\b.*\b(?:black sea|romania|bulgaria)\b/i,watch:'Are further vessels or ports affected, and what protective measures do Romania, Bulgaria or NATO announce?'},
 {id:'ukraine-energy-truce',label:'Russia-Ukraine: energy strikes and ceasefire commitments',test:/\b(?:ukrain|russi|zelensk)[a-z]*\b.*\b(?:truce|ceasefire|refiner|energy|power|oil depot)[a-z]*|\b(?:truce|ceasefire|refiner|energy|power|oil depot)[a-z]*\b.*\b(?:ukrain|russi|zelensk)[a-z]*\b/i,watch:'Do the parties announce matching ceasefire terms, and do subsequent reports document continued strikes on energy facilities?'},
 {id:'albania-protests',label:'Albania: protests and government response',test:/\b(?:albania|albanian|tirana|rama)\b.*\b(?:protest|clash|unrest|resign|crisis|student)[a-z]*|\b(?:protest|clash|unrest)[a-z]*\b.*\b(?:albania|tirana)\b/i,watch:'Do protests spread or subside, and are there verified changes in arrests, policing, parliamentary activity or government concessions?'},
 {id:'serbia-elections',label:'Serbia: election integrity',test:/\bserbi[a-z]*\b.*\b(?:elect|vot|observer|monitor|ballot)[a-z]*|\b(?:elect|vot|observer|monitor|ballot)[a-z]*\b.*\bserbi[a-z]*\b/i,watch:'What do election authorities and observers confirm about results, complaints, safety and any corrective action?'},
 {id:'yemen-houthi',label:'Yemen and Saudi Arabia: Houthi attacks',test:/\b(?:houthi|yemen|aden|saudi|riyadh)[a-z]*\b.*\b(?:attack|missile|strike|palace|coalition|killed|ceasefire)[a-z]*|\b(?:attack|missile|strike)[a-z]*\b.*\b(?:houthi|yemen|aden|saudi|riyadh)[a-z]*\b/i,watch:'Are casualties and targets independently confirmed, and do the parties announce retaliation, defensive measures or ceasefire contacts?'},
 {id:'georgia-opposition',label:'Georgia: opposition and civic space',test:/\b(?:georgia|georgian|tbilisi)\b.*\b(?:opposition|protest|court|ban|detain|law|political)[a-z]*|\b(?:opposition|protest)[a-z]*\b.*\b(?:georgia|tbilisi)\b/i,watch:'What decisions are issued on opposition parties and civic freedoms, and how do authorities respond to announced protests?'},
 {id:'bosnia-constitutional',label:'Bosnia and Herzegovina: constitutional and government disputes',test:/\b(?:bosnia|bih|dodik|republika srpska)\b.*\b(?:constitut|govern|secess|capital|coalition)[a-z]*|\b(?:constitut|govern)[a-z]*\b.*\b(?:bosnia|bih|republika srpska)\b/i,watch:'Do the announced proposals become formal parliamentary or constitutional decisions, and how do state institutions respond?'},
 {id:'moldova-eu',label:'Moldova: EU accession and political resilience',test:/\bmoldov[a-z]*\b.*\b(?:eu|accession|election|interference|disinformation|reform)|\b(?:eu|accession|interference)\b.*\bmoldov[a-z]*\b/i,watch:'Which accession steps or electoral safeguards are formally adopted, and which remain political statements or allegations?'},
 {id:'ukraine-war',label:'Ukraine: military developments and civilian impact',test:/\b(?:ukrain[a-z]*|kyiv|kharkiv|khmelnytskyi|kirovohrad|russi[a-z]*|rostov)\b.*\b(?:war|drone|attack|strike|military|missile|killed|base)|\b(?:drone|attack|strike|missile)\b.*\b(?:ukrain[a-z]*|kyiv|kharkiv|rostov)\b/i,watch:'Which reports establish civilian or infrastructure impact, and is there independent confirmation of military claims?'},
 {id:'eu-russia-sanctions',label:'EU-Russia sanctions',test:/\b(?:eu|european|russia|russian)\b.*\bsanction[a-z]*|\bsanction[a-z]*\b.*\b(?:eu|russia)\b/i,watch:'Are measures formally adopted, when do they take effect, and which entities or sectors are covered?'},
 {id:'armenia-azerbaijan',label:'Armenia-Azerbaijan relations',test:/\b(?:armeni[a-z]*|azerbaijan[a-z]*|karabakh)\b.*\b(?:peace|border|treaty|talk|displac|citizenship)[a-z]*/i,watch:'Are commitments translated into signed agreements, border arrangements or verified measures for displaced people?'},
 {id:'central-asia-transit',label:'Central Asia: strategic transport and energy',test:/\b(?:kazakh[a-z]*|uzbek[a-z]*|kyrgyz[a-z]*|tajik[a-z]*|turkmen[a-z]*)\b.*\b(?:transit|corridor|energy|electricity|transport|pipeline)\b/i,watch:'Which projects have financing, signed agreements or implementation dates, rather than only announced targets?'}
];

function newsBriefTheme_(it){if(newsBlackSeaIncident_(it))return NEWS_BRIEF_THEMES[0];var h=String(it.country||'')+' '+String(it.headline||'');return NEWS_BRIEF_THEMES.find(function(t){return t.test.test(h);})||null;}

function newsBlackSeaIncident_(it){var h=String(it.headline||'');return /black sea|romani(?:a|an)|bulgari(?:a|an)/i.test(h)&&(/black sea/i.test(h)||/\b(ship|ships|shipping|vessel|vessels|tanker|tankers|cargo)\b/i.test(h))&&/drone|attack|strike|struck|fire/i.test(h);}

function newsUnverifiedPlatform_(it){return /^(facebook|youtube|x|twitter|instagram|tiktok)$/i.test(String(it.source||'').trim())||/(^|\.)(facebook\.com|youtube\.com|youtu\.be|twitter\.com|x\.com|instagram\.com|tiktok\.com)$/.test(getHost_(it.link));}

function newsOSCEPriority_(it){
 var h=String(it.headline||''),regional=!!COUNTRY_TO_DESK[it.country]||/albania|tirana|bosnia|serbia|kosovo|montenegro|north macedonia|ukrain|russi|moldova|belarus|georgia|armenia|azerbaijan|kazakh|kyrgyz|tajik|turkmen|uzbek/i.test(h);
 if(newsBlackSeaIncident_(it))return 4;
 if(regional&&/violent|clash|crisis|state of emergency|secess|constitutional|resign|parliament.*cancel|cancel.*parliament/i.test(h))return 4;
 if(regional&&/protest|election|electoral|opposition|detain|peace|border|ceasefire|truce|displac|rights/i.test(h))return 3;
 if(/\bosce\b|\bodihr\b|\bnato\b/i.test(h))return 3;
 if(regional||newsMajorSanctions_(h))return 2;
 // Out-of-area developments remain in their desk, unless an explicit OSCE/NATO
 // connection above makes them relevant to the lead list.
 return 0;
}

function newsSameLead_(a,b){
 if(newsBlackSeaIncident_(a)&&newsBlackSeaIncident_(b))return true;
 var fa=newsTopFamily_(a),fb=newsTopFamily_(b);if(fa&&fa===fb)return true;
 var ta=newsBriefTheme_(a),tb=newsBriefTheme_(b);
 if(ta&&tb&&ta.id===tb.id&&/albania-protests|serbia-elections|georgia-opposition|bosnia-constitutional|ukraine-energy-truce|eu-russia-sanctions/.test(ta.id))return true;
 if(a.country&&a.country===b.country&&/protest|clash|unrest/i.test(a.headline)&&/protest|clash|unrest/i.test(b.headline))return true;
 return duplicates_(a,b);
}
export { publicSummary_, parseItem_, listingCandidates_, extractPage_, baselineScore_, selectArticles_, topItems_, PUBLISHER_PAGES, NEWS_EU_SOURCES };

function searchFeed_(q){return 'https://news.google.com/rss/search?q='+encodeURIComponent(q)+'&hl=en-GB&gl=GB&ceid=GB:en';}

function feeds_(win,registry){
 var feeds=[['https://feeds.bbci.co.uk/news/world/rss.xml','BBC','International'],['https://rss.dw.com/rdf/rss-en-all','DW','International'],['https://www.aljazeera.com/xml/rss/all.xml','Al Jazeera','International'],['https://feeds.washingtonpost.com/rss/world','Washington Post','International'],['https://tass.com/rss/v2.xml','TASS','Russia'],['https://civil.ge/eng/rss','Civil ge','Georgia'],['https://en.trend.az/rss','Trend','Azerbaijan'],['https://sarajevotimes.com/feed','Sarajevo Times','Bosnia and Herzegovina'],['https://balkaninsight.com/feed/','BIRN','Regional'],['https://kz.kursiv.media/en/feed/','Kursiv','Kazakhstan'],['https://uzdaily.uz/en/rss','UzDaily','Uzbekistan'],['https://hetq.am/en/rss','Hetq','Armenia'],['https://www.hurriyetdailynews.com/rss','Hurriyet Daily News','International'],['https://pajhwok.com/feed','Pajhwok','Afghanistan']].map(function(r){return {url:r[0],name:r[1],country:r[2],search:false,kind:'rss'};});
 // SourceRegistry disables apply to bundled feeds as well as discovery pages.
 feeds=feeds.filter(function(f){var host=getHost_(f.url);return registry.some(function(s){return host===s.domain||host.endsWith('.'+s.domain)||s.name===f.name;});});
 PUBLISHER_PAGES.forEach(function(r){var host=getHost_(r[0]),match=registry.find(function(s){return host===s.domain||host.endsWith('.'+s.domain);});if(match)feeds.push({url:r[0],name:match.name,country:r[2],publisherDomain:match.domain,kind:'publisher',search:false});});
 var duration=win.hours+24;
 ['Serbia','Moldova','Bosnia and Herzegovina','North Macedonia','Georgia','Armenia','Azerbaijan','Kazakhstan','Kyrgyzstan','Tajikistan','Turkmenistan','Uzbekistan','Belarus','Kosovo','Montenegro','Albania','Ukraine'].forEach(function(c){
  feeds.push({url:searchFeed_('"'+c+'" (politics OR parliament OR government OR defence OR security OR elections OR diplomacy OR rights OR energy) when:'+duration+'h'),name:'Country discovery',country:c,kind:'rss',search:true});
 });
 // Individual local publishers avoid a five-site OR query hiding low-volume outlets.
 PUBLISHER_PAGES.filter(function(r){return r[2]!=='International';}).forEach(function(r){var host=getHost_(r[0]),s=registry.find(function(s){return host===s.domain||host.endsWith('.'+s.domain);});if(s)feeds.push({url:searchFeed_('site:'+s.domain+' when:'+duration+'h'),name:s.name+' discovery',country:r[2],publisherDomain:s.domain,kind:'rss',search:true});});
 var wireQueries=[['(site:reuters.com OR site:apnews.com) (Kremlin OR ceasefire OR sanctions OR intelligence OR hybrid)','Security policy discovery'],['site:politico.eu (EU OR NATO OR Ukraine OR sanctions OR defence OR asylum)','European institutions discovery'],['site:aa.com.tr/en (Europe OR Ukraine OR Russia OR sanctions OR Lebanon)','AA institutional discovery'],['(AFP OR Reuters) (UNHCR OR ICC OR refugees OR funding OR Lebanon OR Afghanistan OR Japan OR Taiwan)','Global institutions discovery'],['site:news.err.ee','ERR Local European discovery'],['site:lrt.lt/en/news-in-english','LRT Local European discovery'],['site:yle.fi/news','YLE Local European discovery'],['site:rte.ie/news','RTE Local European discovery'],['site:apnews.com','AP'],['site:reuters.com','Reuters'],['(AFP OR "Agence France-Presse")','AFP partner discovery'],['(dpa OR "German Press Agency")','dpa partner discovery'],['(site:euronews.com OR site:france24.com)','European and AFP partners'],['(site:osce.org OR site:gov.uk) (OSCE OR ODIHR)','OSCE official discovery'],['(site:hina.hr OR site:bta.bg OR site:bgnes.com)','Balkan agency discovery'],['site:abc.net.au (AI OR China OR security OR diplomacy)','Australia policy discovery']];
 wireQueries.forEach(function(q){var terms=/OSCE official|Balkan agency|Australia policy|Local European|Security policy|European institutions|AA institutional|Global institutions/.test(q[1])?'':' (Europe OR Russia OR Ukraine OR Iran OR Middle East OR NATO OR Georgia OR Balkans OR "Central Asia")';feeds.push({url:searchFeed_(q[0]+terms+' when:'+duration+'h'),name:q[1],country:'International',kind:'rss',search:true});});
 feeds=newsAdditionalDiscovery_(win,registry).concat(feeds);
 var seen={};return feeds.filter(function(f){if(seen[f.url])return false;seen[f.url]=true;return true;});
}

function newsAdditionalDiscovery_(win,registry){
 var out=[],hours=win.hours+24;
 function enabled(domain){return registry.some(function(s){return s.domain===domain;});}
 function search(domain,terms,name){if(!enabled(domain))return;out.push({url:searchFeed_('site:'+domain+' '+terms+' when:'+hours+'h'),name:name,country:'International',publisherDomain:domain,kind:'rss',search:true});}
 // Smaller regional queries reduce competition for one search result list.
 var regions=['(Ukraine OR Russia OR Moldova OR Belarus)','(Balkans OR Albania OR Serbia OR Kosovo OR Caucasus OR "Central Asia")','(EU OR NATO OR Europe OR Britain OR Germany OR France)','(Iran OR Israel OR Yemen OR Saudi OR Taiwan OR China OR Japan OR "United Nations")'];
 regions.forEach(function(q,i){search('apnews.com',q,'AP regional discovery '+(i+1));});
 ['france24.com','arabnews.com','gulfnews.com','english.aawsat.com','indopremier.com'].forEach(function(domain){search(domain,'(AFP OR "Agence France-Presse")','AFP partner discovery: '+domain);});
 search('en.philenews.com','(Cyprus OR Turkey OR UN OR negotiations OR defence)','Cyprus diplomacy discovery');
 search('ekathimerini.com','(migration OR asylum OR diplomacy OR security)','Greece policy discovery');
 search('theguardian.com','(Reuters OR "Associated Press" OR AFP) (Ukraine OR EU OR NATO OR security OR migration)','European wire republications');
 // Public publisher pages are a second route; advertised RSS is discovered by the collector.
 [['https://apnews.com/world-news','apnews.com'],['https://en.philenews.com/latest-news/','en.philenews.com'],['https://english.aawsat.com/','english.aawsat.com'],['https://gulfnews.com/','gulfnews.com']].forEach(function(p){var s=registry.find(function(x){return x.domain===p[1];});if(s)out.push({url:p[0],name:s.name,country:'International',publisherDomain:p[1],kind:'publisher',search:false});});
 return out;
}
export { feeds_ };
