/**
 * Handler functions for generation tools.
 *
 * These tools produce SEO artifacts (structured data, robots.txt, meta suggestions)
 * and do not require external API keys for basic operation.
 */

import { generateSchema } from '../services/schema-generator.js';
import { generateRobotsTxt } from '../services/robots-generator.js';
import { generateMetaSuggestions } from '../services/meta-suggestions.js';
import { formatToolError } from '../utils/error-handler.js';

/** Standard MCP tool result shape. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

// -- generate_schema ------------------------------------------------------

export async function handleGenerateSchema(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const type = args.type as string;
    if (!type) {
      return formatToolError(new Error('The "type" parameter is required.'));
    }

    const data = args.data as Record<string, unknown>;
    if (!data || typeof data !== 'object') {
      return formatToolError(new Error('The "data" parameter is required and must be an object.'));
    }

    const result = generateSchema(type, data, (args.validate as boolean) ?? true);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- generate_robots_txt --------------------------------------------------

export async function handleGenerateRobotsTxt(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const result = generateRobotsTxt({
      sitemapUrls: args.sitemapUrls as string[] | undefined,
      disallowPaths: args.disallowPaths as string[] | undefined,
      allowPaths: args.allowPaths as string[] | undefined,
      crawlDelay: args.crawlDelay as number | undefined,
      customRules: args.customRules as Array<{
        userAgent: string;
        allow?: string[];
        disallow?: string[];
      }> | undefined,
      preset: args.preset as 'permissive' | 'standard' | 'restrictive' | undefined,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- generate_meta_suggestions --------------------------------------------

export async function handleGenerateMetaSuggestions(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await generateMetaSuggestions(
      url,
      args.targetKeyword as string | undefined,
      args.secondaryKeywords as string[] | undefined,
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}
