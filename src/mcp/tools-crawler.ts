/**
 * Crawler tool definitions for the SEO MCP server.
 *
 * Three tools implementing the async job pattern:
 * crawl_site (start), crawl_status (poll), crawl_results (retrieve).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const crawlerTools: Tool[] = [
  // ── crawl_site ──────────────────────────────────────────────────────
  {
    name: 'crawl_site',
    description:
      'Start a full site crawl using breadth-first discovery. Returns a crawl ID immediately — the crawl runs in the background. Use crawl_status to check progress and crawl_results to retrieve findings. Discovers pages by following internal links, checks SEO issues on each page, detects duplicate content, redirect chains, thin content, missing titles/descriptions, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The seed URL to start crawling from (e.g., "https://example.com").',
        },
        maxPages: {
          type: 'number',
          description: 'Maximum number of pages to crawl. Defaults to 100.',
          default: 100,
        },
        maxDepth: {
          type: 'number',
          description: 'Maximum link depth from the seed URL. Defaults to 10.',
          default: 10,
        },
        concurrency: {
          type: 'number',
          description: 'Number of pages to fetch concurrently. Defaults to 5.',
          default: 5,
        },
        respectRobotsTxt: {
          type: 'boolean',
          description: 'Whether to respect robots.txt disallow rules. Defaults to true.',
          default: true,
        },
        userAgent: {
          type: 'string',
          description: 'Custom User-Agent header. Defaults to SEO-MCP bot agent.',
        },
        includePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Regex patterns — only URLs matching at least one pattern will be crawled.',
        },
        excludePatterns: {
          type: 'array',
          items: { type: 'string' },
          description: 'Regex patterns — URLs matching any pattern will be skipped.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ── crawl_status ────────────────────────────────────────────────────
  {
    name: 'crawl_status',
    description:
      'Check the progress of a running or completed site crawl. Returns the crawl state, pages crawled/queued/errored, issue counts, and status code distribution.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        crawlId: {
          type: 'string',
          description: 'The crawl ID returned by crawl_site.',
        },
      },
      required: ['crawlId'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ── crawl_results ───────────────────────────────────────────────────
  {
    name: 'crawl_results',
    description:
      'Retrieve the full results of a completed (or in-progress) site crawl. Returns aggregated issues, duplicate content groups, redirect chains, pages by status code, and per-page details. Use the filter parameter to focus on specific issue types.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        crawlId: {
          type: 'string',
          description: 'The crawl ID returned by crawl_site.',
        },
        filter: {
          type: 'string',
          enum: ['all', 'issues', 'duplicates', 'redirects', 'pages', 'summary'],
          description: 'Filter results to a specific category. Defaults to "summary".',
          default: 'summary',
        },
        severity: {
          type: 'string',
          enum: ['critical', 'high', 'medium', 'low'],
          description: 'Filter issues by minimum severity.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of items to return per category. Defaults to 50.',
          default: 50,
        },
      },
      required: ['crawlId'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
];
