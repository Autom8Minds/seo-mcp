/**
 * In-memory storage for crawl sessions.
 *
 * Stores crawl results, page data, and aggregated issues.
 * Uses Maps for O(1) lookup by URL and crawl ID.
 */

import type { SeoIssue } from '../../types/seo-types.js';
import { createHash } from 'crypto';

export type CrawlState = 'running' | 'completed' | 'failed' | 'cancelled';

export interface CrawlSession {
  id: string;
  seedUrl: string;
  domain: string;
  state: CrawlState;
  startedAt: number;
  completedAt: number | null;
  config: CrawlConfig;
  stats: CrawlStats;
}

export interface CrawlConfig {
  maxPages: number;
  maxDepth: number;
  concurrency: number;
  respectRobotsTxt: boolean;
  userAgent: string;
  includePatterns: string[];
  excludePatterns: string[];
}

export interface CrawlStats {
  pagesCrawled: number;
  pagesQueued: number;
  pagesErrored: number;
  totalIssues: number;
  issuesBySeverity: Record<string, number>;
  statusCodeDistribution: Record<number, number>;
  avgResponseTime: number;
  totalResponseTime: number;
}

export interface CrawledPage {
  url: string;
  statusCode: number;
  redirectChain: string[];
  responseTime: number;
  depth: number;
  parentUrl: string | null;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  wordCount: number;
  contentHash: string;
  internalLinks: string[];
  externalLinks: string[];
  issues: SeoIssue[];
  crawledAt: number;
}

export interface DuplicateGroup {
  hash: string;
  urls: string[];
  type: 'exact-content' | 'duplicate-title' | 'duplicate-description' | 'duplicate-h1';
}

export interface RedirectChainInfo {
  sourceUrl: string;
  chain: string[];
  finalUrl: string;
  hops: number;
  isLoop: boolean;
}

// Global store of crawl sessions
const sessions = new Map<string, CrawlSession>();
const pages = new Map<string, Map<string, CrawledPage>>(); // crawlId -> (url -> page)

export function generateCrawlId(): string {
  return `crawl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createCrawlSession(
  id: string,
  seedUrl: string,
  domain: string,
  config: CrawlConfig,
): CrawlSession {
  const session: CrawlSession = {
    id,
    seedUrl,
    domain,
    state: 'running',
    startedAt: Date.now(),
    completedAt: null,
    config,
    stats: {
      pagesCrawled: 0,
      pagesQueued: 0,
      pagesErrored: 0,
      totalIssues: 0,
      issuesBySeverity: {},
      statusCodeDistribution: {},
      avgResponseTime: 0,
      totalResponseTime: 0,
    },
  };

  sessions.set(id, session);
  pages.set(id, new Map());
  return session;
}

export function getCrawlSession(id: string): CrawlSession | null {
  return sessions.get(id) || null;
}

export function updateCrawlState(id: string, state: CrawlState): void {
  const session = sessions.get(id);
  if (session) {
    session.state = state;
    if (state === 'completed' || state === 'failed' || state === 'cancelled') {
      session.completedAt = Date.now();
    }
  }
}

export function addCrawledPage(crawlId: string, page: CrawledPage): void {
  const session = sessions.get(crawlId);
  const pageMap = pages.get(crawlId);
  if (!session || !pageMap) return;

  pageMap.set(page.url, page);

  // Update stats
  session.stats.pagesCrawled++;
  session.stats.totalResponseTime += page.responseTime;
  session.stats.avgResponseTime = session.stats.totalResponseTime / session.stats.pagesCrawled;

  // Status code distribution
  session.stats.statusCodeDistribution[page.statusCode] =
    (session.stats.statusCodeDistribution[page.statusCode] || 0) + 1;

  // Issues
  for (const issue of page.issues) {
    session.stats.totalIssues++;
    session.stats.issuesBySeverity[issue.severity] =
      (session.stats.issuesBySeverity[issue.severity] || 0) + 1;
  }
}

export function updateQueuedCount(crawlId: string, count: number): void {
  const session = sessions.get(crawlId);
  if (session) {
    session.stats.pagesQueued = count;
  }
}

export function incrementErrorCount(crawlId: string): void {
  const session = sessions.get(crawlId);
  if (session) {
    session.stats.pagesErrored++;
  }
}

export function getCrawledPages(crawlId: string): CrawledPage[] {
  const pageMap = pages.get(crawlId);
  return pageMap ? Array.from(pageMap.values()) : [];
}

export function hashContent(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

export function findDuplicates(crawlId: string): DuplicateGroup[] {
  const crawledPages = getCrawledPages(crawlId);
  const groups: DuplicateGroup[] = [];

  // Exact content duplicates (by MD5 hash)
  const contentHashes = new Map<string, string[]>();
  for (const page of crawledPages) {
    if (page.contentHash && page.wordCount > 50) {
      const urls = contentHashes.get(page.contentHash) || [];
      urls.push(page.url);
      contentHashes.set(page.contentHash, urls);
    }
  }
  for (const [hash, urls] of contentHashes) {
    if (urls.length > 1) {
      groups.push({ hash, urls, type: 'exact-content' });
    }
  }

  // Duplicate titles
  const titles = new Map<string, string[]>();
  for (const page of crawledPages) {
    if (page.title) {
      const normalized = page.title.trim().toLowerCase();
      const urls = titles.get(normalized) || [];
      urls.push(page.url);
      titles.set(normalized, urls);
    }
  }
  for (const [title, urls] of titles) {
    if (urls.length > 1) {
      groups.push({ hash: title, urls, type: 'duplicate-title' });
    }
  }

  // Duplicate meta descriptions
  const descriptions = new Map<string, string[]>();
  for (const page of crawledPages) {
    if (page.metaDescription) {
      const normalized = page.metaDescription.trim().toLowerCase();
      const urls = descriptions.get(normalized) || [];
      urls.push(page.url);
      descriptions.set(normalized, urls);
    }
  }
  for (const [desc, urls] of descriptions) {
    if (urls.length > 1) {
      groups.push({ hash: desc, urls, type: 'duplicate-description' });
    }
  }

  // Duplicate H1s
  const h1s = new Map<string, string[]>();
  for (const page of crawledPages) {
    if (page.h1) {
      const normalized = page.h1.trim().toLowerCase();
      const urls = h1s.get(normalized) || [];
      urls.push(page.url);
      h1s.set(normalized, urls);
    }
  }
  for (const [h1, urls] of h1s) {
    if (urls.length > 1) {
      groups.push({ hash: h1, urls, type: 'duplicate-h1' });
    }
  }

  return groups;
}

export function findRedirectChains(crawlId: string): RedirectChainInfo[] {
  const crawledPages = getCrawledPages(crawlId);
  const chains: RedirectChainInfo[] = [];

  for (const page of crawledPages) {
    if (page.redirectChain.length > 0) {
      const fullChain = [...page.redirectChain, page.url];
      // Detect loops
      const uniqueUrls = new Set(fullChain);
      const isLoop = uniqueUrls.size < fullChain.length;

      if (fullChain.length > 2 || isLoop) {
        chains.push({
          sourceUrl: fullChain[0],
          chain: fullChain,
          finalUrl: page.url,
          hops: fullChain.length - 1,
          isLoop,
        });
      }
    }
  }

  return chains;
}

export function listCrawlSessions(): CrawlSession[] {
  return Array.from(sessions.values()).sort((a, b) => b.startedAt - a.startedAt);
}
