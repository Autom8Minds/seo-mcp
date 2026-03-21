/**
 * Site crawler engine.
 *
 * Performs breadth-first crawling of a website, analyzing each page
 * with the existing SEO analysis services. Supports configurable
 * concurrency, depth limits, and robots.txt respect.
 */

import { httpGet } from '../../utils/http-client.js';
import {
  parseHtml,
  extractTitle,
  extractMetaDescription,
  extractCanonical,
  getBodyText,
  countWords,
} from '../../utils/html-parser.js';
import { resolveUrl, extractDomain, isInternalLink } from '../../utils/url-validator.js';
import { logger } from '../../utils/logger.js';
import { DEFAULTS } from '../../config/defaults.js';
import { UrlFrontier } from './frontier.js';
import {
  generateCrawlId,
  createCrawlSession,
  addCrawledPage,
  updateCrawlState,
  updateQueuedCount,
  incrementErrorCount,
  getCrawlSession,
  hashContent,
  type CrawlConfig,
  type CrawledPage,
} from './storage.js';
import type { SeoIssue } from '../../types/seo-types.js';
import { SEO_RULES } from '../../constants/seo-rules.js';

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  concurrency?: number;
  respectRobotsTxt?: boolean;
  userAgent?: string;
  includePatterns?: string[];
  excludePatterns?: string[];
}

interface RobotsRules {
  disallowedPaths: string[];
  allowedPaths: string[];
}

/** Parse a simple robots.txt for the given user agent */
async function fetchRobotsRules(domain: string, userAgent: string): Promise<RobotsRules> {
  const rules: RobotsRules = { disallowedPaths: [], allowedPaths: [] };

  try {
    const response = await httpGet(`https://${domain}/robots.txt`, { timeout: 5000 });
    if (response.status !== 200) return rules;

    let currentAgentMatches = false;
    const lines = response.body.split('\n');

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const [directive, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();

      if (directive.toLowerCase() === 'user-agent') {
        currentAgentMatches = value === '*' || value.toLowerCase() === userAgent.toLowerCase();
      } else if (currentAgentMatches) {
        if (directive.toLowerCase() === 'disallow' && value) {
          rules.disallowedPaths.push(value);
        } else if (directive.toLowerCase() === 'allow' && value) {
          rules.allowedPaths.push(value);
        }
      }
    }
  } catch {
    // robots.txt not available, allow everything
  }

  return rules;
}

function isPathAllowed(path: string, rules: RobotsRules): boolean {
  // Allow rules take precedence over disallow for matching specificity
  for (const allowed of rules.allowedPaths) {
    if (path.startsWith(allowed)) return true;
  }
  for (const disallowed of rules.disallowedPaths) {
    if (path.startsWith(disallowed)) return false;
  }
  return true;
}

function analyzePageIssues(
  page: Omit<CrawledPage, 'issues'>,
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Status code issues
  if (page.statusCode >= 400 && page.statusCode < 500) {
    issues.push({ type: 'http', severity: 'high', detail: `Page returns ${page.statusCode} (client error).` });
  } else if (page.statusCode >= 500) {
    issues.push({ type: 'http', severity: 'critical', detail: `Page returns ${page.statusCode} (server error).` });
  } else if (page.statusCode >= 300 && page.statusCode < 400) {
    issues.push({ type: 'http', severity: 'medium', detail: `Page returns ${page.statusCode} (redirect).` });
  }

  // Title issues
  if (!page.title) {
    issues.push({ type: 'title', severity: 'high', detail: 'Missing title tag.' });
  } else {
    if (page.title.length < SEO_RULES.title.minLength) {
      issues.push({ type: 'title', severity: 'medium', detail: `Title too short (${page.title.length} chars).` });
    }
    if (page.title.length > SEO_RULES.title.maxLength) {
      issues.push({ type: 'title', severity: 'medium', detail: `Title too long (${page.title.length} chars).` });
    }
  }

  // Meta description issues
  if (!page.metaDescription) {
    issues.push({ type: 'meta', severity: 'medium', detail: 'Missing meta description.' });
  } else {
    if (page.metaDescription.length < SEO_RULES.metaDescription.minLength) {
      issues.push({ type: 'meta', severity: 'low', detail: `Meta description too short (${page.metaDescription.length} chars).` });
    }
    if (page.metaDescription.length > SEO_RULES.metaDescription.maxLength) {
      issues.push({ type: 'meta', severity: 'low', detail: `Meta description too long (${page.metaDescription.length} chars).` });
    }
  }

  // H1 issues
  if (!page.h1) {
    issues.push({ type: 'headings', severity: 'medium', detail: 'Missing H1 tag.' });
  }

  // Canonical issues
  if (!page.canonical) {
    issues.push({ type: 'canonical', severity: 'medium', detail: 'Missing canonical tag.' });
  }

  // Thin content
  if (page.wordCount < SEO_RULES.content.thinContentThreshold && page.statusCode === 200) {
    issues.push({ type: 'content', severity: 'medium', detail: `Thin content (${page.wordCount} words, threshold: ${SEO_RULES.content.thinContentThreshold}).` });
  }

  // Redirect chain
  if (page.redirectChain.length > 1) {
    issues.push({ type: 'redirect', severity: 'medium', detail: `Redirect chain with ${page.redirectChain.length} hops.` });
  }

  // Slow response
  if (page.responseTime > 3000) {
    issues.push({ type: 'performance', severity: 'medium', detail: `Slow response time (${page.responseTime}ms).` });
  }

  return issues;
}

/**
 * Start a site crawl. Returns the crawl ID immediately.
 * The crawl runs asynchronously in the background.
 */
export function startCrawl(seedUrl: string, options: CrawlOptions = {}): string {
  const domain = extractDomain(seedUrl);
  const crawlId = generateCrawlId();

  const config: CrawlConfig = {
    maxPages: options.maxPages ?? 100,
    maxDepth: options.maxDepth ?? 10,
    concurrency: options.concurrency ?? 5,
    respectRobotsTxt: options.respectRobotsTxt ?? true,
    userAgent: options.userAgent ?? DEFAULTS.userAgent,
    includePatterns: options.includePatterns ?? [],
    excludePatterns: options.excludePatterns ?? [],
  };

  createCrawlSession(crawlId, seedUrl, domain, config);

  // Start crawling asynchronously
  runCrawl(crawlId, seedUrl, domain, config).catch((error) => {
    logger.error(`Crawl ${crawlId} failed:`, error);
    updateCrawlState(crawlId, 'failed');
  });

  return crawlId;
}

async function runCrawl(
  crawlId: string,
  seedUrl: string,
  domain: string,
  config: CrawlConfig,
): Promise<void> {
  logger.info(`Starting crawl ${crawlId} for ${seedUrl} (max: ${config.maxPages} pages, depth: ${config.maxDepth})`);

  const frontier = new UrlFrontier({
    maxDepth: config.maxDepth,
    includePatterns: config.includePatterns,
    excludePatterns: config.excludePatterns,
    allowedDomain: domain,
  });

  // Fetch and parse robots.txt
  let robotsRules: RobotsRules = { disallowedPaths: [], allowedPaths: [] };
  if (config.respectRobotsTxt) {
    robotsRules = await fetchRobotsRules(domain, config.userAgent);
    logger.info(`Loaded robots.txt: ${robotsRules.disallowedPaths.length} disallow rules`);
  }

  // Add seed URL
  frontier.add(seedUrl, 0, null);
  updateQueuedCount(crawlId, frontier.queueSize());

  let pagesCrawled = 0;

  while (frontier.hasMore() && pagesCrawled < config.maxPages) {
    // Check if crawl was cancelled
    const session = getCrawlSession(crawlId);
    if (!session || session.state === 'cancelled') {
      logger.info(`Crawl ${crawlId} was cancelled`);
      return;
    }

    // Process a batch of URLs concurrently
    const batch: Array<{ url: string; depth: number; parentUrl: string | null }> = [];
    while (batch.length < config.concurrency && frontier.hasMore() && pagesCrawled + batch.length < config.maxPages) {
      const entry = frontier.next();
      if (!entry) break;

      // Check robots.txt
      try {
        const parsed = new URL(entry.url);
        if (!isPathAllowed(parsed.pathname, robotsRules)) {
          logger.debug(`Blocked by robots.txt: ${entry.url}`);
          continue;
        }
      } catch {
        continue;
      }

      batch.push({ url: entry.url, depth: entry.depth, parentUrl: entry.parentUrl });
    }

    if (batch.length === 0) break;

    // Crawl batch concurrently
    const results = await Promise.allSettled(
      batch.map(({ url, depth, parentUrl }) => crawlPage(url, depth, parentUrl, domain, config)),
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        const { page, discoveredLinks } = result.value;

        // Store the page
        addCrawledPage(crawlId, page);
        pagesCrawled++;

        // Add discovered links to frontier
        for (const link of discoveredLinks) {
          frontier.add(link, page.depth + 1, page.url);
        }
      } else {
        incrementErrorCount(crawlId);
        if (result.status === 'rejected') {
          logger.debug(`Failed to crawl ${batch[i].url}: ${result.reason}`);
        }
      }
    }

    updateQueuedCount(crawlId, frontier.queueSize());
  }

  updateCrawlState(crawlId, 'completed');
  logger.info(`Crawl ${crawlId} completed: ${pagesCrawled} pages crawled`);
}

async function crawlPage(
  url: string,
  depth: number,
  parentUrl: string | null,
  domain: string,
  config: CrawlConfig,
): Promise<{ page: CrawledPage; discoveredLinks: string[] } | null> {
  try {
    const response = await httpGet(url, {
      timeout: 15000,
      userAgent: config.userAgent,
      followRedirects: true,
    });

    const $ = parseHtml(response.body);

    // Extract basic SEO data
    const title = extractTitle($);
    const metaDescription = extractMetaDescription($);
    const canonical = extractCanonical($);
    const h1Elements = $('h1');
    const h1 = h1Elements.length > 0 ? h1Elements.first().text().trim() : null;
    const bodyText = getBodyText($);
    const wordCount = countWords(bodyText);
    const contentHash = hashContent(bodyText);

    // Extract links
    const internalLinks: string[] = [];
    const externalLinks: string[] = [];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const resolved = resolveUrl(href, url);
      if (isInternalLink(resolved, url)) {
        internalLinks.push(resolved);
      } else {
        externalLinks.push(resolved);
      }
    });

    const pageData: Omit<CrawledPage, 'issues'> = {
      url,
      statusCode: response.status,
      redirectChain: response.redirectChain,
      responseTime: response.responseTime,
      depth,
      parentUrl,
      title,
      metaDescription,
      h1,
      canonical,
      wordCount,
      contentHash,
      internalLinks,
      externalLinks,
      crawledAt: Date.now(),
    };

    const issues = analyzePageIssues(pageData);

    return {
      page: { ...pageData, issues },
      discoveredLinks: internalLinks,
    };
  } catch (error) {
    logger.debug(`Error crawling ${url}: ${(error as Error).message}`);
    return null;
  }
}
