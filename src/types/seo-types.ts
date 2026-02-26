/** Core SEO analysis types */

export interface PageAnalysis {
  url: string;
  statusCode: number;
  redirectChain: string[];
  responseTime: number;
  title: TitleAnalysis;
  metaDescription: MetaDescriptionAnalysis;
  canonical: CanonicalAnalysis;
  robots: RobotsAnalysis;
  openGraph: OpenGraphAnalysis;
  headings: HeadingSummary;
  images: ImageSummary;
  links: LinkSummary;
  content?: ContentAnalysis;
  score: SeoScore;
}

export interface TitleAnalysis {
  text: string | null;
  length: number;
  issues: string[];
}

export interface MetaDescriptionAnalysis {
  text: string | null;
  length: number;
  issues: string[];
}

export interface CanonicalAnalysis {
  url: string | null;
  isSelfReferencing: boolean;
  issues: string[];
}

export interface RobotsAnalysis {
  meta: string | null;
  xRobotsTag: string | null;
  isIndexable: boolean;
}

export interface OpenGraphAnalysis {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
  type: string | null;
  issues: string[];
}

export interface HeadingSummary {
  h1Count: number;
  h1Text: string[];
  totalHeadings: number;
  issues: string[];
}

export interface ImageSummary {
  total: number;
  missingAlt: number;
  issues: string[];
}

export interface LinkSummary {
  internal: number;
  external: number;
  nofollow: number;
}

export interface ContentAnalysis {
  wordCount: number;
  readabilityScore: number;
}

export interface SeoScore {
  overall: number;
  breakdown: {
    title: number;
    meta: number;
    headings: number;
    images: number;
    links: number;
    technical: number;
  };
}

/** Heading analysis */
export interface HeadingNode {
  tag: string;
  text: string;
  order: number;
  children?: HeadingNode[];
}

export interface HeadingAnalysis {
  headingTree: HeadingNode[];
  flatList: { tag: string; text: string; order: number }[];
  counts: Record<string, number>;
  keywordPresence?: {
    inH1: boolean;
    inH2: string[];
    count: number;
  };
  issues: SeoIssue[];
}

/** Image analysis */
export interface ImageInfo {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  format: string;
  fileSize?: number;
  filenameQuality: 'good' | 'generic';
}

export interface ImageAnalysis {
  images: ImageInfo[];
  summary: {
    total: number;
    missingAlt: number;
    emptyAlt: number;
    oversized: number;
    nonModernFormat: number;
    missingDimensions: number;
    missingLazyLoad: number;
    score: number;
  };
}

/** Link analysis */
export interface LinkInfo {
  url: string;
  anchor: string;
  nofollow: boolean;
  position: 'nav' | 'content' | 'footer' | 'sidebar' | 'other';
  rel?: string;
  statusCode?: number;
}

export interface LinkAnalysis {
  internal: LinkInfo[];
  external: LinkInfo[];
  broken: LinkInfo[];
  anchorTextAnalysis: {
    descriptive: number;
    generic: number;
    url: number;
    empty: number;
  };
  summary: {
    internalCount: number;
    externalCount: number;
    nofollowCount: number;
    brokenCount: number;
    uniqueInternalDomains: number;
    uniqueExternalDomains: number;
  };
}

/** Robots.txt analysis */
export interface RobotsTxtRule {
  userAgent: string;
  allow: string[];
  disallow: string[];
}

export interface RobotsTxtAnalysis {
  exists: boolean;
  content: string;
  rules: RobotsTxtRule[];
  sitemaps: string[];
  testResult?: {
    path: string;
    userAgent: string;
    allowed: boolean;
    matchingRule: string | null;
  };
  issues: SeoIssue[];
}

/** Sitemap analysis */
export interface SitemapAnalysis {
  type: 'urlset' | 'sitemapindex';
  urlCount: number;
  urls: string[];
  lastmodDistribution: {
    thisWeek: number;
    thisMonth: number;
    thisYear: number;
    older: number;
    missing: number;
  };
  issues: SeoIssue[];
  urlCheck?: { url: string; statusCode: number }[];
}

/** Core Web Vitals */
export interface CoreWebVitalsResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  coreWebVitals: {
    LCP: MetricResult;
    INP: MetricResult;
    CLS: MetricResult;
    FCP: MetricResult;
    TTFB: MetricResult;
  };
  lighthouseScores: {
    performance: number;
    seo: number;
    accessibility: number;
    bestPractices: number;
  };
  fieldData?: {
    available: boolean;
    LCP?: MetricResult;
    INP?: MetricResult;
    CLS?: MetricResult;
  };
  opportunities: Opportunity[];
  diagnostics: Diagnostic[];
  resources: ResourceSummary;
}

export interface MetricResult {
  value: number;
  unit: string;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface Opportunity {
  title: string;
  savings: string;
  description: string;
}

export interface Diagnostic {
  title: string;
  description: string;
  value: string;
}

export interface ResourceSummary {
  totalSize: number;
  requestCount: number;
  byType: Record<string, { size: number; count: number }>;
}

/** Mobile friendliness */
export interface MobileFriendlyResult {
  url: string;
  mobileFriendly: boolean;
  checks: {
    viewport: { configured: boolean; content: string | null };
    fontSizes: { legible: boolean; smallTextPercentage: number };
    tapTargets: { adequate: boolean; tooSmallCount: number; tooCloseCount: number };
    contentWidth: { fitsViewport: boolean; horizontalScrolling: boolean };
  };
  mobileLighthouseScore: number;
  issues: SeoIssue[];
}

/** Common types */
export interface SeoIssue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  detail: string;
}

export type Severity = 'critical' | 'high' | 'medium' | 'low';
