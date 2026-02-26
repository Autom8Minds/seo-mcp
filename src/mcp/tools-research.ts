/**
 * Research tool definitions for the SEO MCP server.
 *
 * Four tools for keyword research, SERP analysis, backlink analysis, and
 * domain authority checks. All require third-party API keys (DataForSEO / Moz).
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const researchTools: Tool[] = [
  // ── research_keywords ─────────────────────────────────────────────────
  {
    name: 'research_keywords',
    description:
      'Research one or more keywords using the DataForSEO API. Returns search volume, keyword difficulty, CPC, competition level, 12-month trend data, and SERP features for each keyword. Optionally includes related keyword suggestions. Requires DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of keywords to research (max 100).',
          minItems: 1,
          maxItems: 100,
        },
        location: {
          type: 'string',
          description: 'Location name for localized results (e.g. "United States", "London,England"). Defaults to "United States".',
          default: 'United States',
        },
        language: {
          type: 'string',
          description: 'Language code (e.g. "en", "es", "de"). Defaults to "en".',
          default: 'en',
        },
        includeRelated: {
          type: 'boolean',
          description: 'When true, also return related keyword suggestions for each input keyword.',
          default: false,
        },
        limit: {
          type: 'number',
          description: 'Maximum number of related keywords to return per input keyword. Defaults to 10.',
          default: 10,
        },
      },
      required: ['keywords'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── analyze_serp ──────────────────────────────────────────────────────
  {
    name: 'analyze_serp',
    description:
      'Analyze the search engine results page (SERP) for a keyword. Returns organic results with position, URL, title, and description; detected SERP features (featured snippet, PAA, local pack, etc.); featured snippet content; People Also Ask questions; and estimated search intent. Requires DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        keyword: {
          type: 'string',
          description: 'The search query to analyze.',
        },
        location: {
          type: 'string',
          description: 'Location name for localized SERP (e.g. "United States"). Defaults to "United States".',
          default: 'United States',
        },
        device: {
          type: 'string',
          enum: ['desktop', 'mobile'],
          description: 'Device type for the SERP query. Defaults to "desktop".',
          default: 'desktop',
        },
        depth: {
          type: 'number',
          description: 'Number of SERP results to return (10, 20, 50, or 100). Defaults to 10.',
          default: 10,
        },
      },
      required: ['keyword'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── analyze_backlinks ─────────────────────────────────────────────────
  {
    name: 'analyze_backlinks',
    description:
      'Analyze the backlink profile of a URL or domain. Returns total backlink count, referring domains, domain authority, follow ratio, top backlinks with source details, anchor text distribution (branded/exact/partial/generic/URL), and referring domain tier breakdown. Requires DataForSEO or Moz API credentials.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        target: {
          type: 'string',
          description: 'The URL or domain to analyze backlinks for.',
        },
        targetType: {
          type: 'string',
          enum: ['url', 'domain', 'subdomain'],
          description: 'Whether the target is a specific URL, a root domain, or a subdomain. Defaults to "domain".',
          default: 'domain',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of individual backlinks to return. Defaults to 50.',
          default: 50,
        },
        sortBy: {
          type: 'string',
          enum: ['domain_authority', 'first_seen', 'last_seen'],
          description: 'How to sort the returned backlinks. Defaults to "domain_authority".',
          default: 'domain_authority',
        },
        includeAnchors: {
          type: 'boolean',
          description: 'When true, include full anchor text distribution analysis.',
          default: true,
        },
      },
      required: ['target'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── analyze_domain_authority ───────────────────────────────────────────
  {
    name: 'analyze_domain_authority',
    description:
      'Check domain authority metrics for one or more domains. Returns domain authority score, total backlinks, referring domains, and optionally organic keyword count, traffic estimate, and spam score for each domain. Requires DataForSEO or Moz API credentials.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of domains to check (max 50). Provide bare domains without protocol (e.g. "example.com").',
          minItems: 1,
          maxItems: 50,
        },
      },
      required: ['domains'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];
