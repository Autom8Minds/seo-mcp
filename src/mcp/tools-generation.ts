/**
 * Generation tool definitions for the SEO MCP server.
 *
 * Three tools for generating SEO artifacts: Schema.org structured data,
 * robots.txt files, and meta tag suggestions.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const generationTools: Tool[] = [
  // ── generate_schema ───────────────────────────────────────────────────
  {
    name: 'generate_schema',
    description:
      'Generate valid Schema.org JSON-LD structured data markup. Provide the schema type and data fields; returns the full JSON-LD object, an HTML script snippet ready to paste, and validation results including Google rich-result eligibility. Supports all major types: Article, Product, LocalBusiness, FAQPage, HowTo, BreadcrumbList, Event, Organization, Person, Recipe, VideoObject, and more.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        type: {
          type: 'string',
          description: 'The Schema.org type to generate (e.g. "Article", "Product", "FAQPage", "LocalBusiness", "HowTo").',
        },
        data: {
          type: 'object',
          description: 'Key-value pairs of properties for the schema. Use property names from Schema.org (e.g. { "name": "...", "description": "...", "image": "..." }).',
          additionalProperties: true,
        },
        validate: {
          type: 'boolean',
          description: 'When true, validate the generated schema against Google\'s requirements. Defaults to true.',
          default: true,
        },
      },
      required: ['type', 'data'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ── generate_robots_txt ───────────────────────────────────────────────
  {
    name: 'generate_robots_txt',
    description:
      'Generate a robots.txt file from configuration options. Specify sitemap URLs, disallowed/allowed paths, crawl delay, and custom per-user-agent rules. Alternatively use a preset ("permissive", "restrictive", "wordpress", "ecommerce") as a starting point. Returns the complete robots.txt content ready to deploy.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        sitemapUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Sitemap URLs to include in the robots.txt.',
        },
        disallowPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'URL paths to disallow for all bots (e.g. ["/admin/", "/private/"]).',
        },
        allowPaths: {
          type: 'array',
          items: { type: 'string' },
          description: 'URL paths to explicitly allow (used to override broader disallow rules).',
        },
        crawlDelay: {
          type: 'number',
          description: 'Crawl-delay directive value in seconds.',
        },
        customRules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              userAgent: { type: 'string' },
              allow: { type: 'array', items: { type: 'string' } },
              disallow: { type: 'array', items: { type: 'string' } },
            },
            required: ['userAgent'],
          },
          description: 'Additional per-user-agent rule blocks.',
        },
        preset: {
          type: 'string',
          enum: ['permissive', 'restrictive', 'wordpress', 'ecommerce'],
          description: 'Start from a named preset configuration. Custom options override preset values.',
        },
      },
      required: [],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
  },

  // ── generate_meta_suggestions ─────────────────────────────────────────
  {
    name: 'generate_meta_suggestions',
    description:
      'Analyze a page\'s current meta tags and generate optimized suggestions. Returns the current title, meta description, and Open Graph tags alongside improved versions with explanations. Takes an optional target keyword to optimize keyword placement and density in the suggestions.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to analyze and generate meta tag suggestions for.',
        },
        targetKeyword: {
          type: 'string',
          description: 'Primary keyword to optimize the meta tags around.',
        },
        secondaryKeywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional keywords to incorporate into meta tag suggestions when natural.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },
];
