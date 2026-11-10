const aliases = {
  'local sweden': 'Local.se',
  'local france': 'Local.fr',
  'local germany': 'Local.de',
  'local spain': 'Local.es',
  'local switzerland': 'Local.ch',
  'local austria': 'Local.at',
  'dtt net': 'DTT',
  'albanian daily news': 'ADN',
  'n1 bosnia': 'N1',
  'n1 serbia': 'N1',
  'greekreporter.com': 'Greek Reporter',
  'mezha.net': 'Mezha',
  'rfe rl': 'RFE/RL',
  '1tv georgia': '1TV.ge',
  '1tv': '1TV.ge',
  'asia plus': 'Asia-Plus',
  'crude oil prices today | oilprice.com': 'OilPrice.com',
  'ipn moldova': 'IPN.md',
  'ipn.md': 'IPN.md',
  'interpressnews': 'IPN.ge',
  'interpressnews.ge': 'IPN.ge',
  'ipn.ge': 'IPN.ge',
  'qazinform': 'Kazinform',
  'politico europe': 'Politico.eu',
  'vreme.com': 'Vreme',
  'aol.com': 'AOL',
  'nin.rs': 'NIN',
  'euroradio.fm': 'Euroradio',
  'pan armenian': 'PAN',
  'novinite.com': 'Novinite',
  'abna english': 'ABNA24',
  'committee to protect journalists': 'CPJ',
  'financial times': 'FT',
  'times of central asia': 'TCA',
  'https://aapnews.aap.com.au/': 'AAP',
  'civil ge': 'Civil.ge',
  'mina': 'MINA'
};

export function displaySourceName(name, source = {}) {
  const raw = String(name || '').trim();
  const key = raw.toLowerCase().replace(/\s+/g, ' ');
  if (key === 'yahoo' || key === 'yahoo news' || key === 'yahoo.com') {
    const credit = `${source.body || ''} ${source.summary || ''} ${source.byline || ''}`;
    if (/\b(?:dpa|Deutsche Presse-Agentur)\b/i.test(credit)) return 'dpa';
    if (/^US military strikes cargo ship accused of violating Iran blockade$/i.test(String(source.title || source.heading || '').trim())) return 'dpa';
    return raw;
  }
  if (key === 'https://aapnews.aap.com.au' || key === 'aapnews.aap.com.au') return 'AAP';
  if (['ipn', 'ipn moldova', 'ipn.md', 'interpressnews', 'interpressnews.ge', 'ipn.ge'].includes(key)) {
    let host = '';
    try { host = new URL(source.url).hostname.replace(/^www\./, '').toLowerCase(); } catch { /* A source name may have no URL yet. */ }
    if (source.sourceId === 'source-63' || source.id === 'source-63' || host === 'interpressnews.ge') return 'IPN.ge';
    if (source.sourceId === 'source-32' || source.id === 'source-32' || host === 'ipn.md') return 'IPN.md';
  }
  return aliases[key] || raw;
}
