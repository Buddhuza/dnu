# DNU site specification

This document preserves standing instructions about the website interface, visual design and exports. The [editorial policy](editorial-policy.md) covers which articles to collect and publish, how to rank them, where to place them and how to write their text. New standing product or design instructions belong here, alongside the corresponding code change. One-off edition requests do not become permanent rules. The website does not automatically save chat messages to this file.

## Report display and review controls

- Show article dates as, for example, “14 Oct 26”, and use Vienna time (CET/CEST as applicable) for other displayed times.
- Duplicate groups remaining visible for editorial review receive distinct colours and group numbers. Remove the warning when only one checked/visible story in a group remains.
- Hide empty country and section headings when their last story moves away. In Edit mode, permit moving any story to another section, country or organisation and creating a missing heading; retain drag and drop and the move control.
- Both summary and compressed modes have compact, comfortable line and paragraph spacing. Keep the spacing within wrapped lines in compressed mode, but use a slightly smaller gap between adjacent stories. Compressed mode shows the headline without a trailing period, followed by the agency.

## Editing, adding and navigation

- The site lets the editor check/uncheck stories, edit headline/summary/agency inline, move stories and mark a story as a lead. Save exits edit mode and shows only checked stories. Re-entering Edit retains the selection. Editing, saving and switching summary mode must preserve the current reading position.
- Add accepts one or more pasted article URLs and a manual entry with headline, summary, agency and hyperlink. Scraped articles receive a suggested placement that can be changed; manually added articles can be placed anywhere. Automatically scroll to newly scraped Add results. Added stories can be checked, unchecked and moved like other stories.
- The source list opens the outlet website beside the update for browsing. Adding an article uses its copied URL in Add. Do not spend Firecrawl credits merely to show a website in that panel. No Grab or Send article to DNU control is required.
- Search finds text within the update. The top header and source area stay fixed on desktop while update text scrolls. On narrow screens hide the Sources area; keep SITUATION ROOM and the dark-mode switch on one line, allow the page header to scroll away while the compact update header stays sticky. Section shortcuts remain one line and shorten to LEAD, SEE, EE, SC, CA and MISCL on narrow screens.
- The public GitHub Pages site has Manage site disabled because it cannot securely verify a password. Browser-local changes are private to that browser and are not a shared policy or a replacement for the versioned project files.
- Keep the editorial policy available at its direct `/dnu/editorial-policy.md` URL, but do not show an Editorial policy link or button on the main public site.
- Do not show a date or time in the top-right page header. The project and website are named DNU / SITUATION ROOM, rather than scrapeandreport.

## Word, email and spreadsheet outputs

- Download exports only the currently visible/checked stories and respects summary versus compressed mode, including the absence of a trailing headline period in compressed mode. The Word file follows the supplied example’s logo, font, colours and section styling. Its filename and title date use the report/coverage date appropriate to the edition. Do not add a coverage note inside Word.
- At the bottom of the final Word page, put a rule followed by the supplied two-paragraph disclaimer. Display that disclaimer at the bottom of the web update before the coverage note. The email action copies the formatted current update, including the logo, to the clipboard and opens a draft for pasting; the subject is “OSCE SITROOM DAILY NEWS UPDATE, DD Month YYYY”.
- Disclaimer text, paragraph 1: “Disclaimer: This product is based on open media sources only and the material used is not always fully validated. Items selected are abridged from the original or are \"verbatim\". All views, opinions and accounts contained herein are those of the original authors, and do not imply official endorsement or acceptance by the OSCE.”
- Disclaimer text, paragraph 2: “We would like to remind all our recipients that SitRoom News Updates are for internal use only and is not intended for further dissemination or distribution. Thank you for your understanding and co-operation regarding this matter.”
- Spreadsheet export includes only visible articles whose full body can be obtained. Continue past failures, export successful rows and show a result count with failures. Keep fetched full article pages available for export when permitted. Columns: Date, Source, Region, Countries, Local Regions, Organizations/Organisations, Themes, Types, Source URL, Heading, Body. Required fields are Date, Source, Region, Countries, Source URL, Heading and full Body. Preserve the database’s expected column header if it requires “Organizations”, while display text elsewhere uses “Organisations”.
- Spreadsheet Region mapping: MIDDLE EAST / NORTH AFRICA → Middle East; WESTERN / CENTRAL EUROPE → Europe; RUSSIA / EURASIA → Eurasia; NORTH EAST ASIA → North East Asia; NORTH AMERICA → North America; INTERNATIONAL ORGANISATIONS → blank. Use each visible article's current section and country or organisation heading as the primary spreadsheet placement, including after a move or promotion to Lead stories. Add other countries or organisations that are substantively mentioned in the article after that placement. Use “US”, “UK” and “UN” in output labels. For Georgia breakaway-republic stories use Countries = Georgia and Local Regions = Abkhazia and/or South Ossetia.
- For a translated story, preserve the “(文A)” marker in web, Word and email headlines. Spreadsheet Heading retains the original publisher headline; spreadsheet Body uses the English translation when a complete translated body is available. If the body translation is unavailable, count that row as unavailable and continue exporting the remaining stories.
- When publishing the static website, retain previously published hashed JavaScript and CSS assets so open browser tabs can still load the Add dialog and other deferred modules after the site updates.

## Visual design and labels

- The page brand is SITUATION ROOM and the update is DAILY NEWS UPDATE; omit the OSCE logo from the web header. Use a slightly beige light background and a working dark-mode switch. Section headings are uppercase and larger than subsection headings; subsection headings are larger than country headings. Keep country heading size at the established smaller size.
- Countries and organisations have pale blue highlighted headings in web and Word. The seven Miscellaneous subsection headings themselves are not highlighted. In Lead stories, Middle East retains its highlight. Keep the specified spacing: more above main sections other than Lead stories, little below section/subsection headings, and a little more above subsection headings.
- Keep the update column readable rather than page-wide. Use compact top bars and controls. The update controls are Add, Edit/Save, compressed-view toggle, Download, Email, spreadsheet export and Search; prefer small blue icon buttons with clear hover labels. Section shortcut buttons are centred and evenly distributed.
- Do not show the removed promotional banner, Google News, a second bottom toolbar, or a “Websites without selected articles” block at the end of the report. Source diagnostics belong in the collection audit, where the reason for each missing outlet can be inspected.

## Export review

- Build and review both web and Word versions. Verify the currently selected mode controls Word and email content, and that spreadsheet failures do not prevent successful rows from exporting.
