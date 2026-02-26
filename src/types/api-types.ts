/** Third-party API response types */

/** DataForSEO keyword data */
export interface KeywordData {
  keyword: string;
  searchVolume: number;
  keywordDifficulty: number;
  cpc: number;
  competition: number;
  trend: number[];
  serpFeatures: string[];
}

export interface KeywordResearchResult {
  keywords: KeywordData[];
  relatedKeywords?: KeywordData[];
}

/** DataForSEO SERP data */
export interface SerpResult {
  position: number;
  url: string;
  title: string;
  description: string;
  domain: string;
}

export interface SerpAnalysis {
  results: SerpResult[];
  serpFeatures: string[];
  featuredSnippet?: { content: string; url: string };
  paaQuestions?: string[];
  estimatedIntent: string;
}

/** Backlink data */
export interface BacklinkInfo {
  sourceUrl: string;
  sourceDomain: string;
  sourceDomainAuthority: number;
  anchorText: string;
  isFollow: boolean;
  firstSeen: string;
  lastSeen: string;
}

export interface BacklinkAnalysis {
  summary: {
    totalBacklinks: number;
    referringDomains: number;
    domainAuthority: number;
    followRatio: number;
  };
  topBacklinks: BacklinkInfo[];
  anchorDistribution: {
    branded: number;
    exactMatch: number;
    partialMatch: number;
    generic: number;
    url: number;
  };
  referringDomainTiers: {
    high: number;
    medium: number;
    low: number;
  };
}

/** Domain authority */
export interface DomainAuthorityResult {
  domain: string;
  domainAuthority: number;
  backlinks: number;
  referringDomains: number;
  organicKeywords?: number;
  organicTraffic?: number;
  spamScore?: number;
}

/** Google Search Console */
export interface GscPerformanceRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GscPerformanceResult {
  rows: GscPerformanceRow[];
  totals: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  dateRange: { start: string; end: string };
}

export interface GscIndexCoverageResult {
  valid: number;
  warning: number;
  error: number;
  excluded: number;
  urlInspection?: {
    indexStatus: string;
    crawlStatus: string;
    canonical: string;
    mobileUsability: string;
  };
}

export interface GscSitemapResult {
  sitemaps: {
    url: string;
    type: string;
    lastSubmitted: string;
    lastDownloaded: string;
    isPending: boolean;
    isSitemapIndex: boolean;
    warnings: number;
    errors: number;
    urlCount: number;
  }[];
}

/** Meta suggestions */
export interface MetaSuggestions {
  current: {
    title: string | null;
    description: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
  };
  issues: string[];
  suggestions: {
    title: { text: string; length: number; keywordPosition: number; improvement: string };
    metaDescription: { text: string; length: number; improvement: string };
    ogTitle: { text: string; improvement: string };
    ogDescription: { text: string; improvement: string };
  };
}
