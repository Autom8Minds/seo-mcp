/**
 * URL frontier for the site crawler.
 *
 * Manages the queue of URLs to crawl with deduplication,
 * depth tracking, and priority ordering (breadth-first).
 */

import { normalizeUrl } from '../../utils/url-validator.js';

export interface FrontierEntry {
  url: string;
  depth: number;
  parentUrl: string | null;
  priority: number; // lower = higher priority
}

export class UrlFrontier {
  private queue: FrontierEntry[] = [];
  private seen: Set<string> = new Set();
  private maxDepth: number;
  private includePatterns: RegExp[];
  private excludePatterns: RegExp[];
  private allowedDomain: string;

  constructor(options: {
    maxDepth?: number;
    includePatterns?: string[];
    excludePatterns?: string[];
    allowedDomain: string;
  }) {
    this.maxDepth = options.maxDepth ?? 10;
    this.includePatterns = (options.includePatterns || []).map(p => new RegExp(p));
    this.excludePatterns = (options.excludePatterns || []).map(p => new RegExp(p));
    this.allowedDomain = options.allowedDomain.toLowerCase();
  }

  /**
   * Add a URL to the frontier if it passes all filters.
   * Returns true if the URL was added, false if filtered/duplicate.
   */
  add(url: string, depth: number, parentUrl: string | null): boolean {
    const normalized = normalizeUrl(url);

    // Skip if already seen
    if (this.seen.has(normalized)) return false;

    // Depth check
    if (depth > this.maxDepth) return false;

    // Domain check - only crawl same domain
    try {
      const parsed = new URL(normalized);
      if (parsed.hostname.toLowerCase() !== this.allowedDomain) return false;

      // Skip non-HTTP(S) protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) return false;

      // Skip common non-page resources
      const ext = parsed.pathname.split('.').pop()?.toLowerCase() || '';
      const skipExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'avif', 'ico',
        'css', 'js', 'woff', 'woff2', 'ttf', 'eot', 'otf',
        'pdf', 'zip', 'gz', 'tar', 'rar', 'mp3', 'mp4', 'avi', 'mov',
        'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'];
      if (skipExtensions.includes(ext)) return false;

      // Skip fragments and data URIs
      if (normalized.includes('#')) {
        // Normalize by removing fragment
        const withoutFragment = normalized.split('#')[0];
        if (this.seen.has(withoutFragment)) return false;
      }
    } catch {
      return false;
    }

    // Include/exclude patterns
    if (this.includePatterns.length > 0) {
      if (!this.includePatterns.some(p => p.test(normalized))) return false;
    }
    if (this.excludePatterns.some(p => p.test(normalized))) return false;

    this.seen.add(normalized);

    // Priority: lower depth = higher priority (breadth-first)
    this.queue.push({
      url: normalized,
      depth,
      parentUrl,
      priority: depth,
    });

    // Keep queue sorted by priority (breadth-first)
    this.queue.sort((a, b) => a.priority - b.priority);

    return true;
  }

  /** Get the next URL to crawl, or null if empty. */
  next(): FrontierEntry | null {
    return this.queue.shift() || null;
  }

  /** Check if the frontier has more URLs to crawl. */
  hasMore(): boolean {
    return this.queue.length > 0;
  }

  /** Get the number of URLs in the queue. */
  queueSize(): number {
    return this.queue.length;
  }

  /** Get the total number of unique URLs seen. */
  totalSeen(): number {
    return this.seen.size;
  }

  /** Check if a URL has already been seen. */
  hasSeen(url: string): boolean {
    return this.seen.has(normalizeUrl(url));
  }
}
