import { SCORE_WEIGHTS, SEO_RULES } from '../constants/seo-rules.js';
import type { PageAnalysis, SeoScore } from '../types/seo-types.js';

interface CategoryScore {
  score: number;
  weight: number;
  weighted: number;
}

function scoreTitleCategory(analysis: PageAnalysis): number {
  const { title } = analysis;
  if (!title.text) return 0;

  let score = 60;
  const len = title.length;

  if (len >= SEO_RULES.title.idealMinLength && len <= SEO_RULES.title.idealMaxLength) {
    score = 100;
  } else if (len >= SEO_RULES.title.minLength && len <= SEO_RULES.title.maxLength) {
    score = 80;
  } else if (len > SEO_RULES.title.maxLength) {
    score = 50;
  } else if (len < SEO_RULES.title.minLength && len > 0) {
    score = 40;
  }

  score -= title.issues.length * 10;
  return Math.max(0, Math.min(100, score));
}

function scoreMetaCategory(analysis: PageAnalysis): number {
  const { metaDescription } = analysis;
  if (!metaDescription.text) return 0;

  let score = 60;
  const len = metaDescription.length;

  if (len >= SEO_RULES.metaDescription.idealMinLength && len <= SEO_RULES.metaDescription.idealMaxLength) {
    score = 100;
  } else if (len >= SEO_RULES.metaDescription.minLength && len <= SEO_RULES.metaDescription.maxLength) {
    score = 80;
  } else if (len > SEO_RULES.metaDescription.maxLength) {
    score = 50;
  } else if (len < SEO_RULES.metaDescription.minLength && len > 0) {
    score = 40;
  }

  score -= metaDescription.issues.length * 10;
  return Math.max(0, Math.min(100, score));
}

function scoreHeadingsCategory(analysis: PageAnalysis): number {
  const { headings } = analysis;
  let score = 100;

  if (headings.h1Count === 0) {
    score -= 40;
  } else if (headings.h1Count > SEO_RULES.headings.maxH1Count) {
    score -= 20;
  }

  if (headings.totalHeadings === 0) {
    score -= 30;
  }

  score -= headings.issues.length * 10;
  return Math.max(0, Math.min(100, score));
}

function scoreImagesCategory(analysis: PageAnalysis): number {
  const { images } = analysis;
  if (images.total === 0) return 100;

  let score = 100;
  const missingAltRatio = images.missingAlt / images.total;

  if (missingAltRatio > 0.5) {
    score -= 40;
  } else if (missingAltRatio > 0.2) {
    score -= 20;
  } else if (missingAltRatio > 0) {
    score -= 10;
  }

  score -= images.issues.length * 5;
  return Math.max(0, Math.min(100, score));
}

function scoreLinksCategory(analysis: PageAnalysis): number {
  const { links } = analysis;
  let score = 100;

  if (links.internal === 0) {
    score -= 20;
  }

  const totalLinks = links.internal + links.external;
  if (totalLinks > SEO_RULES.links.maxPerPage) {
    score -= 15;
  }
  if (totalLinks === 0) {
    score -= 30;
  }

  return Math.max(0, Math.min(100, score));
}

function scoreCanonicalCategory(analysis: PageAnalysis): number {
  const { canonical } = analysis;
  if (!canonical.url) return 30;

  let score = 100;
  score -= canonical.issues.length * 15;
  return Math.max(0, Math.min(100, score));
}

function scoreOpenGraphCategory(analysis: PageAnalysis): number {
  const { openGraph } = analysis;
  let score = 0;

  if (openGraph.title) score += 25;
  if (openGraph.description) score += 25;
  if (openGraph.image) score += 25;
  if (openGraph.url) score += 15;
  if (openGraph.type) score += 10;

  score -= openGraph.issues.length * 10;
  return Math.max(0, Math.min(100, score));
}

function scoreRobotsCategory(analysis: PageAnalysis): number {
  const { robots } = analysis;
  if (!robots.isIndexable) return 20;
  return 100;
}

function scoreContentCategory(analysis: PageAnalysis): number {
  if (!analysis.content) return 50;

  let score = 100;
  if (analysis.content.wordCount < SEO_RULES.content.thinContentThreshold) {
    score -= 40;
  } else if (analysis.content.wordCount < SEO_RULES.content.minWordCount.homepage) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateSeoScore(analysis: PageAnalysis): SeoScore {
  const categories: Record<string, CategoryScore> = {
    title: { score: scoreTitleCategory(analysis), weight: SCORE_WEIGHTS.title, weighted: 0 },
    meta: { score: scoreMetaCategory(analysis), weight: SCORE_WEIGHTS.metaDescription, weighted: 0 },
    headings: { score: scoreHeadingsCategory(analysis), weight: SCORE_WEIGHTS.headings, weighted: 0 },
    images: { score: scoreImagesCategory(analysis), weight: SCORE_WEIGHTS.images, weighted: 0 },
    links: { score: scoreLinksCategory(analysis), weight: SCORE_WEIGHTS.links, weighted: 0 },
    technical: { score: 0, weight: 0, weighted: 0 },
  };

  const canonicalScore = scoreCanonicalCategory(analysis);
  const ogScore = scoreOpenGraphCategory(analysis);
  const robotsScore = scoreRobotsCategory(analysis);
  const contentScore = scoreContentCategory(analysis);

  const technicalWeight = SCORE_WEIGHTS.canonical + SCORE_WEIGHTS.openGraph + SCORE_WEIGHTS.robots + SCORE_WEIGHTS.content;
  const technicalScore = (
    canonicalScore * SCORE_WEIGHTS.canonical +
    ogScore * SCORE_WEIGHTS.openGraph +
    robotsScore * SCORE_WEIGHTS.robots +
    contentScore * SCORE_WEIGHTS.content
  ) / technicalWeight;

  categories.technical = { score: Math.round(technicalScore), weight: technicalWeight, weighted: 0 };

  const totalWeight = Object.values(categories).reduce((sum, c) => sum + c.weight, 0);
  for (const cat of Object.values(categories)) {
    cat.weighted = (cat.score * cat.weight) / totalWeight;
  }

  const overall = Math.round(Object.values(categories).reduce((sum, c) => sum + c.weighted, 0));

  return {
    overall: Math.max(0, Math.min(100, overall)),
    breakdown: {
      title: categories.title.score,
      meta: categories.meta.score,
      headings: categories.headings.score,
      images: categories.images.score,
      links: categories.links.score,
      technical: categories.technical.score,
    },
  };
}
