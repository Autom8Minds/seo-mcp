import { httpGet } from '../utils/http-client.js';
import { parseHtml, extractTitle, extractMetaDescription, extractOpenGraph, getBodyText } from '../utils/html-parser.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import type { MetaSuggestions } from '../types/api-types.js';

export async function generateMetaSuggestions(
  url: string,
  targetKeyword?: string,
  secondaryKeywords?: string[],
): Promise<MetaSuggestions> {
  const response = await httpGet(url);
  const $ = parseHtml(response.body);

  const currentTitle = extractTitle($);
  const currentDescription = extractMetaDescription($);
  const og = extractOpenGraph($);
  const bodyText = getBodyText($).slice(0, 2000); // First 2000 chars for context

  const issues: string[] = [];

  // Analyze current title
  if (!currentTitle) {
    issues.push('Title tag is missing');
  } else {
    if (currentTitle.length > SEO_RULES.title.maxLength) {
      issues.push(`Title is too long (${currentTitle.length} chars, max ${SEO_RULES.title.maxLength})`);
    }
    if (currentTitle.length < SEO_RULES.title.minLength) {
      issues.push(`Title is too short (${currentTitle.length} chars, min ${SEO_RULES.title.minLength})`);
    }
    if (targetKeyword && !currentTitle.toLowerCase().includes(targetKeyword.toLowerCase())) {
      issues.push(`Title does not contain target keyword "${targetKeyword}"`);
    }
  }

  // Analyze current meta description
  if (!currentDescription) {
    issues.push('Meta description is missing');
  } else {
    if (currentDescription.length > SEO_RULES.metaDescription.maxLength) {
      issues.push(`Meta description is too long (${currentDescription.length} chars)`);
    }
    if (currentDescription.length < SEO_RULES.metaDescription.minLength) {
      issues.push(`Meta description is too short (${currentDescription.length} chars)`);
    }
  }

  // Analyze OG tags
  if (!og.title) issues.push('Missing og:title');
  if (!og.description) issues.push('Missing og:description');
  if (!og.image) issues.push('Missing og:image');
  if (!og.url) issues.push('Missing og:url');

  // Generate suggestions
  const suggestedTitle = generateTitle(currentTitle, targetKeyword, secondaryKeywords, bodyText);
  const suggestedDescription = generateDescription(currentDescription, targetKeyword, secondaryKeywords, bodyText);

  return {
    current: {
      title: currentTitle,
      description: currentDescription,
      ogTitle: og.title as string | null,
      ogDescription: og.description as string | null,
      ogImage: og.image as string | null,
    },
    issues,
    suggestions: {
      title: {
        text: suggestedTitle,
        length: suggestedTitle.length,
        keywordPosition: targetKeyword ? suggestedTitle.toLowerCase().indexOf(targetKeyword.toLowerCase()) : -1,
        improvement: issues.some((i) => i.includes('Title')) ? 'Added target keyword, optimized length' : 'Minor optimization',
      },
      metaDescription: {
        text: suggestedDescription,
        length: suggestedDescription.length,
        improvement: issues.some((i) => i.includes('Meta description')) ? 'Created compelling description with CTA' : 'Minor optimization',
      },
      ogTitle: {
        text: suggestedTitle.replace(/ \|.*$/, '').replace(/ -.*$/, ''),
        improvement: 'Clean title without brand suffix for social sharing',
      },
      ogDescription: {
        text: suggestedDescription.slice(0, 120),
        improvement: 'Concise social-friendly description',
      },
    },
  };
}

function generateTitle(
  current: string | null,
  keyword?: string,
  secondary?: string[],
  bodyText?: string,
): string {
  if (current && current.length >= 50 && current.length <= 60) {
    // Title is already good length, just ensure keyword is present
    if (keyword && current.toLowerCase().includes(keyword.toLowerCase())) {
      return current;
    }
  }

  // Generate from keyword + context
  if (keyword) {
    const capitalizedKeyword = keyword.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const secondary0 = secondary?.[0] ? ` - ${secondary[0].split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}` : '';
    const title = `${capitalizedKeyword}${secondary0} | Guide`;
    if (title.length <= 60) return title;
    return `${capitalizedKeyword} | Complete Guide`;
  }

  return current || 'Untitled Page';
}

function generateDescription(
  current: string | null,
  keyword?: string,
  secondary?: string[],
  bodyText?: string,
): string {
  if (current && current.length >= 150 && current.length <= 160) {
    return current;
  }

  if (keyword) {
    const keywordPhrase = keyword.toLowerCase();
    const secondaryPhrase = secondary?.slice(0, 2).join(' and ') || '';
    const desc = `Discover everything about ${keywordPhrase}${secondaryPhrase ? `, including ${secondaryPhrase}` : ''}. Expert guide with actionable tips and proven strategies. Learn more now.`;
    return desc.slice(0, 160);
  }

  if (bodyText) {
    // Extract first meaningful sentence
    const sentences = bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 30);
    if (sentences.length > 0) {
      const desc = sentences[0].trim() + '.';
      return desc.length > 160 ? desc.slice(0, 157) + '...' : desc;
    }
  }

  return current || '';
}
