/**
 * Handler functions for analysis tools.
 *
 * Each handler validates inputs, delegates to the appropriate service,
 * and returns MCP-formatted results or error responses.
 */

import { analyzePage } from '../services/page-analyzer.js';
import { analyzeHeadings } from '../services/heading-analyzer.js';
import { analyzeImages } from '../services/image-analyzer.js';
import { analyzeLinks } from '../services/link-analyzer.js';
import { extractSchema } from '../services/schema-extractor.js';
import { analyzeRobotsTxt } from '../services/robots-analyzer.js';
import { analyzeSitemap } from '../services/sitemap-analyzer.js';
import { formatToolError } from '../utils/error-handler.js';

/** Standard MCP tool result shape. */
interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

// -- analyze_page --------------------------------------------------------

export async function handleAnalyzePage(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await analyzePage(url, {
      includeContent: args.includeContent as boolean | undefined,
      followRedirects: args.followRedirects as boolean | undefined,
      userAgent: args.userAgent as string | undefined,
      renderJs: args.renderJs as boolean | undefined,
    });

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_headings ----------------------------------------------------

export async function handleAnalyzeHeadings(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await analyzeHeadings(url, args.targetKeyword as string | undefined);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_images ------------------------------------------------------

export async function handleAnalyzeImages(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await analyzeImages(
      url,
      (args.checkFileSize as boolean) ?? false,
      (args.maxImages as number) ?? 100,
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_internal_links -----------------------------------------------

export async function handleAnalyzeInternalLinks(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await analyzeLinks(
      url,
      (args.checkBrokenLinks as boolean) ?? false,
      (args.maxLinks as number) ?? 500,
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- extract_schema -------------------------------------------------------

export async function handleExtractSchema(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await extractSchema(url, (args.validateGoogle as boolean) ?? true);

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_robots_txt ---------------------------------------------------

export async function handleAnalyzeRobotsTxt(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const domain = args.domain as string;
    if (!domain) {
      return formatToolError(new Error('The "domain" parameter is required.'));
    }

    const result = await analyzeRobotsTxt(
      domain,
      args.testPath as string | undefined,
      (args.userAgent as string) ?? '*',
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}

// -- analyze_sitemap ------------------------------------------------------

export async function handleAnalyzeSitemap(args: Record<string, unknown>): Promise<ToolResult> {
  try {
    const url = args.url as string;
    if (!url) {
      return formatToolError(new Error('The "url" parameter is required.'));
    }

    const result = await analyzeSitemap(
      url,
      (args.maxUrls as number) ?? 1000,
      (args.checkUrls as boolean) ?? false,
    );

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (error) {
    return formatToolError(error);
  }
}
