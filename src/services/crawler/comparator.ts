/**
 * Crawl comparator.
 *
 * Diffs two crawl sessions to identify changes:
 * new/removed pages, changed titles/meta/H1, status code changes,
 * new issues, and resolved issues.
 */

import { getCrawledPages, getCrawlSession, type CrawledPage } from './storage.js';
import { logger } from '../../utils/logger.js';

export interface PageChange {
  url: string;
  field: string;
  oldValue: string | number | null;
  newValue: string | number | null;
}

export interface CrawlComparison {
  crawlId1: string;
  crawlId2: string;
  domain: string;
  crawl1Date: string;
  crawl2Date: string;
  summary: {
    newPages: number;
    removedPages: number;
    changedPages: number;
    unchangedPages: number;
    newIssues: number;
    resolvedIssues: number;
  };
  newPages: string[];
  removedPages: string[];
  changes: PageChange[];
  newIssues: Array<{ url: string; type: string; severity: string; detail: string }>;
  resolvedIssues: Array<{ url: string; type: string; severity: string; detail: string }>;
}

export function compareCrawls(crawlId1: string, crawlId2: string): CrawlComparison | null {
  const session1 = getCrawlSession(crawlId1);
  const session2 = getCrawlSession(crawlId2);

  if (!session1 || !session2) {
    return null;
  }

  logger.info(`Comparing crawls: ${crawlId1} vs ${crawlId2}`);

  const pages1 = getCrawledPages(crawlId1);
  const pages2 = getCrawledPages(crawlId2);

  const pageMap1 = new Map<string, CrawledPage>();
  const pageMap2 = new Map<string, CrawledPage>();

  for (const page of pages1) pageMap1.set(page.url, page);
  for (const page of pages2) pageMap2.set(page.url, page);

  const allUrls = new Set([...pageMap1.keys(), ...pageMap2.keys()]);

  const newPages: string[] = [];
  const removedPages: string[] = [];
  const changes: PageChange[] = [];
  const newIssues: CrawlComparison['newIssues'] = [];
  const resolvedIssues: CrawlComparison['resolvedIssues'] = [];
  let changedPages = 0;
  let unchangedPages = 0;

  for (const url of allUrls) {
    const page1 = pageMap1.get(url);
    const page2 = pageMap2.get(url);

    if (!page1 && page2) {
      newPages.push(url);
      // All issues on new pages are "new issues"
      for (const issue of page2.issues) {
        newIssues.push({ url, type: issue.type, severity: issue.severity, detail: issue.detail });
      }
      continue;
    }

    if (page1 && !page2) {
      removedPages.push(url);
      // All issues on removed pages are "resolved"
      for (const issue of page1.issues) {
        resolvedIssues.push({ url, type: issue.type, severity: issue.severity, detail: issue.detail });
      }
      continue;
    }

    if (page1 && page2) {
      let hasChanges = false;

      // Compare key fields
      if (page1.title !== page2.title) {
        changes.push({ url, field: 'title', oldValue: page1.title, newValue: page2.title });
        hasChanges = true;
      }
      if (page1.metaDescription !== page2.metaDescription) {
        changes.push({ url, field: 'metaDescription', oldValue: page1.metaDescription, newValue: page2.metaDescription });
        hasChanges = true;
      }
      if (page1.h1 !== page2.h1) {
        changes.push({ url, field: 'h1', oldValue: page1.h1, newValue: page2.h1 });
        hasChanges = true;
      }
      if (page1.statusCode !== page2.statusCode) {
        changes.push({ url, field: 'statusCode', oldValue: page1.statusCode, newValue: page2.statusCode });
        hasChanges = true;
      }
      if (page1.canonical !== page2.canonical) {
        changes.push({ url, field: 'canonical', oldValue: page1.canonical, newValue: page2.canonical });
        hasChanges = true;
      }

      // Significant word count change (>20%)
      if (page1.wordCount > 0 && Math.abs(page2.wordCount - page1.wordCount) / page1.wordCount > 0.2) {
        changes.push({ url, field: 'wordCount', oldValue: page1.wordCount, newValue: page2.wordCount });
        hasChanges = true;
      }

      // Compare issues
      const issueKeys1 = new Set(page1.issues.map(i => `${i.type}:${i.detail}`));
      const issueKeys2 = new Set(page2.issues.map(i => `${i.type}:${i.detail}`));

      for (const issue of page2.issues) {
        const key = `${issue.type}:${issue.detail}`;
        if (!issueKeys1.has(key)) {
          newIssues.push({ url, type: issue.type, severity: issue.severity, detail: issue.detail });
        }
      }

      for (const issue of page1.issues) {
        const key = `${issue.type}:${issue.detail}`;
        if (!issueKeys2.has(key)) {
          resolvedIssues.push({ url, type: issue.type, severity: issue.severity, detail: issue.detail });
        }
      }

      if (hasChanges) changedPages++;
      else unchangedPages++;
    }
  }

  logger.info(`Crawl comparison complete: ${newPages.length} new, ${removedPages.length} removed, ${changedPages} changed`);

  return {
    crawlId1,
    crawlId2,
    domain: session2.domain,
    crawl1Date: new Date(session1.startedAt).toISOString(),
    crawl2Date: new Date(session2.startedAt).toISOString(),
    summary: {
      newPages: newPages.length,
      removedPages: removedPages.length,
      changedPages,
      unchangedPages,
      newIssues: newIssues.length,
      resolvedIssues: resolvedIssues.length,
    },
    newPages,
    removedPages,
    changes,
    newIssues,
    resolvedIssues,
  };
}
