import { httpGet } from '../utils/http-client.js';
import {
  parseHtml,
  extractTitle,
  extractMetaDescription,
  extractCanonical,
  extractMetaRobots,
  extractOpenGraph,
  extractViewport,
  extractPagination,
  countWords,
  getBodyText,
} from '../utils/html-parser.js';
import { normalizeUrl } from '../utils/url-validator.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import { calculateSeoScore } from './scoring.js';
import { logger } from '../utils/logger.js';
import type { CheerioAPI } from '../utils/html-parser.js';
import type {
  PageAnalysis,
  TitleAnalysis,
  MetaDescriptionAnalysis,
  CanonicalAnalysis,
  RobotsAnalysis,
  OpenGraphAnalysis,
  HeadingSummary,
  ImageSummary,
  LinkSummary,
  ContentAnalysis,
} from '../types/seo-types.js';

interface AnalyzePageOptions {
  includeContent?: boolean;
  followRedirects?: boolean;
  userAgent?: string;
  renderJs?: boolean;
}

function analyzeTitle($: CheerioAPI): TitleAnalysis {
  const text = extractTitle($);
  const length = text?.length ?? 0;
  const issues: string[] = [];

  if (!text) {
    issues.push('Missing title tag');
  } else {
    if (length < SEO_RULES.title.minLength) {
      issues.push(`Title too short (${length} chars, minimum ${SEO_RULES.title.minLength})`);
    }
    if (length > SEO_RULES.title.maxLength) {
      issues.push(`Title too long (${length} chars, maximum ${SEO_RULES.title.maxLength})`);
    }
  }

  return { text, length, issues };
}

function analyzeMetaDescription($: CheerioAPI): MetaDescriptionAnalysis {
  const text = extractMetaDescription($);
  const length = text?.length ?? 0;
  const issues: string[] = [];

  if (!text) {
    issues.push('Missing meta description');
  } else {
    if (length < SEO_RULES.metaDescription.minLength) {
      issues.push(`Meta description too short (${length} chars, minimum ${SEO_RULES.metaDescription.minLength})`);
    }
    if (length > SEO_RULES.metaDescription.maxLength) {
      issues.push(`Meta description too long (${length} chars, maximum ${SEO_RULES.metaDescription.maxLength})`);
    }
  }

  return { text, length, issues };
}

function analyzeCanonical($: CheerioAPI, pageUrl: string): CanonicalAnalysis {
  const url = extractCanonical($);
  const issues: string[] = [];
  let isSelfReferencing = false;

  if (!url) {
    issues.push('Missing canonical tag');
  } else {
    try {
      const canonical = normalizeUrl(url);
      const page = normalizeUrl(pageUrl);
      isSelfReferencing = canonical === page;
    } catch {
      issues.push('Invalid canonical URL');
    }
  }

  return { url, isSelfReferencing, issues };
}

function analyzeRobotsMeta($: CheerioAPI, headers: Record<string, string>): RobotsAnalysis {
  const meta = extractMetaRobots($);
  const xRobotsTag = headers['x-robots-tag'] || null;
  const combined = [meta, xRobotsTag].filter(Boolean).join(', ').toLowerCase();
  const isIndexable = !combined.includes('noindex');

  return { meta, xRobotsTag, isIndexable };
}

function analyzeOg($: CheerioAPI): OpenGraphAnalysis {
  const og = extractOpenGraph($);
  const issues: string[] = [];

  if (!og.title) issues.push('Missing og:title');
  if (!og.description) issues.push('Missing og:description');
  if (!og.image) issues.push('Missing og:image');

  return {
    title: og.title,
    description: og.description,
    image: og.image,
    url: og.url,
    type: og.type,
    issues,
  };
}

function summarizeHeadings($: CheerioAPI): HeadingSummary {
  const h1Elements = $('h1');
  const h1Text: string[] = [];
  h1Elements.each((_, el) => {
    const text = $(el).text().trim();
    if (text) h1Text.push(text);
  });

  const totalHeadings = $('h1, h2, h3, h4, h5, h6').length;
  const issues: string[] = [];

  if (h1Text.length === 0) {
    issues.push('Missing H1 tag');
  } else if (h1Text.length > SEO_RULES.headings.maxH1Count) {
    issues.push(`Multiple H1 tags found (${h1Text.length})`);
  }

  return { h1Count: h1Text.length, h1Text, totalHeadings, issues };
}

function summarizeImages($: CheerioAPI): ImageSummary {
  const images = $('img');
  let missingAlt = 0;
  const issues: string[] = [];

  images.each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null) {
      missingAlt++;
    }
  });

  const total = images.length;
  if (missingAlt > 0) {
    issues.push(`${missingAlt} image(s) missing alt attribute`);
  }

  return { total, missingAlt, issues };
}

function summarizeLinks($: CheerioAPI, pageUrl: string): LinkSummary {
  let internal = 0;
  let external = 0;
  let nofollow = 0;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:')) {
      return;
    }

    const rel = $(el).attr('rel') || '';
    if (rel.includes('nofollow')) nofollow++;

    try {
      const resolved = new URL(href, pageUrl);
      const page = new URL(pageUrl);
      if (resolved.hostname === page.hostname) {
        internal++;
      } else {
        external++;
      }
    } catch {
      internal++;
    }
  });

  return { internal, external, nofollow };
}

function countSyllables(word: string): number {
  word = word.toLowerCase().replace(/[^a-z]/g, '');
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

function analyzeContent($: CheerioAPI, rawHtml?: string): ContentAnalysis {
  const bodyText = getBodyText($);
  const wordCount = countWords(bodyText);
  const sentences = bodyText.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const sentenceCount = sentences.length;
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;

  // Flesch-Kincaid calculations
  const words = bodyText.split(/\s+/).filter(w => w.length > 0);
  const totalSyllables = words.reduce((sum, w) => sum + countSyllables(w), 0);
  const avgSyllablesPerWord = wordCount > 0 ? totalSyllables / wordCount : 0;

  // Flesch Reading Ease: 206.835 - 1.015 * ASL - 84.6 * ASW
  const fleschReadingEase = wordCount > 0 && sentenceCount > 0
    ? Math.round(Math.max(0, Math.min(100, 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord)))
    : 0;

  // Flesch-Kincaid Grade Level: 0.39 * ASL + 11.8 * ASW - 15.59
  const fleschKincaidGrade = wordCount > 0 && sentenceCount > 0
    ? Math.round((0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59) * 10) / 10
    : 0;

  // Text-to-HTML ratio
  const htmlLength = rawHtml ? rawHtml.length : 0;
  const textLength = bodyText.length;
  const textToHtmlRatio = htmlLength > 0 ? Math.round((textLength / htmlLength) * 100 * 10) / 10 : 0;

  // Thin content detection
  const isThinContent = wordCount < SEO_RULES.content.thinContentThreshold;

  // Overall readability score (0-100)
  const readabilityScore = fleschReadingEase;

  return {
    wordCount,
    readabilityScore,
    fleschKincaidGrade,
    fleschReadingEase,
    textToHtmlRatio,
    isThinContent,
    sentenceCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
  };
}

export async function analyzePage(
  url: string,
  options: AnalyzePageOptions = {},
): Promise<PageAnalysis> {
  const { includeContent = false, followRedirects = true, userAgent } = options;

  logger.info(`Analyzing page: ${url}`);

  const response = await httpGet(url, {
    followRedirects,
    userAgent,
  });

  const $ = parseHtml(response.body);

  const title = analyzeTitle($);
  const metaDescription = analyzeMetaDescription($);
  const canonical = analyzeCanonical($, url);
  const robots = analyzeRobotsMeta($, response.headers);
  const openGraph = analyzeOg($);
  const headings = summarizeHeadings($);
  const images = summarizeImages($);
  const links = summarizeLinks($, url);
  const content = includeContent ? analyzeContent($, response.body) : undefined;
  const pagination = extractPagination($);

  const partialAnalysis: PageAnalysis = {
    url,
    statusCode: response.status,
    redirectChain: response.redirectChain,
    responseTime: response.responseTime,
    title,
    metaDescription,
    canonical,
    robots,
    openGraph,
    headings,
    images,
    links,
    content,
    pagination: (pagination.next || pagination.prev || pagination.issues.length > 0) ? pagination : undefined,
    score: { overall: 0, breakdown: { title: 0, meta: 0, headings: 0, images: 0, links: 0, technical: 0 } },
  };

  partialAnalysis.score = calculateSeoScore(partialAnalysis);

  logger.info(`Page analysis complete: ${url} (score: ${partialAnalysis.score.overall})`);
  return partialAnalysis;
}
