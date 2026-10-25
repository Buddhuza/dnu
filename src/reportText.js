const names = `OSCE EU NATO UN US UK USA ICC CIS CSTO G7 G20 ASEAN GRECO PACE EUFOR RAF FSB IRGC PURL SAFE AI CEC NAM BiH EUR GD U.S. AFP AP BBC DW Reuters Albania Albanian Armenia Armenian Azerbaijan Azerbaijani Belarus Belarusian Bosnia Bulgaria Bulgarian Canada Canadian China Chinese Cyprus Czechia Estonia Estonian Finland Finnish France French Georgia Georgian Germany German Greece Greek Hungary Hungarian Iceland Icelandic India Indian Iran Iranian Iraq Ireland Irish Israel Israeli Italy Italian Japan Japanese Kazakhstan Kazakh Kyrgyzstan Kyrgyz Kosovo Kosovar Laos Latvian Latvia Lebanon Lebanese Lithuania Lithuanian Moldova Moldovan Montenegro Montenegrin Moscow Netherlands North Macedonia North Korea Poland Polish Portugal Romania Romanian Russia Russian Saudi Serbia Serbian Slovakia Slovenia Spain Spanish Sweden Swedish Switzerland Swiss Syria Syrian Tajikistan Tajik Turkmenistan Turkmen Türkiye Turkish Ukraine Ukrainian United Uzbekistan Uzbek Vienna Washington Brussels Kyiv Geneva Luxembourg Nikolayev Voronezh Black Sea Middle East Central Asia South Caucasus European Commission European Parliament Balkan Balkans Kremlin Taliban Houthi Houthis Hezbollah Trump Zelenskyy Zelenskiy Putin Pashinyan Aliyev Tokayev Lukashenko Volfovich Vucic Vučić Dačić Milatovic Milatović Brnabic Brnabić Grubi Klitschko Cassis Mirzoyan Lavrov Merz Orban Orbán Iotova Tusk Whitaker Carney Kim Jong Un Sinkevičius Grynkewich Syrskyi Philippe Le Pen Abdallah Abdi Arad Prizren Dornogobi Iskander Starlink Steadfast Noon`.split(/\s+/);
const proper = new Map(names.map(word => [word.toLocaleLowerCase(), word]));
for (const acronym of ['OSCE', 'EU', 'NATO', 'UN', 'US', 'UK', 'USA', 'ICC', 'CIS', 'CSTO', 'G7', 'G20', 'ASEAN', 'GRECO', 'PACE', 'EUFOR', 'RAF', 'FSB', 'IRGC', 'PURL', 'SAFE', 'AI', 'CEC', 'NAM', 'AFP', 'AP', 'BBC', 'DW']) proper.set(acronym.toLowerCase(), acronym);

export function sentenceCaseHeadline(value, summary = '') {
  const marked = /^\(文A\)\s*/.test(String(value ?? '').trim());
  const title = String(value ?? '').trim().replace(/^\(文A\)\s*/, '');
  const words = title.match(/[\p{L}][\p{L}’'-]*/gu) || [];
  const allCaps = words.some(word => /\p{L}/u.test(word)) && words.every(word => word === word.toLocaleUpperCase());
  if (!allCaps) return marked ? `(文A) ${title}` : title;
  let first = true;
  let previousEnd = 0;
  const converted = title.replace(/\p{L}+/gu, (word, offset) => {
    const before = title.slice(previousEnd, offset);
    const start = first || /[.!?:]\s*["'“‘(]*$/.test(before) || /\/\/\s*$/.test(before);
    first = false;
    previousEnd = offset + word.length;
    const lower = word.toLocaleLowerCase();
    if (lower === 'us' && /\blet\s+$/i.test(title.slice(0, offset))) return 'us';
    const known = proper.get(lower);
    if (known) return known;
    return start ? lower.charAt(0).toLocaleUpperCase() + lower.slice(1) : lower;
  });
  return marked ? `(文A) ${converted}` : converted;
}

export function withPeriod(value) {
  const text = String(value ?? '').trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function reportStoryText(item, compressed = false) {
  const osceSpelling = value => String(value ?? '').replace(/Organization for Security and Co-operation in Europe/gi, 'Organisation for Security and Co-operation in Europe');
  const headline = osceSpelling(sentenceCaseHeadline(item.title, item.summary));
  return { headline: compressed ? headline.replace(/\.$/, '') : withPeriod(headline), summary: item.summary ? withPeriod(osceSpelling(item.summary)) : '' };
}
