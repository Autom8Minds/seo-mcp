/**
 * Performance tool definitions for the SEO MCP server.
 *
 * Two tools for page performance analysis using the Google PageSpeed Insights API:
 * Core Web Vitals checking and mobile-friendliness testing.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const performanceTools: Tool[] = [
  // ── check_core_web_vitals ─────────────────────────────────────────────
  {
    name: 'check_core_web_vitals',
    description:
      'Measure Core Web Vitals and Lighthouse scores for a URL using the Google PageSpeed Insights API. Returns LCP, INP, CLS, FCP, and TTFB with ratings, Lighthouse category scores (performance, SEO, accessibility, best-practices), field data when available, performance opportunities, diagnostics, and a resource size summary. Works without an API key (rate-limited) or with a PAGESPEED_API_KEY for higher quotas.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to test.',
        },
        strategy: {
          type: 'string',
          enum: ['mobile', 'desktop'],
          description: 'Device strategy for the Lighthouse run. Defaults to "mobile".',
          default: 'mobile',
        },
        categories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['performance', 'seo', 'accessibility', 'best-practices'],
          },
          description: 'Lighthouse categories to audit. Defaults to all four.',
          default: ['performance', 'seo', 'accessibility', 'best-practices'],
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },

  // ── check_mobile_friendly ─────────────────────────────────────────────
  {
    name: 'check_mobile_friendly',
    description:
      'Check whether a URL is mobile-friendly. Returns viewport configuration, font legibility, tap target sizing, content width checks, a mobile Lighthouse score, and a list of mobile-specific issues.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to test for mobile-friendliness.',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: false,
      openWorldHint: true,
    },
  },
];
