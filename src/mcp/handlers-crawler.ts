/**
 * Handler functions for crawler tools.
 */

import { startCrawl } from '../services/crawler/engine.js';
import {
  getCrawlSession,
  getCrawledPages,
  findDuplicates,
  findRedirectChains,
  findNearDuplicatePages,
  findOrphanPages,
  listCrawlSessions,
  loadAllSavedCrawls,
  loadCrawl,
} from '../services/crawler/storage.js';
import { compareCrawls } from '../services/crawler/comparator.js';
import { analyzeSitemap } from '../services/sitemap-analyzer.js';
import { formatToolError } from '../utils/error-handler.js';

interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

// -- crawl_site -----------------------------------------------------------

export async function handleCrawlSite(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const crawlId = startCrawl(url, {
      maxPages: args.maxPages as number | undefined,
      maxDepth: args.maxDepth as number | undefined,
      concurrency: args.concurrency as number | undefined,
      respectRobotsTxt: args.respectRobotsTxt as boolean | undefined,
      userAgent: args.userAgent as string | undefined,
      includePatterns: args.includePatterns as string[] | undefined,
      excludePatterns: args.excludePatterns as string[] | undefined,
    });

    const result = {
      crawlId,
      message: `Crawl started for ${url}. Use crawl_status("${crawlId}") to check progress and crawl_results("${crawlId}") to retrieve findings.`,
      seedUrl: url,
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- crawl_status ---------------------------------------------------------

export async function handleCrawlStatus(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const crawlId = args.crawlId as string;
    if (!crawlId) {
      return formatToolError(new Error('The "crawlId" parameter is required.'));
    }

    const session = getCrawlSession(crawlId);
    if (!session) {
      return formatToolError(new Error(`No crawl found with ID "${crawlId}".`));
    }

    const result = {
      crawlId: session.id,
      state: session.state,
      seedUrl: session.seedUrl,
      domain: session.domain,
      startedAt: new Date(session.startedAt).toISOString(),
      completedAt: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      duration: session.completedAt
        ? `${((session.completedAt - session.startedAt) / 1000).toFixed(1)}s`
        : `${((Date.now() - session.startedAt) / 1000).toFixed(1)}s (running)`,
      stats: session.stats,
      config: {
        maxPages: session.config.maxPages,
        maxDepth: session.config.maxDepth,
        concurrency: session.config.concurrency,
      },
    };

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- crawl_results --------------------------------------------------------

export async function handleCrawlResults(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const crawlId = args.crawlId as string;
    if (!crawlId) {
      return formatToolError(new Error('The "crawlId" parameter is required.'));
    }

    const session = getCrawlSession(crawlId);
    if (!session) {
      return formatToolError(new Error(`No crawl found with ID "${crawlId}".`));
    }

    const filter = (args.filter as string) || 'summary';
    const severity = args.severity as string | undefined;
    const limit = (args.limit as number) || 50;

    const pages = getCrawledPages(crawlId);
    const result: Record<string, unknown> = {
      crawlId: session.id,
      state: session.state,
      domain: session.domain,
      stats: session.stats,
    };

    if (filter === 'all' || filter === 'summary') {
      // Aggregate issues by type
      const issuesByType = new Map<string, number>();
      const issuesBySeverity = new Map<string, number>();
      for (const page of pages) {
        for (const issue of page.issues) {
          if (severity && severityRank(issue.severity) > severityRank(severity)) continue;
          issuesByType.set(issue.type, (issuesByType.get(issue.type) || 0) + 1);
          issuesBySeverity.set(issue.severity, (issuesBySeverity.get(issue.severity) || 0) + 1);
        }
      }

      result.summary = {
        totalPages: pages.length,
        issuesByType: Object.fromEntries(issuesByType),
        issuesBySeverity: Object.fromEntries(issuesBySeverity),
        statusCodes: session.stats.statusCodeDistribution,
        avgResponseTime: Math.round(session.stats.avgResponseTime),
        pagesWithIssues: pages.filter(p => p.issues.length > 0).length,
        pagesWithoutIssues: pages.filter(p => p.issues.length === 0).length,
      };
    }

    if (filter === 'all' || filter === 'issues') {
      // Flatten all issues with page context
      const allIssues = pages.flatMap(page =>
        page.issues
          .filter(issue => !severity || severityRank(issue.severity) <= severityRank(severity))
          .map(issue => ({
            url: page.url,
            type: issue.type,
            severity: issue.severity,
            detail: issue.detail,
          })),
      );

      // Sort by severity
      allIssues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

      result.issues = allIssues.slice(0, limit);
      result.totalIssues = allIssues.length;
    }

    if (filter === 'all' || filter === 'duplicates') {
      const duplicates = findDuplicates(crawlId);
      const nearDuplicates = findNearDuplicatePages(crawlId);
      const allDuplicates = [...duplicates, ...nearDuplicates];
      result.duplicates = allDuplicates.slice(0, limit);
      result.totalDuplicateGroups = allDuplicates.length;
    }

    if (filter === 'near-duplicates') {
      const nearDuplicates = findNearDuplicatePages(crawlId);
      result.nearDuplicates = nearDuplicates.slice(0, limit);
      result.totalNearDuplicateGroups = nearDuplicates.length;
    }

    if (filter === 'all' || filter === 'redirects') {
      const redirects = findRedirectChains(crawlId);
      result.redirectChains = redirects.slice(0, limit);
      result.totalRedirectChains = redirects.length;
    }

    if (filter === 'all' || filter === 'pages') {
      result.pages = pages.slice(0, limit).map(page => ({
        url: page.url,
        statusCode: page.statusCode,
        title: page.title,
        metaDescription: page.metaDescription ? page.metaDescription.slice(0, 80) + (page.metaDescription.length > 80 ? '...' : '') : null,
        h1: page.h1,
        wordCount: page.wordCount,
        responseTime: page.responseTime,
        depth: page.depth,
        issueCount: page.issues.length,
        internalLinksCount: page.internalLinks.length,
        externalLinksCount: page.externalLinks.length,
      }));
      result.totalPages = pages.length;
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- detect_orphan_pages --------------------------------------------------

export async function handleDetectOrphanPages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const crawlId = args.crawlId as string;
    const sitemapUrl = args.sitemapUrl as string;
    if (!crawlId) return formatToolError(new Error('The "crawlId" parameter is required.'));
    if (!sitemapUrl) return formatToolError(new Error('The "sitemapUrl" parameter is required.'));

    // Try to load crawl from disk if not in memory
    const session = getCrawlSession(crawlId);
    if (!session) {
      loadCrawl(crawlId);
      if (!getCrawlSession(crawlId)) {
        return formatToolError(new Error(`No crawl found with ID "${crawlId}".`));
      }
    }

    // Fetch sitemap URLs
    const sitemap = await analyzeSitemap(sitemapUrl, 50000, false);
    const sitemapUrls = sitemap.urls || [];

    const result = findOrphanPages(crawlId, sitemapUrls);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          crawlId,
          sitemapUrl,
          orphanPages: result.orphanPages.slice(0, 100),
          totalOrphanPages: result.orphanPages.length,
          unlistedPages: result.unlistedPages.slice(0, 100),
          totalUnlistedPages: result.unlistedPages.length,
          sitemapUrlCount: sitemapUrls.length,
          crawledUrlCount: result.crawledUrls.length,
        }, null, 2),
      }],
    };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- compare_crawls -------------------------------------------------------

export async function handleCompareCrawls(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const crawlId1 = args.crawlId1 as string;
    const crawlId2 = args.crawlId2 as string;
    if (!crawlId1 || !crawlId2) {
      return formatToolError(new Error('Both "crawlId1" and "crawlId2" parameters are required.'));
    }

    // Try loading from disk if not in memory
    if (!getCrawlSession(crawlId1)) loadCrawl(crawlId1);
    if (!getCrawlSession(crawlId2)) loadCrawl(crawlId2);

    const comparison = compareCrawls(crawlId1, crawlId2);
    if (!comparison) {
      return formatToolError(new Error(`One or both crawls not found: "${crawlId1}", "${crawlId2}".`));
    }

    return { content: [{ type: 'text', text: JSON.stringify(comparison, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- list_crawls ----------------------------------------------------------

export async function handleListCrawls(_args: Record<string, unknown>): Promise<ToolResult> {
  try {
    // Load any saved crawls from disk
    loadAllSavedCrawls();

    const sessions = listCrawlSessions();
    const result = sessions.map(s => ({
      crawlId: s.id,
      domain: s.domain,
      seedUrl: s.seedUrl,
      state: s.state,
      pagesCrawled: s.stats.pagesCrawled,
      totalIssues: s.stats.totalIssues,
      startedAt: new Date(s.startedAt).toISOString(),
      completedAt: s.completedAt ? new Date(s.completedAt).toISOString() : null,
    }));

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ crawls: result, totalCrawls: result.length }, null, 2),
      }],
    };
  } catch (error) {
    return formatToolError(error);
  }
}

function severityRank(severity: string): number {
  switch (severity) {
    case 'critical': return 1;
    case 'high': return 2;
    case 'medium': return 3;
    case 'low': return 4;
    default: return 5;
  }
}
