import { httpGet, httpHead } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { resolveUrl, getFileExtension } from '../utils/url-validator.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import { DEFAULTS } from '../config/defaults.js';
import { logger } from '../utils/logger.js';
import type { ImageAnalysis, ImageInfo } from '../types/seo-types.js';

const GENERIC_FILENAMES = [
  'image', 'img', 'photo', 'picture', 'pic',
  'screenshot', 'screen', 'untitled', 'unnamed',
  'download', 'file', 'asset', 'media',
];

const GENERIC_PATTERN = /^(img|image|photo|pic|dsc|dcim|screenshot|screen[-_]?shot)[-_]?\d*$/i;

function extractFormat(src: string): string {
  const ext = getFileExtension(src);
  if (ext) return ext;

  if (src.includes('format=webp') || src.includes('fm=webp')) return 'webp';
  if (src.includes('format=avif') || src.includes('fm=avif')) return 'avif';
  if (src.includes('format=png') || src.includes('fm=png')) return 'png';
  if (src.includes('format=jpg') || src.includes('fm=jpg')) return 'jpg';

  return 'unknown';
}

function evaluateFilename(src: string): 'good' | 'generic' {
  try {
    const pathname = new URL(src, 'https://placeholder.com').pathname;
    const filename = pathname.split('/').pop()?.split('.')[0]?.toLowerCase() || '';

    if (!filename || filename.length <= 2) return 'generic';
    if (GENERIC_FILENAMES.includes(filename)) return 'generic';
    if (GENERIC_PATTERN.test(filename)) return 'generic';
    if (/^[a-f0-9]{16,}$/i.test(filename)) return 'generic';
    if (/^\d+$/.test(filename)) return 'generic';

    return 'good';
  } catch {
    return 'generic';
  }
}

async function getFileSize(src: string): Promise<number | undefined> {
  try {
    const response = await httpHead(src, { timeout: 5000 });
    const contentLength = response.headers['content-length'];
    return contentLength ? parseInt(contentLength, 10) : undefined;
  } catch {
    return undefined;
  }
}

export async function analyzeImages(
  url: string,
  checkFileSize: boolean = false,
  maxImages: number = DEFAULTS.maxImages,
): Promise<ImageAnalysis> {
  logger.info(`Analyzing images: ${url}`);

  const response = await httpGet(url);
  const $ = parseHtml(response.body);

  const imgElements = $('img');
  const images: ImageInfo[] = [];
  const limit = Math.min(imgElements.length, maxImages);

  for (let i = 0; i < limit; i++) {
    const el = imgElements.eq(i);
    const rawSrc = el.attr('src') || el.attr('data-src') || '';
    if (!rawSrc) continue;

    const src = resolveUrl(rawSrc, url);
    const alt = el.attr('alt') ?? null;
    const widthAttr = el.attr('width');
    const heightAttr = el.attr('height');
    const loading = el.attr('loading') || null;
    const format = extractFormat(src);
    const filenameQuality = evaluateFilename(src);

    images.push({
      src,
      alt,
      width: widthAttr ? parseInt(widthAttr, 10) || null : null,
      height: heightAttr ? parseInt(heightAttr, 10) || null : null,
      loading,
      format,
      filenameQuality,
    });
  }

  if (checkFileSize) {
    const sizeChecks = images.map(async (img) => {
      img.fileSize = await getFileSize(img.src);
    });
    await Promise.allSettled(sizeChecks);
  }

  const missingAlt = images.filter(img => img.alt === null).length;
  const emptyAlt = images.filter(img => img.alt !== null && img.alt.trim() === '').length;
  const oversized = images.filter(img =>
    img.fileSize !== undefined && img.fileSize > SEO_RULES.images.maxFileSizeBytes,
  ).length;
  const nonModernFormat = images.filter(img =>
    img.format !== 'unknown' && !(SEO_RULES.images.modernFormats as readonly string[]).includes(img.format),
  ).length;
  const missingDimensions = images.filter(img =>
    img.width === null || img.height === null,
  ).length;
  const missingLazyLoad = images.filter(img => img.loading !== 'lazy').length;

  const total = images.length;
  let score = 100;
  if (total > 0) {
    score -= Math.round((missingAlt / total) * 30);
    score -= Math.round((missingDimensions / total) * 15);
    score -= Math.round((nonModernFormat / total) * 15);
    if (checkFileSize) {
      score -= Math.round((oversized / total) * 20);
    }
    score -= Math.round((missingLazyLoad / total) * 10);
  }

  logger.info(`Image analysis complete: ${total} images, score ${Math.max(0, score)}`);

  return {
    images,
    summary: {
      total,
      missingAlt,
      emptyAlt,
      oversized,
      nonModernFormat,
      missingDimensions,
      missingLazyLoad,
      score: Math.max(0, Math.min(100, score)),
    },
  };
}
