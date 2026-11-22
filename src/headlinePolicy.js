export function excludedHeadlineReason(value, summary = '', url = '') {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (host === 'osce.org' || host.endsWith('.osce.org')) return 'OSCE website links are excluded';
  } catch { /* Some callers check headlines before they have a URL. */ }
  const headline = String(value || '').trim().replace(/^\(文A\)\s*/, '');
  const detail = `${headline} ${summary}`;
  const cbsIndividualPost = /https:\/\/(?:www\.)?cbsnews\.com\/live-updates\/[a-z0-9-]+\/#post-update-[a-f0-9]{8,32}$/i.test(String(url));
  const alJazeeraIndividualPost = /https:\/\/www\.aljazeera\.com\/news\/liveblog\/\d{4}\/\d{1,2}\/\d{1,2}\/[a-z0-9-]+\?update=\d+$/i.test(String(url));
  const bbcIndividualPost = /https:\/\/(?:www\.)?bbc\.(?:com|co\.uk)\/news\/live\/[a-z0-9]+\?post=asset(?:%3A|:)[0-9a-f-]{36}#post$/i.test(String(url));
  const guardianIndividualPost = /https:\/\/(?:www\.)?theguardian\.com\/[a-z-]+\/live\/\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]+\?page=with%3A(block-[a-f0-9]{20,32})#\1$/i.test(String(url));
  const france24IndividualPost = /https:\/\/(?:www\.)?france24\.com\/en\/[a-z-]+\/\d{8}-live-[a-z0-9-]+\?arena_mid=[a-z0-9]{8,40}(?:&|$)/i.test(String(url));
  const independentIndividualPost = /https:\/\/(?:www\.)?independent\.co\.uk\/news\/[a-z0-9/-]+-live-[a-z0-9-]+-b\d+\.html(?:\?page=\d+)?#post-\d+$/i.test(String(url));
  if (/\blive\s*:/i.test(headline) || /^live(?:\s+updates?)?\s*[:|–-]/i.test(headline) || /\/(?:liveblog|live-blog|live-updates)(?:\/|$)/i.test(String(url))
    && !cbsIndividualPost && !alJazeeraIndividualPost
    || /https:\/\/(?:www\.)?bbc\.(?:com|co\.uk)\/news\/live\/[a-z0-9]+(?:[?#]|$)/i.test(String(url)) && !bbcIndividualPost
    || /https:\/\/(?:www\.)?theguardian\.com\/[a-z-]+\/live\/\d{4}\/[a-z]{3}\/\d{1,2}\/[a-z0-9-]+(?:[?#]|$)/i.test(String(url)) && !guardianIndividualPost
    || /https:\/\/(?:www\.)?france24\.com\/en\/[a-z-]+\/\d{8}-live-[a-z0-9-]+(?:[?#]|$)/i.test(String(url)) && !france24IndividualPost
    || /https:\/\/(?:www\.)?independent\.co\.uk\/news\/[a-z0-9/-]+-live-[a-z0-9-]+-b\d+\.html(?:[?#]|$)/i.test(String(url)) && !independentIndividualPost
    || /^Ukraine war latest\b/i.test(headline) && /news\.sky\.com\/story\/[a-z0-9-]+-12541713(?:\?|#|$)/i.test(String(url)) && !/[?&]postid=\d+/.test(String(url))
    || /\/live-\d+(?:[/?#]|$)/i.test(String(url)) && !/[?&]dnu-update=/.test(String(url))) return 'Live blogs are excluded';
  if (/^why\b/i.test(headline)) return 'Why headlines are excluded';
  if (/^(?:opening|closing) summary$/i.test(headline) || /(?:[–—-]\s*podcast|\bin pictures)$/i.test(headline)) return 'Live-blog roundup, podcast or photo gallery rather than a standalone news story';
  if (/^(?:\p{Extended_Pictographic}\s*)?In pictures:/iu.test(headline)) return 'Photo gallery rather than a standalone news story';
  if (/^Kyiv restaurant owners brace for winter as war pressures mount$/i.test(headline) || /^In Ukraine, the fight to keep winter outside begins with a broken window$/i.test(headline)) return 'Economic or human-interest feature without a specific political or security development';
  if (/^(?:editor['’]s choice|if you['’]re just joining us)\b|^(?:watch|photos):/i.test(headline)) return 'Live-blog roundup or media prompt rather than a standalone news story';
  if (/^Iran war was [‘“']perfectly avoidable[’”'],? former UN envoy says$/i.test(headline)) return 'Commentary without a new political or security development';
  if (/^what\b/i.test(headline)) return 'What explainer headlines are excluded';
  if (/^(?:athlete|swimmer)\b.*\b(?:wildlife|raise awareness)\b/i.test(headline)) return 'Sports or environmental feature outside the security and political brief';
  if (/^how\b/i.test(headline)) return 'Explainer headlines are excluded';
  if (/^interview\b/i.test(headline)) return 'Interview headlines are excluded';
  if (headline.includes('?')) return 'Question headlines are excluded';
  if (/\bMehriban Aliyeva\b/i.test(detail)) return 'Mehriban Aliyeva stories are excluded';
  if (/\b(?:offers?|expresses?|extends?|sends?)\s+condolences\b/i.test(headline)) return 'Condolence message without a new political or security development';
  if (/^(?:analysis|opinion|commentary|editorial|feature|in depth|explainer)\b/i.test(headline)) return 'Analysis, opinion and feature headlines are excluded';
  if (/^analyst\b/i.test(headline) || /\s[–—-]\s*expert\b/i.test(headline) || /\b(?:memoir|UFC event|parts ways with coach)\b/i.test(headline)) return 'Analysis, memoir or sports rather than current political or security news';
  if (/\bHaiti\b/i.test(headline) || /\bIndonesia police arrest\b/i.test(headline)) return 'Outside the DNU geography';
  if (/\b(?:Albanian woman asks Putin face to face|Crishock on the Attack on the Priest|member of the Skaljar clan was killed|suspected fuel smuggler fighting extradition|Man protests on roof of Spanish embassy)\b/i.test(headline)) return 'Routine incident or reaction outside the political and security brief';
  if (/^Energy Efficiency in the Western Balkans: Building Markets and Creating Jobs$/i.test(headline) || /^CESEC: Europe is spending enormous sums on high energy costs$/i.test(headline)) return 'Analytical article without a specific news development';
  if (/^With Change of Power, Serbia Can Reinvigorate EU Accession Bid\b/i.test(headline) || /^Attempts to find resolution for Israel['’]s new government and Ukraine['’]s war\b/i.test(headline)) return 'Opinion or analysis rather than a specific news development';
  if (/\bHow a university boom fuels exploitation and human trafficking\b/i.test(headline)) return 'Explainer rather than a specific news development';
  if (/\bban on single-use plastic tableware\b|\bDiwali celebrated in Bishkek\b|\bmotorcyclists account for \d+% of Cyprus road deaths\b|\bschool bus (?:accident|crash)\b|\b(?:accident|crash)\b.{0,35}\bschool bus\b|\bchild (?:sexual? |sex )?abuse\b/i.test(headline)) return 'Outside the political and security brief';
  if (/^US[\s-]+Israel[\s-]+Iran War$/i.test(headline)) return 'Topic page rather than a specific news article';
  if (/^[-–]\s*[\w.-]+\.[a-z]{2,}$/i.test(headline) || /^[-–]\s*[\w.-]+\s*\([\w .-]+\)\s*\d{1,2}\s+[A-Z][a-z]{2}\s+\d{2,4}$/i.test(headline)) return 'Source listing rather than a news article';
  if (/\bthe outsider who led\b/i.test(headline)) return 'Profile features are excluded';
  if (/^Critical developments ahead of\b/i.test(headline) && /\bshifting balances\b/i.test(headline)) return 'Broad analytical summit preview rather than a specific news development';
  if (/\b(?:experts?|analysts?)\s+(?:say|says|warn|warns|argue|argues|believe|believes)\b/i.test(headline)) return 'Expert commentary is excluded';
  if (/(?:^|:\s*)(?:experts?|analysts?)\s*$/i.test(headline)) return 'Expert commentary is excluded';
  if (/\b(?:food poisoning|poisoning of \d+ children)\b/i.test(detail) &&
      !/\b(?:terror\w*|attack|deliberate|intentional|targeted|politic\w*|government|minister|resign\w*|security)\b/i.test(headline)) return 'Routine public-health incident outside the security and political scope';
  if (/\b(?:flights?|airlines?|airports?)\b/i.test(headline) && !/\b(?:attack|bomb|strik\w*|struck|raid|shell\w*|missile\w*|terror\w*|war|conflict|sanction|military|security|diplomatic|government|minister|parliament|election|protest|border|airspace)\b/i.test(headline)) return 'Travel and airline business outside the security and political scope';
  if (/^(?:agenda of events|events calendar)\b/i.test(headline)) return 'Event calendars are not news articles';
  return '';
}
