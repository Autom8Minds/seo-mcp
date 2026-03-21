/**
 * Security headers analyzer.
 *
 * Checks HTTP response headers for security best practices:
 * HSTS, CSP, X-Frame-Options, X-Content-Type-Options,
 * Referrer-Policy, Permissions-Policy, and mixed content.
 */

import { httpGet } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';
import type { SeoIssue } from '../types/seo-types.js';

export interface SecurityHeaderCheck {
  header: string;
  present: boolean;
  value: string | null;
  status: 'pass' | 'warning' | 'fail';
  detail: string;
}

export interface MixedContentItem {
  type: 'script' | 'stylesheet' | 'image' | 'iframe' | 'media' | 'form' | 'other';
  url: string;
  element: string;
}

export interface SecurityAnalysis {
  url: string;
  isHttps: boolean;
  headers: SecurityHeaderCheck[];
  mixedContent: MixedContentItem[];
  score: number;
  issues: SeoIssue[];
}

const SECURITY_HEADERS = [
  {
    name: 'strict-transport-security',
    label: 'Strict-Transport-Security (HSTS)',
    required: true,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'fail', detail: 'Missing HSTS header. Browsers can access the site over insecure HTTP.' };
      const maxAge = parseInt(value.match(/max-age=(\d+)/)?.[1] || '0', 10);
      if (maxAge < 31536000) return { status: 'warning', detail: `HSTS max-age is ${maxAge}s (recommended: 31536000 / 1 year minimum).` };
      const hasIncludeSub = value.includes('includeSubDomains');
      const hasPreload = value.includes('preload');
      if (hasIncludeSub && hasPreload) return { status: 'pass', detail: `HSTS enabled with max-age=${maxAge}, includeSubDomains, and preload.` };
      if (hasIncludeSub) return { status: 'pass', detail: `HSTS enabled with max-age=${maxAge} and includeSubDomains. Consider adding preload.` };
      return { status: 'pass', detail: `HSTS enabled with max-age=${maxAge}. Consider adding includeSubDomains and preload.` };
    },
  },
  {
    name: 'content-security-policy',
    label: 'Content-Security-Policy (CSP)',
    required: true,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'fail', detail: 'Missing CSP header. No protection against XSS and data injection attacks.' };
      const hasDefaultSrc = value.includes('default-src');
      const hasScriptSrc = value.includes('script-src');
      const hasUnsafeInline = value.includes("'unsafe-inline'");
      const hasUnsafeEval = value.includes("'unsafe-eval'");
      if (hasUnsafeInline && hasUnsafeEval) return { status: 'warning', detail: "CSP present but uses 'unsafe-inline' and 'unsafe-eval', weakening protection." };
      if (hasUnsafeInline) return { status: 'warning', detail: "CSP present but uses 'unsafe-inline', weakening XSS protection." };
      if (!hasDefaultSrc && !hasScriptSrc) return { status: 'warning', detail: 'CSP present but missing default-src or script-src directive.' };
      return { status: 'pass', detail: 'Content-Security-Policy is configured.' };
    },
  },
  {
    name: 'x-frame-options',
    label: 'X-Frame-Options',
    required: false,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'warning', detail: 'Missing X-Frame-Options. Site may be vulnerable to clickjacking (CSP frame-ancestors is the modern alternative).' };
      const upper = value.toUpperCase();
      if (upper === 'DENY' || upper === 'SAMEORIGIN') return { status: 'pass', detail: `X-Frame-Options set to ${upper}.` };
      return { status: 'warning', detail: `X-Frame-Options has unusual value: "${value}".` };
    },
  },
  {
    name: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    required: true,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'fail', detail: 'Missing X-Content-Type-Options. Browser may MIME-sniff responses, enabling attacks.' };
      if (value.toLowerCase() === 'nosniff') return { status: 'pass', detail: 'X-Content-Type-Options set to nosniff.' };
      return { status: 'warning', detail: `X-Content-Type-Options has unexpected value: "${value}".` };
    },
  },
  {
    name: 'referrer-policy',
    label: 'Referrer-Policy',
    required: false,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'warning', detail: 'Missing Referrer-Policy. Browser uses default policy which may leak URL information.' };
      const safe = ['no-referrer', 'strict-origin', 'strict-origin-when-cross-origin', 'same-origin', 'no-referrer-when-downgrade', 'origin', 'origin-when-cross-origin'];
      if (safe.includes(value.toLowerCase())) return { status: 'pass', detail: `Referrer-Policy set to ${value}.` };
      if (value.toLowerCase() === 'unsafe-url') return { status: 'warning', detail: 'Referrer-Policy set to unsafe-url, which leaks full URL to all origins.' };
      return { status: 'pass', detail: `Referrer-Policy set to ${value}.` };
    },
  },
  {
    name: 'permissions-policy',
    label: 'Permissions-Policy',
    required: false,
    validate: (value: string | null): { status: 'pass' | 'warning' | 'fail'; detail: string } => {
      if (!value) return { status: 'warning', detail: 'Missing Permissions-Policy. Browser features like camera, microphone, geolocation are not restricted.' };
      return { status: 'pass', detail: 'Permissions-Policy is configured.' };
    },
  },
];

function detectMixedContent(html: string, pageUrl: string): MixedContentItem[] {
  if (!pageUrl.startsWith('https://')) return [];

  const $ = parseHtml(html);
  const mixed: MixedContentItem[] = [];

  // Scripts
  $('script[src^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'script', url: $(el).attr('src')!, element: 'script' });
  });

  // Stylesheets
  $('link[rel="stylesheet"][href^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'stylesheet', url: $(el).attr('href')!, element: 'link' });
  });

  // Images
  $('img[src^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'image', url: $(el).attr('src')!, element: 'img' });
  });

  // Iframes
  $('iframe[src^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'iframe', url: $(el).attr('src')!, element: 'iframe' });
  });

  // Audio/Video
  $('audio[src^="http://"], video[src^="http://"], source[src^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'media', url: $(el).attr('src')!, element: $(el).prop('tagName')?.toLowerCase() || 'media' });
  });

  // Forms with HTTP action
  $('form[action^="http://"]').each((_: number, el: any) => {
    mixed.push({ type: 'form', url: $(el).attr('action')!, element: 'form' });
  });

  return mixed;
}

export async function analyzeSecurityHeaders(
  url: string,
  checkMixedContent: boolean = true,
): Promise<SecurityAnalysis> {
  logger.info(`Analyzing security headers: ${url}`);

  const response = await httpGet(url);
  const isHttps = url.startsWith('https://');

  const headers: SecurityHeaderCheck[] = SECURITY_HEADERS.map((def) => {
    const value = response.headers[def.name] || null;
    const { status, detail } = def.validate(value);
    return {
      header: def.label,
      present: value !== null,
      value,
      status,
      detail,
    };
  });

  const mixedContent = checkMixedContent ? detectMixedContent(response.body, url) : [];

  const issues: SeoIssue[] = [];

  if (!isHttps) {
    issues.push({ type: 'security', severity: 'critical', detail: 'Site is not served over HTTPS.' });
  }

  for (const check of headers) {
    if (check.status === 'fail') {
      issues.push({ type: 'security', severity: 'high', detail: check.detail });
    } else if (check.status === 'warning') {
      issues.push({ type: 'security', severity: 'medium', detail: check.detail });
    }
  }

  if (mixedContent.length > 0) {
    issues.push({
      type: 'security',
      severity: 'high',
      detail: `${mixedContent.length} mixed content resource(s) found (HTTP resources on HTTPS page).`,
    });
  }

  // Score: start at 100, deduct for issues
  let score = 100;
  if (!isHttps) score -= 30;
  for (const check of headers) {
    if (check.status === 'fail') score -= 12;
    else if (check.status === 'warning') score -= 5;
  }
  if (mixedContent.length > 0) score -= Math.min(20, mixedContent.length * 5);
  score = Math.max(0, score);

  logger.info(`Security analysis complete: ${url} (score: ${score})`);

  return {
    url,
    isHttps,
    headers,
    mixedContent,
    score,
    issues,
  };
}
