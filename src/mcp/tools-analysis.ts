/**
 * Analysis tool definitions for the SEO MCP server.
 *
 * Seven tools covering on-page SEO analysis: full page audit, headings,
 * images, internal links, structured data extraction, robots.txt, and sitemaps.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

export const analysisTools: Tool[] = [
  // ── analyze_page ──────────────────────────────────────────────────────
  {
    name: 'analyze_page',
    description:
      'Run a comprehensive on-page SEO audit for a URL. Returns title, meta description, canonical, robots directives, Open Graph tags, heading summary, image summary, link counts, and an overall SEO score with per-category breakdowns. Optionally includes word count / readability when includeContent is true.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to analyze (must start with http:// or https://).',
        },
        includeContent: {
          type: 'boolean',
          description: 'When true, also return word count and readability score for the page body text.',
          default: false,
        },
        followRedirects: {
          type: 'boolean',
          description: 'Follow HTTP redirects and report the final URL plus the redirect chain.',
          default: true,
        },
        userAgent: {
          type: 'string',
          description: 'Custom User-Agent header to send with the request. Defaults to the SEO-MCP bot agent.',
        },
        renderJs: {
          type: 'boolean',
          description: 'When true, render the page with a headless browser before analysis (requires Puppeteer).',
          default: false,
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

  // ── analyze_headings ──────────────────────────────────────────────────
  {
    name: 'analyze_headings',
    description:
      'Analyze the heading hierarchy (H1-H6) of a page. Returns a nested heading tree, flat list with ordering, tag counts, hierarchy issues, and optional keyword presence check across headings.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to analyze.',
        },
        targetKeyword: {
          type: 'string',
          description: 'Optional keyword to check for presence in H1 and H2 headings.',
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

  // ── analyze_images ────────────────────────────────────────────────────
  {
    name: 'analyze_images',
    description:
      'Audit all images on a page for SEO best practices. Checks alt text, file size, modern formats (WebP/AVIF), lazy loading, dimensions, and filename quality. Returns per-image details and an aggregate score.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to analyze.',
        },
        checkFileSize: {
          type: 'boolean',
          description: 'When true, issue HEAD requests to determine each image file size. Slower but more accurate.',
          default: false,
        },
        maxImages: {
          type: 'number',
          description: 'Maximum number of images to analyze. Defaults to 100.',
          default: 100,
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

  // ── analyze_internal_links ────────────────────────────────────────────
  {
    name: 'analyze_internal_links',
    description:
      'Analyze all internal and external links on a page. Returns link lists with anchor text, nofollow status, position (nav/content/footer/sidebar), anchor text quality distribution, and summary counts. Optionally checks for broken links.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to analyze.',
        },
        checkBrokenLinks: {
          type: 'boolean',
          description: 'When true, issue HEAD requests to every link to detect broken (4xx/5xx) links. Much slower.',
          default: false,
        },
        maxLinks: {
          type: 'number',
          description: 'Maximum number of links to analyze. Defaults to 500.',
          default: 500,
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

  // ── extract_schema ────────────────────────────────────────────────────
  {
    name: 'extract_schema',
    description:
      'Extract and validate all structured data (JSON-LD, Microdata, RDFa) from a page. Returns each schema with its format, type, raw data, and validation results including Google rich-result eligibility.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'The fully-qualified URL to extract structured data from.',
        },
        validateGoogle: {
          type: 'boolean',
          description: 'When true, validate each schema against Google\'s rich result requirements.',
          default: true,
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

  // ── analyze_robots_txt ────────────────────────────────────────────────
  {
    name: 'analyze_robots_txt',
    description:
      'Fetch and analyze a domain\'s robots.txt file. Returns the raw content, parsed allow/disallow rules per user-agent, listed sitemaps, and any issues. Optionally tests whether a specific path is allowed.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        domain: {
          type: 'string',
          description: 'The domain to check (e.g. "example.com"). The tool will fetch https://<domain>/robots.txt.',
        },
        testPath: {
          type: 'string',
          description: 'Optional URL path to test against the robots rules (e.g. "/private/page").',
        },
        userAgent: {
          type: 'string',
          description: 'User-agent to test the path against. Defaults to "*".',
          default: '*',
        },
      },
      required: ['domain'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: true,
    },
  },

  // ── analyze_sitemap ───────────────────────────────────────────────────
  {
    name: 'analyze_sitemap',
    description:
      'Fetch and analyze an XML sitemap (urlset or sitemap index). Returns URL count, lastmod distribution, and issues. Optionally spot-checks URLs for HTTP status codes.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        url: {
          type: 'string',
          description: 'Full URL of the XML sitemap to analyze.',
        },
        maxUrls: {
          type: 'number',
          description: 'Maximum number of URLs to process from the sitemap. Defaults to 1000.',
          default: 1000,
        },
        checkUrls: {
          type: 'boolean',
          description: 'When true, issue HEAD requests to a sample of sitemap URLs to verify they return 200.',
          default: false,
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
