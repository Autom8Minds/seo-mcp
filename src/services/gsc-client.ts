/**
 * Google Search Console API client.
 *
 * Handles OAuth2 token refresh and provides methods for querying
 * performance data, index coverage, and sitemaps.
 *
 * Requires GSC_CLIENT_ID, GSC_CLIENT_SECRET, and GSC_REFRESH_TOKEN.
 */

import { loadApiKeys } from '../config/api-keys.js';
import { logger } from '../utils/logger.js';
import type {
  GscPerformanceResult,
  GscPerformanceRow,
  GscIndexCoverageResult,
  GscSitemapResult,
} from '../types/api-types.js';

const GSC_API_BASE = 'https://searchconsole.googleapis.com/webmasters/v3';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

let cachedAccessToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const keys = loadApiKeys();
  const params = new URLSearchParams({
    client_id: keys.gscClientId!,
    client_secret: keys.gscClientSecret!,
    refresh_token: keys.gscRefreshToken!,
    grant_type: 'refresh_token',
  });

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`GSC OAuth token refresh failed: HTTP ${response.status}`);
  }

  const data = await response.json() as any;
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;

  return cachedAccessToken!;
}

async function gscFetch<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = await getAccessToken();
  const { method = 'GET', body } = options;

  const response = await fetch(`${GSC_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GSC API error: HTTP ${response.status} - ${text}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return await response.json() as T;
}

// -- Performance ----------------------------------------------------------

interface PerformanceOptions {
  startDate?: string;
  endDate?: string;
  dimensions?: string[];
  filters?: Array<{ dimension: string; operator: string; expression: string }>;
  rowLimit?: number;
}

export async function queryPerformance(
  siteUrl: string,
  options: PerformanceOptions = {},
): Promise<GscPerformanceResult> {
  const {
    dimensions = ['query'],
    rowLimit = 1000,
    filters = [],
  } = options;

  const now = new Date();
  const endDate = options.endDate || now.toISOString().split('T')[0];
  const startDate = options.startDate || new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  logger.info(`GSC performance query: ${siteUrl} [${startDate} to ${endDate}]`);

  const encodedSite = encodeURIComponent(siteUrl);
  const body = {
    startDate,
    endDate,
    dimensions,
    rowLimit: Math.min(rowLimit, 25000),
    dimensionFilterGroups: filters.length > 0
      ? [{ filters: filters.map((f) => ({ dimension: f.dimension, operator: f.operator, expression: f.expression })) }]
      : undefined,
  };

  const data = await gscFetch<any>(
    `/sites/${encodedSite}/searchAnalytics/query`,
    { method: 'POST', body },
  );

  const rows: GscPerformanceRow[] = (data.rows || []).map((r: any) => ({
    keys: r.keys || [],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));

  const totals = rows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
      ctr: 0,
      position: 0,
    }),
    { clicks: 0, impressions: 0, ctr: 0, position: 0 },
  );

  totals.ctr = totals.impressions > 0 ? totals.clicks / totals.impressions : 0;
  const positionSum = rows.reduce((sum, r) => sum + r.position * r.impressions, 0);
  totals.position = totals.impressions > 0 ? positionSum / totals.impressions : 0;

  return { rows, totals, dateRange: { start: startDate, end: endDate } };
}

// -- Index Coverage -------------------------------------------------------

interface IndexCoverageOptions {
  url?: string;
}

export async function getIndexCoverage(
  siteUrl: string,
  options: IndexCoverageOptions = {},
): Promise<GscIndexCoverageResult> {
  const encodedSite = encodeURIComponent(siteUrl);

  if (options.url) {
    logger.info(`GSC URL inspection: ${options.url}`);

    const data = await gscFetch<any>(
      '/urlInspection/index:inspect',
      {
        method: 'POST',
        body: {
          inspectionUrl: options.url,
          siteUrl,
        },
      },
    );

    const result = data.inspectionResult || {};
    const indexResult = result.indexStatusResult || {};
    const mobileResult = result.mobileUsabilityResult || {};

    return {
      valid: 0,
      warning: 0,
      error: 0,
      excluded: 0,
      urlInspection: {
        indexStatus: indexResult.coverageState || indexResult.verdict || 'Unknown',
        crawlStatus: indexResult.crawledAs || 'Unknown',
        canonical: indexResult.googleCanonical || indexResult.userCanonical || '',
        mobileUsability: mobileResult.verdict || 'Unknown',
      },
    };
  }

  // Summary level - GSC API doesn't have a direct endpoint for coverage summary
  // Return a placeholder indicating the user should use URL inspection
  logger.info(`GSC index coverage summary for: ${siteUrl}`);

  return {
    valid: 0,
    warning: 0,
    error: 0,
    excluded: 0,
  };
}

// -- Sitemaps -------------------------------------------------------------

interface SitemapOptions {
  sitemapUrl?: string;
}

export async function manageSitemaps(
  siteUrl: string,
  options: SitemapOptions = {},
): Promise<GscSitemapResult> {
  const encodedSite = encodeURIComponent(siteUrl);

  if (options.sitemapUrl) {
    logger.info(`Submitting sitemap: ${options.sitemapUrl}`);
    const encodedSitemap = encodeURIComponent(options.sitemapUrl);
    await gscFetch(`/sites/${encodedSite}/sitemaps/${encodedSitemap}`, { method: 'PUT' });

    return {
      sitemaps: [
        {
          url: options.sitemapUrl,
          type: 'sitemap',
          lastSubmitted: new Date().toISOString(),
          lastDownloaded: '',
          isPending: true,
          isSitemapIndex: false,
          warnings: 0,
          errors: 0,
          urlCount: 0,
        },
      ],
    };
  }

  logger.info(`Listing sitemaps for: ${siteUrl}`);
  const data = await gscFetch<any>(`/sites/${encodedSite}/sitemaps`);

  const sitemaps = (data.sitemap || []).map((s: any) => ({
    url: s.path || '',
    type: s.type || 'sitemap',
    lastSubmitted: s.lastSubmitted || '',
    lastDownloaded: s.lastDownloaded || '',
    isPending: s.isPending || false,
    isSitemapIndex: s.isSitemapsIndex || false,
    warnings: s.warnings || 0,
    errors: s.errors || 0,
    urlCount: s.contents?.reduce((sum: number, c: any) => sum + (c.submitted || 0), 0) || 0,
  }));

  return { sitemaps };
}
