/**
 * Handler functions for research tools.
 *
 * All research tools require third-party API keys (DataForSEO or Moz).
 * Handlers check for key availability before making requests.
 */

import {
  researchKeywords,
  analyzeSerpResults,
  analyzeBacklinks,
  analyzeDomainAuthority,
} from '../services/dataforseo-client.js';
import { loadApiKeys, hasDataForSeo, hasBacklinkApi } from '../config/api-keys.js';
import { ApiKeyMissingError, formatToolError } from '../utils/error-handler.js';

/** Standard MCP tool result shape. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

// -- research_keywords ----------------------------------------------------

export async function handleResearchKeywords(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasDataForSeo(keys)) {
      throw new ApiKeyMissingError(
        'DataForSEO',
        'Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables. Sign up at https://dataforseo.com/',
      );
    }

    const keywords = args.keywords as string[];
    if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
      return formatToolError(new Error('The "keywords" parameter is required and must be a non-empty array.'));
    }

    const result = await researchKeywords(keywords, {
      location: (args.location as string) ?? 'United States',
      language: (args.language as string) ?? 'en',
      includeRelated: (args.includeRelated as boolean) ?? false,
      limit: (args.limit as number) ?? 10,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_serp ---------------------------------------------------------

export async function handleAnalyzeSerp(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasDataForSeo(keys)) {
      throw new ApiKeyMissingError(
        'DataForSEO',
        'Set DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables. Sign up at https://dataforseo.com/',
      );
    }

    const keyword = args.keyword as string;
    if (!keyword) {
      return formatToolError(new Error('The "keyword" parameter is required.'));
    }

    const result = await analyzeSerpResults(keyword, {
      location: (args.location as string) ?? 'United States',
      device: (args.device as 'desktop' | 'mobile') ?? 'desktop',
      depth: (args.depth as number) ?? 10,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_backlinks ----------------------------------------------------

export async function handleAnalyzeBacklinks(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasBacklinkApi(keys)) {
      throw new ApiKeyMissingError(
        'DataForSEO or Moz',
        'Set DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD or MOZ_ACCESS_ID/MOZ_SECRET_KEY environment variables.',
      );
    }

    const target = args.target as string;
    if (!target) {
      return formatToolError(new Error('The "target" parameter is required.'));
    }

    const result = await analyzeBacklinks(target, {
      targetType: (args.targetType as 'url' | 'domain' | 'subdomain') ?? 'domain',
      limit: (args.limit as number) ?? 50,
      sortBy: (args.sortBy as 'domain_authority' | 'first_seen' | 'last_seen') ?? 'domain_authority',
      includeAnchors: (args.includeAnchors as boolean) ?? true,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_domain_authority ---------------------------------------------

export async function handleAnalyzeDomainAuthority(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const keys = loadApiKeys();
    if (!hasBacklinkApi(keys)) {
      throw new ApiKeyMissingError(
        'DataForSEO or Moz',
        'Set DATAFORSEO_LOGIN/DATAFORSEO_PASSWORD or MOZ_ACCESS_ID/MOZ_SECRET_KEY environment variables.',
      );
    }

    const domains = args.domains as string[];
    if (!domains || !Array.isArray(domains) || domains.length === 0) {
      return formatToolError(new Error('The "domains" parameter is required and must be a non-empty array.'));
    }

    const result = await analyzeDomainAuthority(domains);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}
