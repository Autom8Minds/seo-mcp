/**
 * Hreflang attribute analyzer.
 *
 * Validates hreflang link elements for international SEO:
 * language code format, x-default presence, return link verification,
 * self-referencing tags, and consistency.
 */

import { httpGet } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';
import type { SeoIssue } from '../types/seo-types.js';

export interface HreflangTag {
  hreflang: string;
  href: string;
}

export interface HreflangReturnCheck {
  sourceUrl: string;
  sourceHreflang: string;
  targetUrl: string;
  hasReturnLink: boolean;
  returnHreflang: string | null;
}

export interface HreflangAnalysis {
  url: string;
  tags: HreflangTag[];
  hasXDefault: boolean;
  hasSelfReferencing: boolean;
  languageCodes: string[];
  issues: SeoIssue[];
  returnLinkChecks: HreflangReturnCheck[];
  score: number;
}

// ISO 639-1 language codes (common subset)
const VALID_LANGUAGE_CODES = new Set([
  'aa', 'ab', 'af', 'ak', 'am', 'an', 'ar', 'as', 'av', 'ay', 'az',
  'ba', 'be', 'bg', 'bh', 'bi', 'bm', 'bn', 'bo', 'br', 'bs',
  'ca', 'ce', 'ch', 'co', 'cr', 'cs', 'cu', 'cv', 'cy',
  'da', 'de', 'dv', 'dz',
  'ee', 'el', 'en', 'eo', 'es', 'et', 'eu',
  'fa', 'ff', 'fi', 'fj', 'fo', 'fr', 'fy',
  'ga', 'gd', 'gl', 'gn', 'gu', 'gv',
  'ha', 'he', 'hi', 'ho', 'hr', 'ht', 'hu', 'hy', 'hz',
  'ia', 'id', 'ie', 'ig', 'ii', 'ik', 'io', 'is', 'it', 'iu',
  'ja', 'jv',
  'ka', 'kg', 'ki', 'kj', 'kk', 'kl', 'km', 'kn', 'ko', 'kr', 'ks', 'ku', 'kv', 'kw', 'ky',
  'la', 'lb', 'lg', 'li', 'ln', 'lo', 'lt', 'lu', 'lv',
  'mg', 'mh', 'mi', 'mk', 'ml', 'mn', 'mr', 'ms', 'mt', 'my',
  'na', 'nb', 'nd', 'ne', 'ng', 'nl', 'nn', 'no', 'nr', 'nv', 'ny',
  'oc', 'oj', 'om', 'or', 'os',
  'pa', 'pi', 'pl', 'ps', 'pt',
  'qu',
  'rm', 'rn', 'ro', 'ru', 'rw',
  'sa', 'sc', 'sd', 'se', 'sg', 'si', 'sk', 'sl', 'sm', 'sn', 'so', 'sq', 'sr', 'ss', 'st', 'su', 'sv', 'sw',
  'ta', 'te', 'tg', 'th', 'ti', 'tk', 'tl', 'tn', 'to', 'tr', 'ts', 'tt', 'tw', 'ty',
  'ug', 'uk', 'ur', 'uz',
  'va', 've', 'vi', 'vo',
  'wa', 'wo',
  'xh',
  'yi', 'yo',
  'za', 'zh', 'zu',
]);

function isValidHreflangCode(code: string): boolean {
  if (code === 'x-default') return true;

  // Format: language or language-region (e.g., "en", "en-US", "zh-Hans-CN")
  const parts = code.toLowerCase().split('-');
  if (parts.length === 0) return false;

  // First part must be a valid language code
  if (!VALID_LANGUAGE_CODES.has(parts[0])) return false;

  // Region codes (ISO 3166-1 alpha-2) are 2 uppercase letters
  // Script codes (ISO 15924) are 4 letters
  // We just validate format loosely
  return true;
}

export async function analyzeHreflang(
  url: string,
  checkReturnLinks: boolean = true,
  maxReturnChecks: number = 10,
): Promise<HreflangAnalysis> {
  logger.info(`Analyzing hreflang: ${url}`);

  const response = await httpGet(url);
  const $ = parseHtml(response.body);
  const issues: SeoIssue[] = [];

  // Extract hreflang tags from <link> elements
  const tags: HreflangTag[] = [];
  $('link[rel="alternate"][hreflang]').each((_, el) => {
    const hreflang = $(el).attr('hreflang')?.trim() || '';
    const href = $(el).attr('href')?.trim() || '';
    if (hreflang && href) {
      tags.push({ hreflang, href });
    }
  });

  // Also check HTTP headers for Link header hreflang
  const linkHeader = response.headers['link'];
  if (linkHeader) {
    const linkParts = linkHeader.split(',');
    for (const part of linkParts) {
      const urlMatch = part.match(/<([^>]+)>/);
      const hreflangMatch = part.match(/hreflang="?([^";,\s]+)"?/);
      if (urlMatch && hreflangMatch) {
        tags.push({ hreflang: hreflangMatch[1], href: urlMatch[1] });
      }
    }
  }

  if (tags.length === 0) {
    return {
      url,
      tags: [],
      hasXDefault: false,
      hasSelfReferencing: false,
      languageCodes: [],
      issues: [{ type: 'hreflang', severity: 'low', detail: 'No hreflang tags found. If this site has multiple language versions, hreflang tags should be added.' }],
      returnLinkChecks: [],
      score: 100, // Not having hreflang isn't an error for single-language sites
    };
  }

  const languageCodes = tags.map(t => t.hreflang);
  const hasXDefault = languageCodes.includes('x-default');
  const hasSelfReferencing = tags.some(t => {
    try {
      return new URL(t.href).href === new URL(url).href;
    } catch {
      return false;
    }
  });

  // Validate language codes
  for (const tag of tags) {
    if (!isValidHreflangCode(tag.hreflang)) {
      issues.push({
        type: 'hreflang',
        severity: 'high',
        detail: `Invalid hreflang code "${tag.hreflang}". Must be ISO 639-1 language code, optionally with ISO 3166-1 region.`,
      });
    }
  }

  // Check for x-default
  if (!hasXDefault) {
    issues.push({
      type: 'hreflang',
      severity: 'medium',
      detail: 'Missing x-default hreflang tag. This specifies the default page for users whose language is not targeted.',
    });
  }

  // Check for self-referencing
  if (!hasSelfReferencing) {
    issues.push({
      type: 'hreflang',
      severity: 'high',
      detail: 'No self-referencing hreflang tag found. Each page should include a hreflang tag pointing to itself.',
    });
  }

  // Check for duplicate language codes
  const codeCounts = new Map<string, number>();
  for (const code of languageCodes) {
    codeCounts.set(code, (codeCounts.get(code) || 0) + 1);
  }
  for (const [code, count] of codeCounts) {
    if (count > 1) {
      issues.push({
        type: 'hreflang',
        severity: 'high',
        detail: `Duplicate hreflang code "${code}" found ${count} times.`,
      });
    }
  }

  // Check return links (verify that target pages link back)
  const returnLinkChecks: HreflangReturnCheck[] = [];
  if (checkReturnLinks) {
    const tagsToCheck = tags
      .filter(t => {
        try { return new URL(t.href).href !== new URL(url).href; }
        catch { return false; }
      })
      .slice(0, maxReturnChecks);

    const results = await Promise.allSettled(
      tagsToCheck.map(async (tag) => {
        try {
          const targetResponse = await httpGet(tag.href, { timeout: 10000 });
          const target$ = parseHtml(targetResponse.body);
          let hasReturn = false;
          let returnHreflang: string | null = null;

          target$('link[rel="alternate"][hreflang]').each((_, el) => {
            const href = target$(el).attr('href')?.trim() || '';
            try {
              if (new URL(href).href === new URL(url).href) {
                hasReturn = true;
                returnHreflang = target$(el).attr('hreflang')?.trim() || null;
              }
            } catch { /* invalid URL */ }
          });

          return {
            sourceUrl: url,
            sourceHreflang: tag.hreflang,
            targetUrl: tag.href,
            hasReturnLink: hasReturn,
            returnHreflang,
          };
        } catch {
          return {
            sourceUrl: url,
            sourceHreflang: tag.hreflang,
            targetUrl: tag.href,
            hasReturnLink: false,
            returnHreflang: null,
          };
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'fulfilled') {
        returnLinkChecks.push(result.value);
        if (!result.value.hasReturnLink) {
          issues.push({
            type: 'hreflang',
            severity: 'high',
            detail: `Missing return link: ${result.value.targetUrl} (hreflang="${result.value.sourceHreflang}") does not link back to ${url}.`,
          });
        }
      }
    }
  }

  // Score
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === 'critical') score -= 25;
    else if (issue.severity === 'high') score -= 15;
    else if (issue.severity === 'medium') score -= 8;
    else score -= 3;
  }
  score = Math.max(0, score);

  logger.info(`Hreflang analysis complete: ${url} (${tags.length} tags, score: ${score})`);

  return {
    url,
    tags,
    hasXDefault,
    hasSelfReferencing,
    languageCodes: [...new Set(languageCodes)],
    issues,
    returnLinkChecks,
    score,
  };
}
