// Editorial corrections for the 29–30 October 2026 SITCEN edition. These are
// source-backed additions to the headline, not rules for later news editions.
const summaries = new Map([
  ['14 killed and 14 injured in a Russian drone attack on the railway station in Dnipro, Ukraine', 'The drone hit a platform beside a Dnipro–Zaporizhzhia train; six wounded people were in serious condition'],
  ['Israel election result shows no overall majority as vote count complete', 'Provisional results gave Netanyahu’s bloc 53 seats in the 120-member Knesset; opposition politicians discussed a coalition'],
  ['At least ‘three killed’ as EUFOR helicopter crashes in Bosnia and Herzegovina 21:12 29 October 2026', 'The Italian CH-47 aircraft crashed near Brčko while deployed to EUFOR’s Operation Althea'],
  ['Security Services Must Be Reformed to Dismantle Serbia’s Mafia State', 'Preliminary results gave the Student List about 140 of Serbia’s 250 parliamentary seats'],
  ['Change in Power in Serbia Brings Headaches for Central Europe’s Governments', 'The Student List’s election victory surprised Central European leaders who had expected a closer contest'],
  ['Lithuania to introduce universal military conscription in 2032, president says', 'The State Defence Council agreed on the timetable, and women’s military service would remain voluntary'],
  ['Russia, NATO moving closer to direct military clash — envoy', 'Dmitry Polyansky made the claim at an OSCE Permanent Council meeting'],
  ["US moves to lift sanctions on Russia's shadow fleet could undermine Western pressure on Moscow and help fund its war in Ukraine.", 'Washington is reportedly considering legalising dark tankers to carry Russian crude outside sanctions'],
  ['Moldovan parliament approves, in first reading, denunciation of two agreements with Commonwealth of Independent States that were not implemented', 'One agreement concerned the return of cultural and historical assets to their countries of origin'],
  ['Serbia’s Public Broadcaster RTS Faces Uncertainty as Director-General Resigns', 'The Student List has called for removing political influence from RTS following the election'],
  ['Mirziyoyev and Erdogan Discuss Deeper Strategic Partnership', 'They discussed creating a council for business support and preparing the next intergovernmental commission meeting'],
  ['Three killed and Twelve injured in the EUFOR Helicopter Crash in BiH', 'All three people killed were Italian citizens, according to the report'],
  ['Man Remanded in Custody for Latest Femicide in Kosovo The Kosovo court has ordered one month of pre-trial detention for Albert Sylaj, suspected of killing his forme...', 'Albert Sylaj is accused of killing his former sister-in-law after she reported her ex-husband to police'],
  ["If it comes to war between Russia and Europe, 'there will be no winners' — Putin 22:19 29 October 2026", 'Putin made the remarks at a press conference following the Russia-Africa summit'],
  ['Milojko Spajić: A new era has arrived in relations between Montenegro and Serbia', 'Spajić said his government had sought high-level cooperation with Serbia since taking office'],
  ['Tajikistan Business Inspections Suspended for SMEs Until 2029, but Tax Checks Continue', 'President Rahmon extended the inspection moratorium by decree, limiting it to small and medium-sized businesses'],
  ['Kazakhstan considers higher taxes for wealthy individuals', 'First Vice Minister Azamat Amrin said officials would examine international approaches before drafting the proposal'],
  ['Azerbaijan Air Force helicopters complete NATO evaluation (PHOTO)', 'Crews practiced medical evacuation, cargo transport and low-altitude flying during NATO’s assessment'],
  ['OTS: Kyrgyzstan participates in Council of Foreign Ministers 29 October 16:07', 'Foreign ministers met in Ankara before the Turkic states’ summit'],
  ["Eisenkot warns of campaign to 'delegitimise' election", 'Eisenkot accused Netanyahu of using allegations against Arab parties to cast doubt on the election result'],
  ['Ethiopia acquires Russian fighter jets and air defence systems amid war in Tigray', 'Ethiopia received 12 Su-35 jets; Prime Minister Abiy Ahmed discussed the deal at the Russia-Africa summit'],
  ['Lithuania considers buying Palantir AI system for armed forces', 'Defence Minister Robertas Kaunas confirmed the proposal on Wednesday'],
  ['North Korea fires missile barrage toward the sea as tensions with South rise', 'The launches followed Kim Jong Un’s visit to China and Pyongyang’s threat to resume border loudspeaker broadcasts'],
  ['Russia-Africa cooperation should be instrument of peace — Burundi’s president', 'Burundi’s president made the appeal during the Russia-Africa Economic and Humanitarian Forum'],
  ["Harris rejects 'characterisation' of call with O'Donovan", 'Harris said accounts of the call were inaccurate; O’Donovan fell ill soon afterward at an EU event']
].map(([title, summary]) => [title.trim().toLocaleLowerCase(), summary]));

export function reviewedImportedSummary(title, publishedAt = '') {
  if (!/^2026-10-(?:28|29|30|31)/.test(String(publishedAt))) return '';
  return summaries.get(String(title || '').trim().toLocaleLowerCase()) || '';
}
