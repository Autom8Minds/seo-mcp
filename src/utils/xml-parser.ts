/**
 * Simple XML parser for sitemaps
 * Uses regex-based parsing to avoid heavy XML library dependencies
 */

export interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
}

export interface SitemapIndex {
  sitemaps: { loc: string; lastmod?: string }[];
}

export function parseSitemapXml(xml: string): { type: 'urlset' | 'sitemapindex'; urls: SitemapUrl[]; sitemaps: { loc: string; lastmod?: string }[] } {
  const isSitemapIndex = xml.includes('<sitemapindex') || xml.includes(':sitemapindex');

  if (isSitemapIndex) {
    return {
      type: 'sitemapindex',
      urls: [],
      sitemaps: parseSitemapIndexEntries(xml),
    };
  }

  return {
    type: 'urlset',
    urls: parseSitemapUrls(xml),
    sitemaps: [],
  };
}

function parseSitemapUrls(xml: string): SitemapUrl[] {
  const urls: SitemapUrl[] = [];
  const urlRegex = /<url>([\s\S]*?)<\/url>/gi;
  let match;

  while ((match = urlRegex.exec(xml)) !== null) {
    const block = match[1];
    const loc = extractTag(block, 'loc');
    if (loc) {
      urls.push({
        loc,
        lastmod: extractTag(block, 'lastmod') || undefined,
        changefreq: extractTag(block, 'changefreq') || undefined,
        priority: extractTag(block, 'priority') || undefined,
      });
    }
  }

  return urls;
}

function parseSitemapIndexEntries(xml: string): { loc: string; lastmod?: string }[] {
  const entries: { loc: string; lastmod?: string }[] = [];
  const sitemapRegex = /<sitemap>([\s\S]*?)<\/sitemap>/gi;
  let match;

  while ((match = sitemapRegex.exec(xml)) !== null) {
    const block = match[1];
    const loc = extractTag(block, 'loc');
    if (loc) {
      entries.push({
        loc,
        lastmod: extractTag(block, 'lastmod') || undefined,
      });
    }
  }

  return entries;
}

function extractTag(block: string, tagName: string): string | null {
  const regex = new RegExp(`<${tagName}[^>]*>([^<]+)</${tagName}>`, 'i');
  const match = block.match(regex);
  return match ? match[1].trim() : null;
}

export function isValidSitemapXml(xml: string): boolean {
  return (
    xml.includes('<?xml') &&
    (xml.includes('<urlset') || xml.includes('<sitemapindex'))
  );
}
