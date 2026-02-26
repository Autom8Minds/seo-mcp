/**
 * Main MCP server setup for seo-mcp.
 *
 * Creates an MCP Server instance, registers all 20 tool definitions,
 * and wires up tool-call handlers that route to the appropriate handler
 * functions. Exported as `createServer()` for use by the CLI entry point
 * and the library root.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

import { DEFAULTS } from '../config/defaults.js';
import { formatToolError } from '../utils/error-handler.js';
import { logger } from '../utils/logger.js';

// ── Tool definitions ────────────────────────────────────────────────────
import { analysisTools } from './tools-analysis.js';
import { performanceTools } from './tools-performance.js';
import { researchTools } from './tools-research.js';
import { gscTools } from './tools-gsc.js';
import { generationTools } from './tools-generation.js';

// ── Handlers ────────────────────────────────────────────────────────────
import {
  handleAnalyzePage,
  handleAnalyzeHeadings,
  handleAnalyzeImages,
  handleAnalyzeInternalLinks,
  handleExtractSchema,
  handleAnalyzeRobotsTxt,
  handleAnalyzeSitemap,
} from './handlers-analysis.js';

import {
  handleCheckCoreWebVitals,
  handleCheckMobileFriendly,
} from './handlers-performance.js';

import {
  handleResearchKeywords,
  handleAnalyzeSerp,
  handleAnalyzeBacklinks,
  handleAnalyzeDomainAuthority,
} from './handlers-research.js';

import {
  handleGscPerformance,
  handleGscIndexCoverage,
  handleGscSitemaps,
} from './handlers-gsc.js';

import {
  handleGenerateSchema,
  handleGenerateRobotsTxt,
  handleGenerateMetaSuggestions,
} from './handlers-generation.js';

// ── Aggregate tool list ─────────────────────────────────────────────────

const allTools: Tool[] = [
  ...analysisTools,
  ...performanceTools,
  ...researchTools,
  ...gscTools,
  ...generationTools,
];

// ── Handler dispatch map ────────────────────────────────────────────────

type HandlerFn = (args: Record<string, unknown>) => Promise<{
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}>;

const handlers: Record<string, HandlerFn> = {
  // Analysis
  analyze_page: handleAnalyzePage,
  analyze_headings: handleAnalyzeHeadings,
  analyze_images: handleAnalyzeImages,
  analyze_internal_links: handleAnalyzeInternalLinks,
  extract_schema: handleExtractSchema,
  analyze_robots_txt: handleAnalyzeRobotsTxt,
  analyze_sitemap: handleAnalyzeSitemap,

  // Performance
  check_core_web_vitals: handleCheckCoreWebVitals,
  check_mobile_friendly: handleCheckMobileFriendly,

  // Research
  research_keywords: handleResearchKeywords,
  analyze_serp: handleAnalyzeSerp,
  analyze_backlinks: handleAnalyzeBacklinks,
  analyze_domain_authority: handleAnalyzeDomainAuthority,

  // Google Search Console
  gsc_performance: handleGscPerformance,
  gsc_index_coverage: handleGscIndexCoverage,
  gsc_sitemaps: handleGscSitemaps,

  // Generation
  generate_schema: handleGenerateSchema,
  generate_robots_txt: handleGenerateRobotsTxt,
  generate_meta_suggestions: handleGenerateMetaSuggestions,
};

// ── Server factory ──────────────────────────────────────────────────────

/**
 * Create and configure the MCP server with all SEO tools registered.
 *
 * Call `server.connect(transport)` to start serving requests.
 */
export function createServer(): Server {
  const server = new Server(
    {
      name: DEFAULTS.serverName,
      version: DEFAULTS.serverVersion,
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  // ── List tools handler ──────────────────────────────────────────────

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    logger.debug(`Listing ${allTools.length} tools`);
    return { tools: allTools };
  });

  // ── Call tool handler ───────────────────────────────────────────────

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info(`Tool called: ${name}`);
    logger.debug(`Tool args: ${JSON.stringify(args)}`);

    const handler = handlers[name];

    if (!handler) {
      logger.error(`Unknown tool: ${name}`);
      return formatToolError(
        new Error(
          `Unknown tool: "${name}". Use ListTools to see available tools.`,
        ),
      );
    }

    try {
      const result = await handler((args ?? {}) as Record<string, unknown>);
      logger.info(`Tool ${name} completed${result.isError ? ' with error' : ' successfully'}`);
      return result;
    } catch (error) {
      logger.error(`Unhandled error in tool ${name}:`, error);
      return formatToolError(error);
    }
  });

  // ── Error handling ──────────────────────────────────────────────────

  server.onerror = (error) => {
    logger.error('MCP server error:', error);
  };

  return server;
}
