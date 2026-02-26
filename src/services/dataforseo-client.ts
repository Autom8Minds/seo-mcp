/**
 * DataForSEO API client for keyword research, SERP analysis,
 * backlink analysis, and domain authority checks.
 *
 * All functions require DATAFORSEO_LOGIN and DATAFORSEO_PASSWORD environment variables.
 */

import { loadApiKeys } from '../config/api-keys.js';
import { logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import type {
  KeywordData,
  KeywordResearchResult,
  SerpResult,
  SerpAnalysis,
  BacklinkInfo,
  BacklinkAnalysis,
  DomainAuthorityResult,
} from '../types/api-types.js';

const API_BASE = 'https://api.dataforseo.com/v3';
const rateLimiter = new RateLimiter(5, 1); // 5 req/s

function getAuthHeader(): string {
  const keys = loadApiKeys();
  return 'Basic ' + Buffer.from(`${keys.dataForSeoLogin}:${keys.dataForSeoPassword}`).toString('base64');
}

async function apiPost<T>(endpoint: string, body: unknown[]): Promise<T> {
  await rateLimiter.acquire();

  const url = `${API_BASE}${endpoint}`;
  logger.debug(`DataForSEO POST: ${endpoint}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: getAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`DataForSEO API error: HTTP ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as any;
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error: ${data.status_message || 'Unknown error'}`);
  }

  return data as T;
}

// -- Keyword Research -----------------------------------------------------

interface KeywordOptions {
  location?: string;
  language?: string;
  includeRelated?: boolean;
  limit?: number;
}

export async function researchKeywords(
  keywords: string[],
  options: KeywordOptions = {},
): Promise<KeywordResearchResult> {
  const { location = 'United States', language = 'en', includeRelated = false, limit = 10 } = options;

  const body = [
    {
      keywords,
      location_name: location,
      language_code: language,
    },
  ];

  const data = await apiPost<any>('/keywords_data/google_ads/search_volume/live', body);

  const results: KeywordData[] = [];
  const tasks = data.tasks || [];

  for (const task of tasks) {
    for (const item of task.result || []) {
      results.push({
        keyword: item.keyword || '',
        searchVolume: item.search_volume || 0,
        keywordDifficulty: item.keyword_info?.keyword_difficulty || 0,
        cpc: item.cpc || 0,
        competition: item.competition || 0,
        trend: (item.monthly_searches || []).map((m: any) => m.search_volume || 0),
        serpFeatures: [],
      });
    }
  }

  let relatedKeywords: KeywordData[] | undefined;

  if (includeRelated && keywords.length > 0) {
    try {
      const relatedBody = [
        {
          keyword: keywords[0],
          location_name: location,
          language_code: language,
          limit,
        },
      ];

      const relatedData = await apiPost<any>('/keywords_data/google_ads/keywords_for_keywords/live', relatedBody);

      relatedKeywords = [];
      for (const task of relatedData.tasks || []) {
        for (const item of (task.result || []).slice(0, limit)) {
          relatedKeywords.push({
            keyword: item.keyword || '',
            searchVolume: item.search_volume || 0,
            keywordDifficulty: item.keyword_info?.keyword_difficulty || 0,
            cpc: item.cpc || 0,
            competition: item.competition || 0,
            trend: (item.monthly_searches || []).map((m: any) => m.search_volume || 0),
            serpFeatures: [],
          });
        }
      }
    } catch (err) {
      logger.warn('Failed to fetch related keywords:', err);
    }
  }

  return { keywords: results, relatedKeywords };
}

// -- SERP Analysis --------------------------------------------------------

interface SerpOptions {
  location?: string;
  device?: 'desktop' | 'mobile';
  depth?: number;
}

export async function analyzeSerpResults(
  keyword: string,
  options: SerpOptions = {},
): Promise<SerpAnalysis> {
  const { location = 'United States', device = 'desktop', depth = 10 } = options;

  const body = [
    {
      keyword,
      location_name: location,
      device,
      depth,
    },
  ];

  const data = await apiPost<any>('/serp/google/organic/live/regular', body);

  const results: SerpResult[] = [];
  const serpFeatures: string[] = [];
  let featuredSnippet: { content: string; url: string } | undefined;
  const paaQuestions: string[] = [];

  for (const task of data.tasks || []) {
    for (const item of task.result?.[0]?.items || []) {
      if (item.type === 'organic') {
        results.push({
          position: item.rank_absolute || 0,
          url: item.url || '',
          title: item.title || '',
          description: item.description || '',
          domain: item.domain || '',
        });
      } else if (item.type === 'featured_snippet') {
        featuredSnippet = {
          content: item.description || item.title || '',
          url: item.url || '',
        };
        serpFeatures.push('featured_snippet');
      } else if (item.type === 'people_also_ask') {
        for (const q of item.items || []) {
          paaQuestions.push(q.title || q.question || '');
        }
        serpFeatures.push('people_also_ask');
      } else if (item.type === 'local_pack') {
        serpFeatures.push('local_pack');
      } else if (item.type === 'knowledge_graph') {
        serpFeatures.push('knowledge_graph');
      } else if (item.type === 'video') {
        serpFeatures.push('video');
      } else if (item.type === 'images') {
        serpFeatures.push('images');
      }
    }
  }

  const estimatedIntent = inferSearchIntent(keyword, results, serpFeatures);

  return { results: results.slice(0, depth), serpFeatures: [...new Set(serpFeatures)], featuredSnippet, paaQuestions, estimatedIntent };
}

function inferSearchIntent(keyword: string, _results: SerpResult[], features: string[]): string {
  const kw = keyword.toLowerCase();

  if (/\b(buy|price|cheap|discount|deal|coupon|shop|order|purchase)\b/.test(kw)) return 'transactional';
  if (/\b(best|top|review|vs|compare|alternative)\b/.test(kw)) return 'commercial';
  if (/\b(how|what|why|when|where|who|tutorial|guide|learn)\b/.test(kw)) return 'informational';
  if (/\b(login|sign in|download|app|website|official)\b/.test(kw)) return 'navigational';

  if (features.includes('local_pack')) return 'local';
  if (features.includes('featured_snippet') || features.includes('people_also_ask')) return 'informational';

  return 'informational';
}

// -- Backlink Analysis ----------------------------------------------------

interface BacklinkOptions {
  targetType?: 'url' | 'domain' | 'subdomain';
  limit?: number;
  sortBy?: 'domain_authority' | 'first_seen' | 'last_seen';
  includeAnchors?: boolean;
}

export async function analyzeBacklinks(
  target: string,
  options: BacklinkOptions = {},
): Promise<BacklinkAnalysis> {
  const { targetType = 'domain', limit = 50, includeAnchors = true } = options;

  const body = [
    {
      target,
      mode: targetType === 'url' ? 'as_is' : targetType === 'subdomain' ? 'subdomains' : 'one_per_domain',
      limit,
    },
  ];

  const data = await apiPost<any>('/backlinks/backlinks/live', body);

  const topBacklinks: BacklinkInfo[] = [];
  let totalBacklinks = 0;
  let referringDomains = 0;
  let followCount = 0;
  let nofollowCount = 0;

  for (const task of data.tasks || []) {
    const result = task.result?.[0];
    totalBacklinks = result?.total_count || 0;

    for (const item of result?.items || []) {
      const isFollow = !item.dofollow === false;
      if (isFollow) followCount++;
      else nofollowCount++;

      topBacklinks.push({
        sourceUrl: item.url_from || '',
        sourceDomain: item.domain_from || '',
        sourceDomainAuthority: item.rank || 0,
        anchorText: item.anchor || '',
        isFollow,
        firstSeen: item.first_seen || '',
        lastSeen: item.last_seen || '',
      });
    }
  }

  // Get summary from a separate endpoint
  let domainAuthority = 0;
  try {
    const summaryBody = [{ target, mode: 'as_is' }];
    const summaryData = await apiPost<any>('/backlinks/summary/live', summaryBody);
    const summary = summaryData.tasks?.[0]?.result?.[0];
    referringDomains = summary?.referring_domains || 0;
    domainAuthority = summary?.rank || 0;
  } catch {
    // Use data from backlinks response
  }

  // Anchor distribution
  const anchorDistribution = { branded: 0, exactMatch: 0, partialMatch: 0, generic: 0, url: 0 };
  if (includeAnchors) {
    const targetDomain = target.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    for (const bl of topBacklinks) {
      const anchor = bl.anchorText.toLowerCase();
      if (!anchor || anchor === 'click here' || anchor === 'read more' || anchor === 'learn more') {
        anchorDistribution.generic++;
      } else if (/^https?:\/\//.test(anchor)) {
        anchorDistribution.url++;
      } else if (anchor.includes(targetDomain.split('.')[0])) {
        anchorDistribution.branded++;
      } else {
        anchorDistribution.partialMatch++;
      }
    }
  }

  const total = followCount + nofollowCount;
  const referringDomainTiers = {
    high: topBacklinks.filter((b) => b.sourceDomainAuthority >= 60).length,
    medium: topBacklinks.filter((b) => b.sourceDomainAuthority >= 30 && b.sourceDomainAuthority < 60).length,
    low: topBacklinks.filter((b) => b.sourceDomainAuthority < 30).length,
  };

  return {
    summary: {
      totalBacklinks,
      referringDomains,
      domainAuthority,
      followRatio: total > 0 ? followCount / total : 0,
    },
    topBacklinks,
    anchorDistribution,
    referringDomainTiers,
  };
}

// -- Domain Authority -----------------------------------------------------

export async function analyzeDomainAuthority(domains: string[]): Promise<DomainAuthorityResult[]> {
  const results: DomainAuthorityResult[] = [];

  for (const domain of domains) {
    try {
      const body = [{ target: domain, mode: 'as_is' }];
      const data = await apiPost<any>('/backlinks/summary/live', body);
      const summary = data.tasks?.[0]?.result?.[0];

      results.push({
        domain,
        domainAuthority: summary?.rank || 0,
        backlinks: summary?.backlinks || 0,
        referringDomains: summary?.referring_domains || 0,
        organicKeywords: summary?.organic?.count || undefined,
        organicTraffic: summary?.organic?.etv || undefined,
        spamScore: summary?.spam_score || undefined,
      });
    } catch (err) {
      logger.warn(`Failed to check authority for ${domain}:`, err);
      results.push({
        domain,
        domainAuthority: 0,
        backlinks: 0,
        referringDomains: 0,
      });
    }
  }

  return results;
}
