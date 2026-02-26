/** SEO rules and thresholds used across analyzers */

export const SEO_RULES = {
  title: {
    minLength: 30,
    maxLength: 60,
    idealMinLength: 50,
    idealMaxLength: 60,
  },

  metaDescription: {
    minLength: 70,
    maxLength: 160,
    idealMinLength: 150,
    idealMaxLength: 160,
  },

  headings: {
    maxH1Count: 1,
    maxEmptyHeadings: 0,
  },

  images: {
    maxFileSizeBytes: 200 * 1024, // 200KB
    altTextMaxLength: 125,
    modernFormats: ['webp', 'avif'],
    acceptableFormats: ['webp', 'avif', 'jpg', 'jpeg', 'png', 'gif', 'svg'],
  },

  links: {
    maxPerPage: 150,
    genericAnchors: [
      'click here',
      'read more',
      'learn more',
      'here',
      'this',
      'link',
      'more',
      'continue',
      'go',
    ],
  },

  content: {
    minWordCount: {
      blogPost: 300,
      productPage: 150,
      categoryPage: 200,
      landingPage: 200,
      homepage: 200,
    },
    thinContentThreshold: 200,
  },

  performance: {
    lcp: { good: 2500, needsImprovement: 4000 },
    inp: { good: 200, needsImprovement: 500 },
    cls: { good: 0.1, needsImprovement: 0.25 },
    fcp: { good: 1800, needsImprovement: 3000 },
    ttfb: { good: 800, needsImprovement: 1800 },
  },

  mobile: {
    minTapTargetSize: 48,
    minTapTargetSpacing: 8,
    minFontSize: 16,
  },

  url: {
    maxDepth: 4,
    maxLength: 200,
  },

  sitemap: {
    maxUrlsPerFile: 50000,
    maxFileSizeMb: 50,
  },

  ogImage: {
    minWidth: 1200,
    minHeight: 630,
    aspectRatio: 1.91,
  },
} as const;

/** Score weights for overall SEO scoring */
export const SCORE_WEIGHTS = {
  title: 20,
  metaDescription: 10,
  headings: 15,
  images: 10,
  links: 10,
  canonical: 10,
  openGraph: 5,
  robots: 10,
  content: 10,
} as const;
