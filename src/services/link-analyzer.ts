import { httpGet, httpHead } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { isInternalLink, resolveUrl, extractDomain } from '../utils/url-validator.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import { DEFAULTS } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import type { LinkAnalysis, LinkInfo } from '../types/seo-types.js';
import type { CheerioAPI } from '../utils/html-parser.js';

type LinkPosition = LinkInfo['position'];

const GENERIC_ANCHORS = SEO_RULES.links.genericAnchors;
const URL_PATTERN = /^https?:\/\//i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function determineLinkPosition($: CheerioAPI, el: any): LinkPosition {
  let current = $(el).parent();

  for (let depth = 0; depth < 10 && current.length > 0; depth++) {
    const tagName = current.prop('tagName')?.toLowerCase() || '';
    const role = current.attr('role')?.toLowerCase() || '';
    const className = current.attr('class')?.toLowerCase() || '';

    if (tagName === 'nav' || role === 'navigation' || className.includes('nav')) return 'nav';
    if (tagName === 'footer' || role === 'contentinfo' || className.includes('footer')) return 'footer';
    if (tagName === 'aside' || role === 'complementary' || className.includes('sidebar')) return 'sidebar';
    if (tagName === 'main' || role === 'main' || className.includes('content') || className.includes('article')) return 'content';

    current = current.parent();
  }

  return 'other';
}

function classifyAnchorText(anchor: string): 'descriptive' | 'generic' | 'url' | 'empty' {
  const trimmed = anchor.trim();
  if (!trimmed) return 'empty';
  if (URL_PATTERN.test(trimmed)) return 'url';
  if ((GENERIC_ANCHORS as readonly string[]).includes(trimmed.toLowerCase())) return 'generic';
  return 'descriptive';
}

async function checkLinkStatus(url: string): Promise<number> {
  try {
    const response = await httpHead(url, { timeout: 5000, followRedirects: true });
    return response.status;
  } catch {
    return 0;
  }
}

function isNavigableLink(href: string): boolean {
  if (!href) return false;
  if (href.startsWith('#')) return false;
  if (href.startsWith('javascript:')) return false;
  if (href.startsWith('mailto:')) return false;
  if (href.startsWith('tel:')) return false;
  if (href.startsWith('data:')) return false;
  return true;
}

export async function analyzeLinks(
  url: string,
  checkBrokenLinks: boolean = false,
  maxLinks: number = DEFAULTS.maxLinks,
): Promise<LinkAnalysis> {
  logger.info(`Analyzing links: ${url}`);

  const response = await httpGet(url);
  const $ = parseHtml(response.body);

  const internal: LinkInfo[] = [];
  const external: LinkInfo[] = [];
  const anchorTextAnalysis = { descriptive: 0, generic: 0, url: 0, empty: 0 };
  const seenUrls = new Set<string>();
  let processed = 0;

  $('a[href]').each((_, el) => {
    if (processed >= maxLinks) return false;

    const href = $(el).attr('href') || '';
    if (!isNavigableLink(href)) return;

    const resolved = resolveUrl(href, url);
    const anchor = $(el).text().replace(/\s+/g, ' ').trim();
    const rel = $(el).attr('rel') || '';
    const nofollow = rel.includes('nofollow');
    const position = determineLinkPosition($, el);

    const anchorType = classifyAnchorText(anchor);
    anchorTextAnalysis[anchorType]++;

    const linkInfo: LinkInfo = {
      url: resolved,
      anchor,
      nofollow,
      position,
      rel: rel || undefined,
    };

    if (isInternalLink(resolved, url)) {
      internal.push(linkInfo);
    } else {
      external.push(linkInfo);
    }

    seenUrls.add(resolved);
    processed++;
  });

  const broken: LinkInfo[] = [];
  if (checkBrokenLinks) {
    const allLinks = [...internal, ...external];
    const uniqueUrls = new Map<string, LinkInfo>();
    for (const link of allLinks) {
      if (!uniqueUrls.has(link.url)) {
        uniqueUrls.set(link.url, link);
      }
    }

    const linksToCheck = Array.from(uniqueUrls.values()).slice(0, 50);
    const results = await Promise.allSettled(
      linksToCheck.map(async (link) => {
        const statusCode = await checkLinkStatus(link.url);
        link.statusCode = statusCode;
        if (statusCode >= 400 || statusCode === 0) {
          broken.push({ ...link, statusCode });
        }
      }),
    );

    logger.info(`Checked ${results.length} links, found ${broken.length} broken`);
  }

  const internalDomains = new Set(internal.map(l => {
    try { return extractDomain(l.url); } catch { return ''; }
  }).filter(Boolean));

  const externalDomains = new Set(external.map(l => {
    try { return extractDomain(l.url); } catch { return ''; }
  }).filter(Boolean));

  logger.info(`Link analysis complete: ${internal.length} internal, ${external.length} external`);

  return {
    internal,
    external,
    broken,
    anchorTextAnalysis,
    summary: {
      internalCount: internal.length,
      externalCount: external.length,
      nofollowCount: [...internal, ...external].filter(l => l.nofollow).length,
      brokenCount: broken.length,
      uniqueInternalDomains: internalDomains.size,
      uniqueExternalDomains: externalDomains.size,
    },
  };
}
