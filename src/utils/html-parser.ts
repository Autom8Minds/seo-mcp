import * as cheerio from 'cheerio';
import type { CheerioAPI } from 'cheerio';

export type { CheerioAPI };

export function parseHtml(html: string): CheerioAPI {
  return cheerio.load(html);
}

export function extractTitle($: CheerioAPI): string | null {
  return $('title').first().text().trim() || null;
}

export function extractMetaDescription($: CheerioAPI): string | null {
  return $('meta[name="description"]').attr('content')?.trim() || null;
}

export function extractCanonical($: CheerioAPI): string | null {
  return $('link[rel="canonical"]').attr('href')?.trim() || null;
}

export function extractMetaRobots($: CheerioAPI): string | null {
  return $('meta[name="robots"]').attr('content')?.trim() || null;
}

export function extractOpenGraph($: CheerioAPI): Record<string, string | null> {
  return {
    title: $('meta[property="og:title"]').attr('content') || null,
    description: $('meta[property="og:description"]').attr('content') || null,
    image: $('meta[property="og:image"]').attr('content') || null,
    url: $('meta[property="og:url"]').attr('content') || null,
    type: $('meta[property="og:type"]').attr('content') || null,
  };
}

export function extractTwitterCard($: CheerioAPI): Record<string, string | null> {
  return {
    card: $('meta[name="twitter:card"]').attr('content') || null,
    title: $('meta[name="twitter:title"]').attr('content') || null,
    description: $('meta[name="twitter:description"]').attr('content') || null,
    image: $('meta[name="twitter:image"]').attr('content') || null,
  };
}

export function extractJsonLd($: CheerioAPI): Record<string, unknown>[] {
  const schemas: Record<string, unknown>[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html();
      if (text) {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          schemas.push(...parsed);
        } else {
          schemas.push(parsed);
        }
      }
    } catch {
      // Invalid JSON-LD, skip
    }
  });
  return schemas;
}

export function extractViewport($: CheerioAPI): string | null {
  return $('meta[name="viewport"]').attr('content') || null;
}

export function countWords(text: string): number {
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 0).length;
}

export interface PaginationLinks {
  next: string | null;
  prev: string | null;
  issues: string[];
}

export function extractPagination($: CheerioAPI): PaginationLinks {
  const next = $('link[rel="next"]').attr('href')?.trim() || null;
  const prev = $('link[rel="prev"]').attr('href')?.trim() || null;
  const issues: string[] = [];

  if (next && !prev) {
    // Could be the first page — only an issue if there's no indication this is page 1
  }
  if (prev && !next) {
    // Last page in a series — normal
  }

  // Check for multiple rel=next or rel=prev
  if ($('link[rel="next"]').length > 1) {
    issues.push('Multiple rel="next" links found. Only one should exist per page.');
  }
  if ($('link[rel="prev"]').length > 1) {
    issues.push('Multiple rel="prev" links found. Only one should exist per page.');
  }

  // Check for relative URLs (should be absolute)
  if (next && !next.startsWith('http')) {
    issues.push(`rel="next" uses a relative URL: "${next}". Use absolute URLs for reliability.`);
  }
  if (prev && !prev.startsWith('http')) {
    issues.push(`rel="prev" uses a relative URL: "${prev}". Use absolute URLs for reliability.`);
  }

  return { next, prev, issues };
}

export function getBodyText($: CheerioAPI): string {
  // Remove script, style, nav, footer elements for content analysis
  const clone = $.root().clone();
  clone.find('script, style, nav, footer, header, aside').remove();
  return clone.find('body').text().replace(/\s+/g, ' ').trim();
}
