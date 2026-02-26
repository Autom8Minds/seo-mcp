import { httpGet, httpHead } from '../utils/http-client.js';
import { parseSitemapXml, isValidSitemapXml } from '../utils/xml-parser.js';
import { ensureProtocol, isValidUrl } from '../utils/url-validator.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import { DEFAULTS } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import type { SitemapAnalysis, SeoIssue } from '../types/seo-types.js';

function computeLastmodDistribution(lastmods: (string | undefined)[]): SitemapAnalysis['lastmodDistribution'] {
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

  const distribution = { thisWeek: 0, thisMonth: 0, thisYear: 0, older: 0, missing: 0 };

  for (const lastmod of lastmods) {
    if (!lastmod) {
      distribution.missing++;
      continue;
    }

    const date = new Date(lastmod);
    if (isNaN(date.getTime())) {
      distribution.missing++;
      continue;
    }

    if (date >= oneWeekAgo) {
      distribution.thisWeek++;
    } else if (date >= oneMonthAgo) {
      distribution.thisMonth++;
    } else if (date >= oneYearAgo) {
      distribution.thisYear++;
    } else {
      distribution.older++;
    }
  }

  return distribution;
}

function identifyIssues(
  type: 'urlset' | 'sitemapindex',
  urlCount: number,
  distribution: SitemapAnalysis['lastmodDistribution'],
  urls: string[],
): SeoIssue[] {
  const issues: SeoIssue[] = [];

  if (type === 'urlset' && urlCount > SEO_RULES.sitemap.maxUrlsPerFile) {
    issues.push({
      type: 'too_many_urls',
      severity: 'high',
      detail: `Sitemap contains ${urlCount} URLs (maximum ${SEO_RULES.sitemap.maxUrlsPerFile} per file)`,
    });
  }

  if (urlCount === 0) {
    issues.push({
      type: 'empty_sitemap',
      severity: 'high',
      detail: 'Sitemap contains no URLs',
    });
  }

  if (distribution.missing > 0 && urlCount > 0) {
    const missingPct = Math.round((distribution.missing / urlCount) * 100);
    if (missingPct > 50) {
      issues.push({
        type: 'missing_lastmod',
        severity: 'medium',
        detail: `${missingPct}% of URLs are missing lastmod dates`,
      });
    }
  }

  if (urlCount > 0 && distribution.older > urlCount * 0.5) {
    issues.push({
      type: 'stale_urls',
      severity: 'medium',
      detail: `${Math.round((distribution.older / urlCount) * 100)}% of URLs have lastmod dates older than 1 year`,
    });
  }

  if (distribution.thisWeek === 0 && distribution.thisMonth === 0 && urlCount > 0 && distribution.missing < urlCount) {
    issues.push({
      type: 'no_recent_updates',
      severity: 'low',
      detail: 'No URLs have been updated in the last month',
    });
  }

  const invalidUrls = urls.filter(u => !isValidUrl(u));
  if (invalidUrls.length > 0) {
    issues.push({
      type: 'invalid_urls',
      severity: 'high',
      detail: `${invalidUrls.length} invalid URL(s) found in sitemap`,
    });
  }

  return issues;
}

async function checkUrlSample(
  urls: string[],
  sampleSize: number,
): Promise<{ url: string; statusCode: number }[]> {
  const step = Math.max(1, Math.floor(urls.length / sampleSize));
  const sample: string[] = [];

  for (let i = 0; i < urls.length && sample.length < sampleSize; i += step) {
    sample.push(urls[i]);
  }

  const results = await Promise.allSettled(
    sample.map(async (url) => {
      try {
        const response = await httpHead(url, { timeout: 5000, followRedirects: true });
        return { url, statusCode: response.status };
      } catch {
        return { url, statusCode: 0 };
      }
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ url: string; statusCode: number }> =>
      r.status === 'fulfilled',
    )
    .map(r => r.value);
}

export async function analyzeSitemap(
  url: string,
  maxUrls: number = DEFAULTS.maxSitemapUrls,
  checkUrls: boolean = false,
): Promise<SitemapAnalysis> {
  let sitemapUrl = url;

  if (!url.includes('/') || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    sitemapUrl = new URL('/sitemap.xml', ensureProtocol(url)).href;
  }

  logger.info(`Analyzing sitemap: ${sitemapUrl}`);

  const response = await httpGet(sitemapUrl);

  if (response.status !== 200) {
    throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
  }

  if (!isValidSitemapXml(response.body)) {
    throw new Error('Response is not valid sitemap XML');
  }

  const parsed = parseSitemapXml(response.body);

  let urls: string[] = [];
  let lastmods: (string | undefined)[] = [];

  if (parsed.type === 'urlset') {
    const limited = parsed.urls.slice(0, maxUrls);
    urls = limited.map(u => u.loc);
    lastmods = limited.map(u => u.lastmod);
  } else {
    urls = parsed.sitemaps.map(s => s.loc);
    lastmods = parsed.sitemaps.map(s => s.lastmod);
  }

  const urlCount = parsed.type === 'urlset' ? parsed.urls.length : parsed.sitemaps.length;
  const distribution = computeLastmodDistribution(lastmods);
  const issues = identifyIssues(parsed.type, urlCount, distribution, urls);

  let urlCheck: SitemapAnalysis['urlCheck'];
  if (checkUrls && urls.length > 0) {
    const sampleSize = Math.min(20, urls.length);
    urlCheck = await checkUrlSample(urls, sampleSize);

    const brokenCount = urlCheck.filter(r => r.statusCode >= 400 || r.statusCode === 0).length;
    if (brokenCount > 0) {
      issues.push({
        type: 'broken_urls_in_sitemap',
        severity: 'high',
        detail: `${brokenCount} of ${urlCheck.length} sampled URLs returned errors`,
      });
    }
  }

  logger.info(`Sitemap analysis complete: ${urlCount} URLs, type=${parsed.type}`);

  return {
    type: parsed.type,
    urlCount,
    urls: urls.slice(0, maxUrls),
    lastmodDistribution: distribution,
    issues,
    urlCheck,
  };
}
