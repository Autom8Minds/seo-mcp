import { httpGet } from '../utils/http-client.js';
import { ensureProtocol } from '../utils/url-validator.js';
import { logger } from '../utils/logger.js';
import type { RobotsTxtAnalysis, RobotsTxtRule, SeoIssue } from '../types/seo-types.js';

const IMPORTANT_PATHS = ['/', '/sitemap.xml', '/robots.txt'];
const CRITICAL_DISALLOW_PATTERNS = ['/', '/*', '/wp-admin', '/api'];

interface ParsedDirectives {
  rules: RobotsTxtRule[];
  sitemaps: string[];
}

function parseRobotsTxt(content: string): ParsedDirectives {
  const lines = content.split('\n').map(line => line.trim());
  const rules: RobotsTxtRule[] = [];
  const sitemaps: string[] = [];
  let currentRule: RobotsTxtRule | null = null;

  for (const line of lines) {
    if (!line || line.startsWith('#')) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const directive = line.substring(0, colonIndex).trim().toLowerCase();
    const value = line.substring(colonIndex + 1).trim();

    if (directive === 'user-agent') {
      if (currentRule) {
        rules.push(currentRule);
      }
      currentRule = { userAgent: value, allow: [], disallow: [] };
    } else if (directive === 'allow' && currentRule) {
      currentRule.allow.push(value);
    } else if (directive === 'disallow' && currentRule) {
      currentRule.disallow.push(value);
    } else if (directive === 'sitemap') {
      sitemaps.push(value);
    }
  }

  if (currentRule) {
    rules.push(currentRule);
  }

  return { rules, sitemaps };
}

function testPathAgainstRules(
  path: string,
  rules: RobotsTxtRule[],
  userAgent: string,
): { allowed: boolean; matchingRule: string | null } {
  const applicableRules = rules.filter(
    r => r.userAgent === '*' || r.userAgent.toLowerCase() === userAgent.toLowerCase(),
  );

  if (applicableRules.length === 0) {
    return { allowed: true, matchingRule: null };
  }

  let bestMatch: { allowed: boolean; rule: string; length: number } | null = null;

  for (const rule of applicableRules) {
    for (const disallow of rule.disallow) {
      if (disallow === '') continue;
      if (pathMatches(path, disallow)) {
        if (!bestMatch || disallow.length > bestMatch.length) {
          bestMatch = { allowed: false, rule: `Disallow: ${disallow}`, length: disallow.length };
        }
      }
    }

    for (const allow of rule.allow) {
      if (pathMatches(path, allow)) {
        if (!bestMatch || allow.length >= bestMatch.length) {
          bestMatch = { allowed: true, rule: `Allow: ${allow}`, length: allow.length };
        }
      }
    }
  }

  return {
    allowed: bestMatch ? bestMatch.allowed : true,
    matchingRule: bestMatch ? bestMatch.rule : null,
  };
}

function pathMatches(path: string, pattern: string): boolean {
  if (pattern.endsWith('$')) {
    const cleanPattern = pattern.slice(0, -1);
    return path === cleanPattern;
  }

  if (pattern.includes('*')) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*'));
    return regex.test(path);
  }

  return path.startsWith(pattern);
}

function identifyIssues(
  rules: RobotsTxtRule[],
  sitemaps: string[],
  content: string,
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  if (sitemaps.length === 0) {
    issues.push({
      type: 'missing_sitemap_reference',
      severity: 'medium',
      detail: 'No Sitemap directive found in robots.txt',
    });
  }

  const wildcardRules = rules.filter(r => r.userAgent === '*');
  for (const rule of wildcardRules) {
    for (const disallow of rule.disallow) {
      if (disallow === '/') {
        issues.push({
          type: 'blocks_all_crawling',
          severity: 'critical',
          detail: 'Disallow: / blocks all crawlers with wildcard user-agent',
        });
      }
      if (disallow === '/*') {
        issues.push({
          type: 'blocks_all_crawling',
          severity: 'critical',
          detail: 'Disallow: /* blocks all paths for wildcard user-agent',
        });
      }
    }
  }

  for (const rule of rules) {
    for (const disallow of rule.disallow) {
      if (disallow === '/wp-admin/' || disallow === '/admin/') continue;

      if (CRITICAL_DISALLOW_PATTERNS.includes(disallow) && rule.userAgent !== '*') {
        issues.push({
          type: 'blocks_specific_bot',
          severity: 'high',
          detail: `${rule.userAgent} is blocked from "${disallow}"`,
        });
      }
    }
  }

  if (rules.length === 0 && content.trim().length > 0) {
    issues.push({
      type: 'no_rules_defined',
      severity: 'low',
      detail: 'robots.txt exists but contains no User-agent directives',
    });
  }

  const contentLength = Buffer.byteLength(content, 'utf-8');
  if (contentLength > 500 * 1024) {
    issues.push({
      type: 'file_too_large',
      severity: 'medium',
      detail: `robots.txt is ${Math.round(contentLength / 1024)}KB (recommended < 500KB)`,
    });
  }

  return issues;
}

export async function analyzeRobotsTxt(
  domain: string,
  testPath?: string,
  userAgent = '*',
): Promise<RobotsTxtAnalysis> {
  const baseUrl = ensureProtocol(domain);
  const robotsUrl = new URL('/robots.txt', baseUrl).href;

  logger.info(`Analyzing robots.txt: ${robotsUrl}`);

  let exists = false;
  let content = '';
  let rules: RobotsTxtRule[] = [];
  let sitemaps: string[] = [];

  try {
    const response = await httpGet(robotsUrl);

    if (response.status === 200 && response.body.trim().length > 0) {
      exists = true;
      content = response.body;
      const parsed = parseRobotsTxt(content);
      rules = parsed.rules;
      sitemaps = parsed.sitemaps;
    }
  } catch (error) {
    logger.warn(`Failed to fetch robots.txt: ${(error as Error).message}`);
  }

  const issues = exists ? identifyIssues(rules, sitemaps, content) : [
    {
      type: 'missing_robots_txt',
      severity: 'medium' as const,
      detail: 'No robots.txt file found at ' + robotsUrl,
    },
  ];

  let testResult: RobotsTxtAnalysis['testResult'];
  if (testPath && exists) {
    const result = testPathAgainstRules(testPath, rules, userAgent);
    testResult = {
      path: testPath,
      userAgent,
      allowed: result.allowed,
      matchingRule: result.matchingRule,
    };
  }

  logger.info(`robots.txt analysis complete: ${rules.length} rules, ${sitemaps.length} sitemaps`);

  return {
    exists,
    content,
    rules,
    sitemaps,
    testResult,
    issues,
  };
}
