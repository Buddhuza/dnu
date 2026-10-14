const names = `OSCE EU NATO UN US UK USA ICC CIS CSTO G7 G20 ASEAN GRECO PACE EUFOR RAF FSB IRGC PURL SAFE AI CEC NAM BiH EUR GD U.S. AFP AP BBC DW Reuters Albania Albanian Armenia Armenian Azerbaijan Azerbaijani Belarus Belarusian Bosnia Bulgaria Bulgarian Canada Canadian China Chinese Cyprus Czechia Estonia Estonian Finland Finnish France French Georgia Georgian Germany German Greece Greek Hungary Hungarian Iceland Icelandic India Indian Iran Iranian Iraq Ireland Irish Israel Israeli Italy Italian Japan Japanese Kazakhstan Kazakh Kyrgyzstan Kyrgyz Kosovo Kosovar Laos Latvian Latvia Lebanon Lebanese Lithuania Lithuanian Moldova Moldovan Montenegro Montenegrin Moscow Netherlands North Macedonia North Korea Poland Polish Portugal Romania Romanian Russia Russian Saudi Serbia Serbian Slovakia Slovenia Spain Spanish Sweden Swedish Switzerland Swiss Syria Syrian Tajikistan Tajik Turkmenistan Turkmen Türkiye Turkish Ukraine Ukrainian United Uzbekistan Uzbek Vienna Washington Brussels Kyiv Luxembourg Nikolayev Voronezh Black Sea Middle East Central Asia South Caucasus European Commission European Parliament Balkan Balkans Kremlin Taliban Houthi Houthis Hezbollah Trump Zelenskyy Zelenskiy Putin Pashinyan Aliyev Tokayev Lukashenko Volfovich Vucic Vučić Dačić Milatovic Milatović Brnabic Brnabić Grubi Klitschko Cassis Mirzoyan Lavrov Merz Orban Orbán Iotova Tusk Whitaker Carney Kim Jong Un Sinkevičius Grynkewich Syrskyi Philippe Le Pen Abdallah Abdi Arad Prizren Dornogobi Iskander Starlink Steadfast Noon`.split(/\s+/);
const proper = new Map(names.map(word => [word.toLocaleLowerCase(), word]));
for (const acronym of ['OSCE', 'EU', 'NATO', 'UN', 'US', 'UK', 'USA', 'ICC', 'CIS', 'CSTO', 'G7', 'G20', 'ASEAN', 'GRECO', 'PACE', 'EUFOR', 'RAF', 'FSB', 'IRGC', 'PURL', 'SAFE', 'AI', 'CEC', 'NAM', 'AFP', 'AP', 'BBC', 'DW']) proper.set(acronym.toLowerCase(), acronym);
const sentenceWords = new Set('a an and are as at be by for from has have in is of on or over the to with after amid under without into its says said new more today tomorrow this that those their which while who why how'.split(' '));

export function sentenceCaseHeadline(value, summary = '') {
  const title = String(value ?? '').trim();
  const words = title.match(/[\p{L}][\p{L}’'-]*/gu) || [];
  const upperStarts = words.filter(word => /^\p{Lu}/u.test(word)).length;
  const titleCase = words.length >= 4 && upperStarts / words.length > 0.55;
  const leadingCaps = /^\p{Lu}{2,}(?:\s+\p{Lu}{2,})*\s*[:/]/u.test(title);
  if (!titleCase && !leadingCaps) return title;
  let first = true;
  let previousEnd = 0;
  return title.replace(/\p{L}+/gu, (word, offset) => {
    const before = title.slice(previousEnd, offset);
    const start = first || /[.!?:]\s*["'“‘(]*$/.test(before) || /\/\/\s*$/.test(before);
    first = false;
    previousEnd = offset + word.length;
    const lower = word.toLocaleLowerCase();
    if (lower === 'us' && /\blet\s+$/i.test(title.slice(0, offset))) return 'us';
    const known = proper.get(lower);
    if (known) return known;
    if (!leadingCaps && word.length <= 6 && /^\p{Lu}{2,}$/u.test(word) && !sentenceWords.has(lower)) return word;
    return start ? lower.charAt(0).toLocaleUpperCase() + lower.slice(1) : lower;
  });
}

export function withPeriod(value) {
  const text = String(value ?? '').trim();
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function reportStoryText(item) {
  return { headline: withPeriod(sentenceCaseHeadline(item.title, item.summary)), summary: item.summary ? withPeriod(item.summary) : '' };
}
