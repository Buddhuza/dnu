# DNU project guidance

Before changing story collection, selection, placement, story text, the interface, visual design or exports, read the relevant section of the [DNU rulebook](public/dnu-rules.md). It is the single editable source for standing rules and is available by direct URL under `/dnu/`, without a link on the main public site. Treat the latest direct user instruction as superseding a conflicting item, then update the rulebook and implementation together.

The rulebook describes intended behavior. Verify the current code and prepared edition before claiming that a rule is enforced or that a source was checked. Never put API keys or passwords into the rulebook or repository.

## NEWSRUN shortcut

When the user sends `NEWSRUN` as an instruction (case-insensitive), run the native Node collector with `npm run collect:daily`. It reads direct publisher feeds and pages and Google News RSS discovery, applies local editorial rules, and atomically writes `data/prepared-update.json`. It does not use Firecrawl, Google Apps Script or Google Sheets. Review the completed JSON, source route outcomes, placement, duplicates, article-body availability and export behavior before using the separate authorized publication command. Do not publish or schedule automatically merely because a collection succeeded. If no articles qualify, retain the previous edition and report the failure. Merely discussing `NEWSRUN` does not trigger collection.

## FEEDRUN shortcut

The former direct-feed-only workflow is retired by the native collector cutover. If the user explicitly sends `FEEDRUN`, run the native collector and explain that it now checks both direct publisher routes and Google News RSS discovery. Do not run the retired direct-feed scripts or call Firecrawl. Keep publication a separate reviewed action.
