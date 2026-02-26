/**
 * Google Search Console (GSC) tool definitions for the SEO MCP server.
 *
 * Three tools for querying GSC performance data, index coverage, and sitemaps.
 * All require GSC OAuth credentials (GSC_CLIENT_ID, GSC_CLIENT_SECRET, GSC_REFRESH_TOKEN).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const gscTools: Tool[] = [
  // ── gsc_performance ───────────────────────────────────────────────────
  {
    name: 'gsc_performance',
    description:
      'Query Google Search Console performance data (clicks, impressions, CTR, position) for a verified property. Supports date range filtering, dimension breakdowns (query, page, country, device, searchAppearance), and row-level filters. Returns individual rows plus aggregate totals. Requires GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN environment variables.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        siteUrl: {
          type: 'string',
          description: 'The GSC property URL (e.g. "https://example.com/" or "sc-domain:example.com").',
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format. Defaults to 28 days ago.',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format. Defaults to today.',
        },
        dimensions: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['query', 'page', 'country', 'device', 'searchAppearance', 'date'],
          },
          description: 'Dimensions to group results by. Defaults to ["query"].',
          default: ['query'],
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dimension: {
                type: 'string',
                enum: ['query', 'page', 'country', 'device', 'searchAppearance'],
              },
              operator: {
                type: 'string',
                enum: ['contains', 'equals', 'notContains', 'notEquals'],
              },
              expression: { type: 'string' },
            },
            required: ['dimension', 'operator', 'expression'],
          },
          description: 'Optional filters to narrow the data.',
        },
        rowLimit: {
          type: 'number',
          description: 'Maximum number of rows to return (1-25000). Defaults to 1000.',
          default: 1000,
        },
      },
      required: ['siteUrl'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── gsc_index_coverage ────────────────────────────────────────────────
  {
    name: 'gsc_index_coverage',
    description:
      'Check Google Search Console index coverage status. Returns counts of valid, warning, error, and excluded pages. When a specific URL is provided, returns detailed inspection results including index status, crawl status, canonical, and mobile usability. Requires GSC OAuth credentials.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        siteUrl: {
          type: 'string',
          description: 'The GSC property URL (e.g. "https://example.com/" or "sc-domain:example.com").',
        },
        url: {
          type: 'string',
          description: 'Optional specific URL to inspect for detailed index coverage information.',
        },
      },
      required: ['siteUrl'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── gsc_sitemaps ──────────────────────────────────────────────────────
  {
    name: 'gsc_sitemaps',
    description:
      'List or submit sitemaps in Google Search Console. Without a sitemapUrl, lists all submitted sitemaps with their status, URL count, warnings, and errors. With a sitemapUrl, submits the sitemap to GSC for processing. Requires GSC OAuth credentials.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        siteUrl: {
          type: 'string',
          description: 'The GSC property URL (e.g. "https://example.com/" or "sc-domain:example.com").',
        },
        sitemapUrl: {
          type: 'string',
          description: 'Optional sitemap URL to submit. If omitted, lists existing sitemaps.',
        },
      },
      required: ['siteUrl'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];
