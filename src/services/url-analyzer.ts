/**
 * URL structure analyzer.
 *
 * Checks URL quality for SEO best practices: length, depth,
 * non-ASCII characters, uppercase, underscores, parameters,
 * file extensions, and trailing slashes.
 */

import { getUrlDepth, getFileExtension } from '../utils/url-validator.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import { logger } from '../utils/logger.js';
import type { SeoIssue } from '../types/seo-types.js';

export interface UrlCheck {
  check: string;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
  value?: string | number;
}

export interface UrlStructureAnalysis {
  url: string;
  parsed: {
    protocol: string;
    hostname: string;
    pathname: string;
    search: string;
    hash: string;
    depth: number;
    length: number;
    extension: string;
  };
  checks: UrlCheck[];
  score: number;
  issues: SeoIssue[];
}

export function analyzeUrlStructure(url: string): UrlStructureAnalysis {
  logger.info(`Analyzing URL structure: ${url}`);

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      url,
      parsed: { protocol: '', hostname: '', pathname: '', search: '', hash: '', depth: 0, length: url.length, extension: '' },
      checks: [{ check: 'Valid URL', status: 'fail', detail: 'URL is not valid and cannot be parsed.' }],
      score: 0,
      issues: [{ type: 'url', severity: 'critical', detail: 'URL is not valid.' }],
    };
  }

  const depth = getUrlDepth(url);
  const extension = getFileExtension(url);
  const checks: UrlCheck[] = [];
  const issues: SeoIssue[] = [];

  // 1. HTTPS check
  if (parsed.protocol === 'http:') {
    checks.push({ check: 'HTTPS', status: 'fail', detail: 'URL uses HTTP instead of HTTPS.' });
    issues.push({ type: 'url', severity: 'high', detail: 'URL uses HTTP instead of HTTPS.' });
  } else {
    checks.push({ check: 'HTTPS', status: 'pass', detail: 'URL uses HTTPS.' });
  }

  // 2. Length check
  const pathLength = parsed.pathname.length + parsed.search.length;
  if (pathLength > SEO_RULES.url.maxLength) {
    checks.push({ check: 'URL length', status: 'fail', detail: `URL path+query is ${pathLength} chars (max recommended: ${SEO_RULES.url.maxLength}).`, value: pathLength });
    issues.push({ type: 'url', severity: 'medium', detail: `URL path is too long (${pathLength} chars).` });
  } else if (pathLength > SEO_RULES.url.maxLength * 0.8) {
    checks.push({ check: 'URL length', status: 'warning', detail: `URL path+query is ${pathLength} chars, approaching limit of ${SEO_RULES.url.maxLength}.`, value: pathLength });
  } else {
    checks.push({ check: 'URL length', status: 'pass', detail: `URL path+query is ${pathLength} chars.`, value: pathLength });
  }

  // 3. Depth check
  if (depth > SEO_RULES.url.maxDepth) {
    checks.push({ check: 'URL depth', status: 'warning', detail: `URL depth is ${depth} (recommended max: ${SEO_RULES.url.maxDepth}).`, value: depth });
    issues.push({ type: 'url', severity: 'medium', detail: `URL depth is ${depth}, exceeding recommended max of ${SEO_RULES.url.maxDepth}.` });
  } else {
    checks.push({ check: 'URL depth', status: 'pass', detail: `URL depth is ${depth}.`, value: depth });
  }

  // 4. Uppercase check
  if (parsed.pathname !== parsed.pathname.toLowerCase()) {
    checks.push({ check: 'Lowercase', status: 'warning', detail: 'URL path contains uppercase characters. URLs are case-sensitive and this can cause duplicate content.' });
    issues.push({ type: 'url', severity: 'medium', detail: 'URL contains uppercase characters.' });
  } else {
    checks.push({ check: 'Lowercase', status: 'pass', detail: 'URL path is all lowercase.' });
  }

  // 5. Underscore check (hyphens preferred)
  if (parsed.pathname.includes('_')) {
    checks.push({ check: 'Hyphens vs underscores', status: 'warning', detail: 'URL contains underscores. Google recommends hyphens (-) over underscores (_) as word separators.' });
    issues.push({ type: 'url', severity: 'low', detail: 'URL uses underscores instead of hyphens.' });
  } else {
    checks.push({ check: 'Hyphens vs underscores', status: 'pass', detail: 'URL uses hyphens for word separation (or no separators needed).' });
  }

  // 6. Non-ASCII characters
  const nonAsciiMatch = parsed.pathname.match(/[^\x20-\x7E]/g);
  if (nonAsciiMatch) {
    checks.push({ check: 'ASCII characters', status: 'warning', detail: `URL contains ${nonAsciiMatch.length} non-ASCII character(s). These get percent-encoded and become hard to read.` });
    issues.push({ type: 'url', severity: 'low', detail: 'URL contains non-ASCII characters.' });
  } else {
    checks.push({ check: 'ASCII characters', status: 'pass', detail: 'URL contains only ASCII characters.' });
  }

  // 7. Query parameters
  const paramCount = parsed.searchParams.size;
  if (paramCount > 3) {
    checks.push({ check: 'Query parameters', status: 'warning', detail: `URL has ${paramCount} query parameters. Excessive parameters can cause crawl budget waste and duplicate content.`, value: paramCount });
    issues.push({ type: 'url', severity: 'medium', detail: `URL has ${paramCount} query parameters.` });
  } else if (paramCount > 0) {
    checks.push({ check: 'Query parameters', status: 'pass', detail: `URL has ${paramCount} query parameter(s).`, value: paramCount });
  } else {
    checks.push({ check: 'Query parameters', status: 'pass', detail: 'URL has no query parameters (clean URL).' });
  }

  // 8. File extension
  const problematicExtensions = ['php', 'asp', 'aspx', 'jsp', 'cgi'];
  if (problematicExtensions.includes(extension)) {
    checks.push({ check: 'File extension', status: 'warning', detail: `URL has .${extension} extension. Clean URLs without extensions are preferred for SEO.` });
    issues.push({ type: 'url', severity: 'low', detail: `URL has .${extension} extension.` });
  } else if (extension && !['html', 'htm', ''].includes(extension)) {
    checks.push({ check: 'File extension', status: 'pass', detail: `URL has .${extension} extension.` });
  } else {
    checks.push({ check: 'File extension', status: 'pass', detail: 'URL uses a clean path without file extension.' });
  }

  // 9. Double slashes in path
  if (/\/\//.test(parsed.pathname.slice(1))) {
    checks.push({ check: 'Double slashes', status: 'warning', detail: 'URL path contains double slashes (//), which can cause duplicate content.' });
    issues.push({ type: 'url', severity: 'medium', detail: 'URL contains double slashes in path.' });
  } else {
    checks.push({ check: 'Double slashes', status: 'pass', detail: 'No double slashes in URL path.' });
  }

  // 10. Trailing slash consistency (just note it, not an error)
  const hasTrailingSlash = parsed.pathname.length > 1 && parsed.pathname.endsWith('/');
  checks.push({
    check: 'Trailing slash',
    status: 'pass',
    detail: hasTrailingSlash ? 'URL has a trailing slash. Ensure consistency across the site.' : 'URL has no trailing slash.',
  });

  // Score calculation
  let score = 100;
  for (const check of checks) {
    if (check.status === 'fail') score -= 15;
    else if (check.status === 'warning') score -= 7;
  }
  score = Math.max(0, score);

  logger.info(`URL structure analysis complete: ${url} (score: ${score})`);

  return {
    url,
    parsed: {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      depth,
      length: pathLength,
      extension,
    },
    checks,
    score,
    issues,
  };
}
