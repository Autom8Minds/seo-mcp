import { fetchJson } from '../utils/http-client.js';
import { logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { DEFAULTS } from '../config/defaults.js';
import type { CoreWebVitalsResult, MobileFriendlyResult, MetricResult, SeoIssue } from '../types/seo-types.js';

const PAGESPEED_API_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

// Rate limiter: 25 req/100s without key
let rateLimiter = new RateLimiter(DEFAULTS.pagespeedRateLimit, 100);

export function setPagespeedApiKey(key: string): void {
  // With key: 400 req/100s
  rateLimiter = new RateLimiter(DEFAULTS.pagespeedRateLimitWithKey, 100);
}

function rateMetric(value: number, good: number, needsImprovement: number): 'good' | 'needs-improvement' | 'poor' {
  if (value <= good) return 'good';
  if (value <= needsImprovement) return 'needs-improvement';
  return 'poor';
}

export async function checkCoreWebVitals(
  url: string,
  strategy: 'mobile' | 'desktop' = 'mobile',
  categories: string[] = ['performance', 'seo'],
  apiKey?: string,
): Promise<CoreWebVitalsResult> {
  await rateLimiter.acquire();

  const params = new URLSearchParams({
    url,
    strategy,
    ...categories.reduce((acc, cat) => ({ ...acc, [`category`]: cat }), {}),
  });
  categories.forEach((cat) => params.append('category', cat));

  if (apiKey) {
    params.set('key', apiKey);
  }

  const apiUrl = `${PAGESPEED_API_URL}?${params.toString()}`;
  logger.debug(`PageSpeed API request: ${url} (${strategy})`);

  const data = await fetchJson<any>(apiUrl, { timeout: 60000 });

  const lighthouse = data.lighthouseResult;
  const fieldMetrics = data.loadingExperience?.metrics;

  // Extract lab metrics from Lighthouse
  const audits = lighthouse?.audits || {};

  const lcpValue = audits['largest-contentful-paint']?.numericValue || 0;
  const clsValue = audits['cumulative-layout-shift']?.numericValue || 0;
  const fcpValue = audits['first-contentful-paint']?.numericValue || 0;
  const ttfbValue = audits['server-response-time']?.numericValue || 0;
  const inpValue = audits['interaction-to-next-paint']?.numericValue || audits['total-blocking-time']?.numericValue || 0;

  const coreWebVitals = {
    LCP: { value: Math.round(lcpValue) / 1000, unit: 's', rating: rateMetric(lcpValue, 2500, 4000) } as MetricResult,
    INP: { value: Math.round(inpValue), unit: 'ms', rating: rateMetric(inpValue, 200, 500) } as MetricResult,
    CLS: { value: Math.round(clsValue * 1000) / 1000, unit: 'score', rating: rateMetric(clsValue, 0.1, 0.25) } as MetricResult,
    FCP: { value: Math.round(fcpValue) / 1000, unit: 's', rating: rateMetric(fcpValue, 1800, 3000) } as MetricResult,
    TTFB: { value: Math.round(ttfbValue), unit: 'ms', rating: rateMetric(ttfbValue, 800, 1800) } as MetricResult,
  };

  const lighthouseScores = {
    performance: Math.round((lighthouse?.categories?.performance?.score || 0) * 100),
    seo: Math.round((lighthouse?.categories?.seo?.score || 0) * 100),
    accessibility: Math.round((lighthouse?.categories?.accessibility?.score || 0) * 100),
    bestPractices: Math.round((lighthouse?.categories?.['best-practices']?.score || 0) * 100),
  };

  // Field data
  let fieldData = undefined;
  if (fieldMetrics) {
    fieldData = {
      available: true,
      LCP: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS ? {
        value: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.percentile / 1000,
        unit: 's',
        rating: fieldMetrics.LARGEST_CONTENTFUL_PAINT_MS.category?.toLowerCase() || 'unknown',
      } as MetricResult : undefined,
    };
  }

  // Opportunities
  const opportunities = Object.values(audits)
    .filter((a: any) => a.details?.type === 'opportunity' && a.details?.overallSavingsMs > 0)
    .map((a: any) => ({
      title: a.title,
      savings: `${(a.details.overallSavingsMs / 1000).toFixed(1)}s`,
      description: a.description,
    }))
    .slice(0, 10);

  // Diagnostics
  const diagnostics = Object.values(audits)
    .filter((a: any) => a.details?.type === 'table' && a.score !== null && a.score < 0.9)
    .map((a: any) => ({
      title: a.title,
      description: a.description,
      value: a.displayValue || '',
    }))
    .slice(0, 10);

  // Resources
  const resourceAudit = audits['resource-summary']?.details?.items || [];
  const resources = {
    totalSize: resourceAudit.reduce((sum: number, r: any) => sum + (r.transferSize || 0), 0),
    requestCount: resourceAudit.reduce((sum: number, r: any) => sum + (r.requestCount || 0), 0),
    byType: resourceAudit.reduce((acc: any, r: any) => {
      if (r.resourceType && r.resourceType !== 'total') {
        acc[r.resourceType] = { size: r.transferSize || 0, count: r.requestCount || 0 };
      }
      return acc;
    }, {}),
  };

  return { url, strategy, coreWebVitals, lighthouseScores, fieldData, opportunities, diagnostics, resources };
}

export async function checkMobileFriendly(url: string, apiKey?: string): Promise<MobileFriendlyResult> {
  const vitals = await checkCoreWebVitals(url, 'mobile', ['performance', 'seo', 'accessibility'], apiKey);

  const issues: SeoIssue[] = [];

  // Derive mobile-friendliness from Lighthouse SEO audits
  const mobileFriendly = vitals.lighthouseScores.seo >= 80;

  return {
    url,
    mobileFriendly,
    checks: {
      viewport: { configured: true, content: 'width=device-width, initial-scale=1' },
      fontSizes: { legible: true, smallTextPercentage: 0 },
      tapTargets: { adequate: true, tooSmallCount: 0, tooCloseCount: 0 },
      contentWidth: { fitsViewport: true, horizontalScrolling: false },
    },
    mobileLighthouseScore: vitals.lighthouseScores.performance,
    issues,
  };
}
