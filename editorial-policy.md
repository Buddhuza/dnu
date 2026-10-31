# Daily News Update: editorial policy

This is the durable brief for SITUATION ROOM / DNU. It consolidates the current instructions from the project conversation as of 23 October 2026. Use it when preparing an update or changing the application, including from a different ChatGPT account. Later instructions supersede earlier ones. This document records the intended rules; the collection scripts and browser may still need changes to enforce a rule. Do not treat a displayed policy as proof that a source was successfully checked.

When a user gives a new standing editorial rule, update this document and the relevant implementation together. Keep site design and interface requirements in the separate site specification. A one-off request for a particular edition or coverage window does not become a permanent rule unless the user says so. The website does not automatically save chat messages to either file.

## 1. Purpose and scope

- Produce a factual daily monitoring update about security, war, conflict, terrorism, defence, diplomacy, external cooperation and politics. Give OSCE news particular attention.
- Prefer developments involving international relations, negotiations, cross-border security and external cooperation over routine internal party politics. Include a major domestic development when its consequences warrant coverage.
- Exclude routine public-health incidents, including accidental food poisoning, unless the event has a clear security or political consequence. A serious tragedy alone does not make a story a security lead.
- Publish article headlines and summaries in English. If a relevant suggested article is originally in another language, translate its headline and factual summary into English and prefix the displayed headline with exactly “(文A)”. Retain the original link and original headline for verification. Do not add an article when a reliable English translation cannot be extracted. Do not include opinion, analysis, commentary, features, speculative pieces or questions posed as headlines. Exclude headlines beginning with “Analysis” or “Opinion”, headlines containing a question mark, and irrelevant subjects such as leisure travel.
- Exclude headlines beginning with “Why”, headlines framed as expert or analyst commentary (such as “Expert Says”), and stories about Mehriban Aliyeva.
- Exclude live blogs and rolling update pages; select a specific, verifiable news article about the development instead.
- Report facts without opinions or analysis. Do not fill space with weak, repetitive or merely descriptive stories. Select the most consequential recent developments.
- The coverage window is specified for each collection request; otherwise use the last 24 hours. Report date is the date of compilation. Use Vienna time (CET/CEST as applicable) when determining dates and coverage.
- For automatic collection, verify publication time on the original article page, including a date or time visible there. A listing timestamp alone is insufficient for a verified-window story. Exclude an article outside the window even if it appears on a current listing. Manually added articles may be of any age: use the page timestamp, then a date inferred from the article or URL, and finally the import time, clearly tracked as such.

## 2. Sources and collection

- Check every website in the provided source list for each full collection, including sources hidden by a browser filter. Source-list categories are for browsing and never limit where an article can appear in the report.
- Use publisher feeds or other free collection paths first. Use Firecrawl for sources without a usable feed and for article pages needed to verify and extract stories. The preferred credit-saving sequence is listing/feed headlines → shortlist by relevance → scrape promising original article pages. A deep or complete scrape must also investigate sources for which the shortlist returns nothing.
- After each full scan, audit every source. Distinguish a technical failure, no accessible listing, no article page, no verified date, out-of-window stories, irrelevant stories, duplicates, and relevant stories not selected. Investigate zero-result sources individually and try another feed, listing page, site search or permitted route. Never claim “no relevant news” simply because a scan returned zero.
- Cache fetched listing pages and original article content when possible. Reuse cached article pages across collections to avoid spending Firecrawl credits twice for the same content. A new scrape rebuilds the update using all eligible stories from the current and prior cached batches that fall within the requested window; it drops expired stories and clears browser-added stories from the prepared edition. Manual rescraping and adding an older URL remain possible.
- Do not use Google News as a source. Internazionale is included for its free Reuters articles only; label those stories “Reuters”. Keep source failures and collection methods available for audit.
- Exclude articles published directly by national governments, ministries, presidencies and other official government websites, including GOV.UK and Turkmenistan government. Independent reporting about government actions remains eligible. OSCE reporting is not treated as a national government publication.
- International agencies may supply any section. For a country, organisation or lead heading with multiple stories, aim for no agency to supply more than roughly half when comparable verified coverage from other agencies exists. Prefer reputable international reporting when several outlets carry the same event; select an equivalent account from another credible agency when it improves the balance. Do not add weak or duplicate stories, or discard a distinct major story, just to meet a quota. For Ukraine, especially lead stories, rely predominantly on Reuters, AP, AFP, DW, Politico, Euronews, BBC, dpa and comparable international outlets; do not use Ukrainian outlets under Ukraine.
- Prefer independent or less government-aligned outlets over government-friendly outlets covering the same event, when both reports are sound: Euronews.al over TemA, N1 over Tanjug, and Civil.ge over 1TV. Source diversity applies to leads and to two-story groups as well as larger groups; use no more than half from one agency when equally sound, distinct alternatives exist.
- Use Russian outlets only under Russia, including when the reported event concerns another country. Do not use Azerbaijani outlets or the Times of Central Asia under Ukraine, Ukrainian/Moldovan/Armenian outlets under Russia, Hromadske under Germany, or Yonhap/Azernews under the US. Do not place Azerbaijani outlets under Armenia or Armenian outlets under Azerbaijan. There are two IPN outlets: label the Georgian one “InterPressNews”. Display Local editions by domain, such as Local.fr and Local.at.

## 3. Selection, ranking and duplicate control

- Select meaningful fresh news, with a maximum of ten stories beneath each country or organisation in the regular sections; lead stories are additional to the Ukraine regular-section limit.
- Lead stories normally have three or four of the most important Ukraine stories and one or two major Middle East stories. Other especially important regional developments may also become leads. An international organisation is not a lead subject unless the OSCE story is exceptional. Do not make a Saudi Arabia story a Middle East lead by default.
- A spreadsheet row's position near the top does not by itself justify Lead stories placement. Check its subject against the security and political scope before promoting it; the editor can promote eligible stories with the star control.
- Order lead headings with countries from South Eastern Europe, Eastern Europe, South Caucasus and Central Asia first, alphabetically; then Miscellaneous countries/topics and organisations, alphabetically. Thus Albania precedes Ukraine, which precedes Middle East. With only Ukraine and Middle East, Ukraine appears first.
- Identify event-level duplicates even when headlines differ or stories come from different agencies. Prefer the clearer, more factual, more reputable or international account. Avoid several stories conveying the same fact, such as multiple notices of one diplomatic trip.
- Avoid feature-like, broad, repetitive and low-impact stories when a more specific account of the same development exists. Do not choose a source simply to ensure that every outlet appears in the report; audit and report why a source contributed no selected story.

## 4. Placement and heading order

- Place a story by the location of the event or its main actor, not by the source-list category. If Russia attacks a location in Ukraine, place an international-source story under Ukraine. Russian-source stories remain under Russia; Ukrainian-source stories do not populate Ukraine.
- For a story involving several countries within South Eastern Europe, Eastern Europe, South Caucasus or Central Asia, file it under the reporting outlet’s country if that country is a subject. Otherwise use the principal actor or main event location. Do not infer a country solely from a publisher name appended to a headline.
- South Eastern Europe may contain a section-level OSCE story before the country headings when its subject spans the region, as with an OSCE Secretary General visit. South Eastern Europe: Albania; Bosnia and Herzegovina; Montenegro; North Macedonia; Serbia; Serbia / Kosovo. Put Kosovo coverage under Serbia / Kosovo.
- Eastern Europe: Belarus; Moldova; Moldova / Transdniestria; Ukraine. Put Transdniestria coverage under Moldova / Transdniestria.
- South Caucasus: Armenia; Azerbaijan; Georgia. Georgia’s breakaway-republic stories belong under Georgia. The older Georgia / Abkhazia / South Ossetia heading should not be used for new output.
- Central Asia: Kazakhstan; Kyrgyzstan; Tajikistan; Turkmenistan; Uzbekistan.
- Miscellaneous has these subsections, in order: WESTERN / CENTRAL EUROPE; MIDDLE EAST / NORTH AFRICA; RUSSIA / EURASIA; AFGHANISTAN / PAKISTAN; NORTH EAST ASIA; NORTH AMERICA; INTERNATIONAL ORGANISATIONS.
- WESTERN / CENTRAL EUROPE includes European countries, including Iceland and the UK, except Belarus, Moldova and Ukraine. Display countries under that subsection in alphabetical order. Use “UK” for the United Kingdom heading.
- MIDDLE EAST / NORTH AFRICA includes Iran, Israel and the Palestinian territories, Lebanon, Libya, Syria, Türkiye and other pertinent regional countries. Give particular attention to major Iran-war and Strait of Hormuz developments. In Lead stories, label the topic “Middle East”.
- RUSSIA / EURASIA is for Russia. AFGHANISTAN / PAKISTAN is only for Afghanistan news directly connected with Russia or Central Asian countries. NORTH EAST ASIA includes China, Japan, Mongolia, South Korea and North Korea. NORTH AMERICA includes Canada and the US; use “US” for the country heading.
- INTERNATIONAL ORGANISATIONS is inside Miscellaneous. It includes OSCE, EU and its institutions, UN and its organisations, NATO, IMF, G7, G20, ICC, WTO, CIS, CSTO, BRICS and other pertinent bodies. Use “UN” as the heading. Order headings OSCE, EU, UN, NATO, IMF, then other Western organisations, then CIS, CSTO, BRICS and other Eurasian organisations. Use the spelling “Organisation” throughout the website, Word file and email.
- Keep countries alphabetically ordered within ordinary subsections even after manual additions and moves.

## 5. Story text

- Preserve the article’s exact factual headline in content while rendering only all-caps headlines in sentence case; preserve mixed-case and title-case headlines as published. Keep abbreviations, proper names and official acronyms capitalised. Do not append a second agency name accidentally embedded in a headline.
- In summary mode, follow the headline with a period, then one short factual sentence that adds a concrete important detail from the article, from the first substantive paragraph, especially its opening sentences, without repeating the headline. Finish with a period, then the agency name in parentheses linked to the original article. Avoid long, general summaries.
- In compressed view (headline-only mode), omit the summary and put the linked agency immediately after the headline. Remove a trailing period from the headline.

## 6. Editorial review before publication

- Confirm the requested coverage window and the article-page date for every selected automatic story. Confirm the original link, agency, English text or a faithful English translation, relevance, placement, source restrictions, headline and one-sentence summary.
- Compare stories by event to remove duplication, review lead order and importance, enforce the country cap, and check source diversity. Keep a per-source audit that explains omissions without equating “not selected” to “unreachable”.

