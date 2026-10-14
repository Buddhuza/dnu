export function sourceAudit(source, attempts = [], errors = []) {
  const grouped = new Map();
  for (const attempt of attempts) {
    const key = `${attempt.collectionMethod}:${attempt.listingUrl}`;
    const row = grouped.get(key) || { listingUrl: attempt.listingUrl, collectionMethod: attempt.collectionMethod, listedCount: 0, candidatesFound: 0, candidatesChecked: 0, headlines: 0, rejectionCounts: { pageError: 0, missingHeadlineOrTime: 0, outsideWindow: 0, outsideScope: 0, nonEnglish: 0 }, pageErrors: [] };
    row.listedCount = Math.max(row.listedCount, attempt.listedCount || 0);
    row.candidatesFound = Math.max(row.candidatesFound, attempt.candidatesFound || 0);
    row.candidatesChecked += attempt.candidatesChecked || 0;
    row.headlines += attempt.headlines || 0;
    for (const name of Object.keys(row.rejectionCounts)) row.rejectionCounts[name] += attempt.rejectionCounts?.[name] || 0;
    row.pageErrors.push(...(attempt.pageErrors || []).slice(0, Math.max(0, 3 - row.pageErrors.length)));
    grouped.set(key, row);
  }
  const checkedAttempts = [...grouped.values()];
  const headlines = checkedAttempts.reduce((sum, attempt) => sum + attempt.headlines, 0);
  const listed = Math.max(0, ...checkedAttempts.map(attempt => attempt.listedCount));
  const candidates = Math.max(0, ...checkedAttempts.map(attempt => attempt.candidatesFound));
  const checked = checkedAttempts.reduce((sum, attempt) => sum + attempt.candidatesChecked, 0);
  const failedPages = checkedAttempts.reduce((sum, attempt) => sum + attempt.rejectionCounts.pageError, 0);
  const unverifiedPages = checkedAttempts.reduce((sum, attempt) => sum + attempt.rejectionCounts.missingHeadlineOrTime, 0);
  const outOfWindowPages = checkedAttempts.reduce((sum, attempt) => sum + attempt.rejectionCounts.outsideWindow, 0);
  const filteredPages = checkedAttempts.reduce((sum, attempt) => sum + attempt.rejectionCounts.outsideScope, 0);
  const nonEnglishPages = checkedAttempts.reduce((sum, attempt) => sum + (attempt.rejectionCounts.nonEnglish || 0), 0);
  const methods = [...new Set(checkedAttempts.map(attempt => attempt.collectionMethod).filter(Boolean))];
  let status, reason, remedy;
  if (headlines) {
    status = 'extracted';
    reason = `${headlines} dated, matching article${headlines === 1 ? '' : 's'} extracted.`;
    remedy = '';
  } else if (!attempts.length) {
    status = 'failed';
    reason = errors.at(-1) || 'No listing or feed could be read.';
    remedy = /do not support|all scraping engines|blocked|forbidden|403/i.test(errors.join(' '))
      ? 'Firecrawl could not access this publisher; use an available publisher feed or arrange permitted access to its article pages.'
      : 'Try a working news-page URL or publisher feed; check whether the publisher blocks access.';
  } else if (!listed) {
    status = 'empty-listing';
    reason = 'The checked pages returned no article links.';
    remedy = 'Try a different news-section URL or publisher feed.';
  } else if (!candidates && !methods.includes('feed')) {
    status = 'no-matching-links';
    reason = `${listed} links were found, but none matched the include and exclude keywords.`;
    remedy = 'Broaden the keywords or use a news page focused on the required topics.';
  } else if (failedPages) {
    status = 'article-errors';
    reason = `${failedPages} article page${failedPages === 1 ? '' : 's'} failed; ${unverifiedPages} lacked a verifiable headline or time.`;
    remedy = /do not support|all scraping engines|blocked|forbidden|403/i.test(checkedAttempts.flatMap(item => item.pageErrors).join(' '))
      ? 'The publisher blocked article extraction; use its feed or arrange permitted article access.'
      : 'Try a publisher feed or another listing URL; inspect failed article pages for access blocks.';
  } else if (unverifiedPages) {
    status = 'unverified-articles';
    reason = `${unverifiedPages} article page${unverifiedPages === 1 ? '' : 's'} lacked a verifiable headline or publication time.`;
    remedy = 'Use a dated publisher feed or review the original article page for its publication time.';
  } else if (outOfWindowPages && !filteredPages) {
    status = 'outside-window';
    reason = `${outOfWindowPages} article page${outOfWindowPages === 1 ? '' : 's'} had publication times outside the last 48 hours.`;
    remedy = 'Check another news section or widen the coverage window if an older report is intended.';
  } else {
    status = 'no-eligible-articles';
    reason = methods.includes('feed') && !checked
      ? `${listed} dated feed entries were found, but none passed the time and keyword checks.`
      : `${checked} article pages were checked; ${nonEnglishPages} were not in English, and none passed the time and scope checks.`;
    remedy = filteredPages ? 'Check the article dates and widen the keyword scope if appropriate.' : 'Check another news section or widen the coverage window.';
  }
  if (status !== 'extracted' && /do not support|all scraping engines|blocked|forbidden|403/i.test(errors.join(' '))) {
    remedy = 'The publisher blocked a collection method; use a working publisher feed or arrange permitted access to its article pages.';
  }
  return { sourceId: source.id, name: source.name, status, reason, remedy, attempts: checkedAttempts, errors };
}
