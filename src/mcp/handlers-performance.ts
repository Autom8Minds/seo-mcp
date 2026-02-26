/**
 * Handler functions for performance tools.
 *
 * Delegates to the PageSpeed Insights service for Core Web Vitals
 * and mobile-friendliness checks.
 */

import { checkCoreWebVitals, checkMobileFriendly } from '../services/pagespeed-client.js';
import { loadApiKeys } from '../config/api-keys.js';
import { formatToolError } from '../utils/error-handler.js';

/** Standard MCP tool result shape. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

// -- check_core_web_vitals ------------------------------------------------

export async function handleCheckCoreWebVitals(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const keys = loadApiKeys();
    const result = await checkCoreWebVitals(
      url,
      (args.strategy as 'mobile' | 'desktop') ?? 'mobile',
      (args.categories as string[]) ?? ['performance', 'seo', 'accessibility', 'best-practices'],
      keys.pagespeedApiKey,
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- check_mobile_friendly ------------------------------------------------

export async function handleCheckMobileFriendly(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const keys = loadApiKeys();
    const result = await checkMobileFriendly(url, keys.pagespeedApiKey);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}
