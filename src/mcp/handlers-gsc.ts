/**
 * Handler functions for Google Search Console tools.
 *
 * All GSC tools require OAuth credentials. Handlers verify key availability
 * before making requests.
 */

// TODO: Import from actual service once implemented
import { queryPerformance, getIndexCoverage, manageSitemaps } from '../services/gsc-client.js';
import { loadApiKeys, hasGsc } from '../config/api-keys.js';
import { ApiKeyMissingError, formatToolError } from '../utils/error-handler.js';

/** Standard MCP tool result shape. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

const GSC_SETUP_INSTRUCTIONS =
  'Set GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN environment variables. ' +
  'Follow the Google Search Console API setup guide at https://developers.google.com/webmaster-tools/';

// ── gsc_performance ─────────────────────────────────────────────────────

export async function handleGscPerformance(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasGsc(keys)) {
      throw new ApiKeyMissingError('Google Search Console', GSC_SETUP_INSTRUCTIONS);
    }

    const siteUrl = args.siteUrl as string;
    if (!siteUrl) {
      return formatToolError(new Error('The "siteUrl" parameter is required.'));
    }

    const result = await queryPerformance(siteUrl, {
      startDate: args.startDate as string | undefined,
      endDate: args.endDate as string | undefined,
      dimensions: args.dimensions as string[] | undefined,
      filters: args.filters as Array<{
        dimension: string;
        operator: string;
        expression: string;
      }> | undefined,
      rowLimit: args.rowLimit as number | undefined,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// ── gsc_index_coverage ──────────────────────────────────────────────────

export async function handleGscIndexCoverage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasGsc(keys)) {
      throw new ApiKeyMissingError('Google Search Console', GSC_SETUP_INSTRUCTIONS);
    }

    const siteUrl = args.siteUrl as string;
    if (!siteUrl) {
      return formatToolError(new Error('The "siteUrl" parameter is required.'));
    }

    const result = await getIndexCoverage(siteUrl, {
      url: args.url as string | undefined,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// ── gsc_sitemaps ────────────────────────────────────────────────────────

export async function handleGscSitemaps(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasGsc(keys)) {
      throw new ApiKeyMissingError('Google Search Console', GSC_SETUP_INSTRUCTIONS);
    }

    const siteUrl = args.siteUrl as string;
    if (!siteUrl) {
      return formatToolError(new Error('The "siteUrl" parameter is required.'));
    }

    const result = await manageSitemaps(siteUrl, {
      sitemapUrl: args.sitemapUrl as string | undefined,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}
