/**
 * Near-duplicate content detection using simhash.
 *
 * Simhash produces a fingerprint where similar content yields similar hashes.
 * Hamming distance between simhashes indicates similarity:
 * - 0 = identical, 1-3 = near-duplicate, 4-10 = somewhat similar, >10 = different
 */

import { getBodyText, countWords, parseHtml } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';

export interface NearDuplicateGroup {
  urls: string[];
  similarity: number;
  type: 'near-duplicate';
}

/**
 * Compute a 64-bit simhash for text content.
 * Uses word-level shingles (3-grams) as features.
 */
export function computeSimhash(text: string): bigint {
  const words = text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 0);
  if (words.length < 3) return 0n;

  // Generate 3-gram shingles
  const shingles: string[] = [];
  for (let i = 0; i <= words.length - 3; i++) {
    shingles.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  }

  // Compute weighted bit vector
  const bits = new Array(64).fill(0);

  for (const shingle of shingles) {
    const hash = fnv1a64(shingle);
    for (let i = 0; i < 64; i++) {
      if ((hash >> BigInt(i)) & 1n) {
        bits[i]++;
      } else {
        bits[i]--;
      }
    }
  }

  // Build simhash from bit vector
  let simhash = 0n;
  for (let i = 0; i < 64; i++) {
    if (bits[i] > 0) {
      simhash |= 1n << BigInt(i);
    }
  }

  return simhash;
}

/**
 * FNV-1a 64-bit hash function.
 */
function fnv1a64(str: string): bigint {
  let hash = 14695981039346656037n; // FNV offset basis
  const prime = 1099511628211n;

  for (let i = 0; i < str.length; i++) {
    hash ^= BigInt(str.charCodeAt(i));
    hash = (hash * prime) & 0xFFFFFFFFFFFFFFFFn;
  }

  return hash;
}

/**
 * Calculate Hamming distance between two simhashes.
 * Lower = more similar. 0 = identical.
 */
export function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}

/**
 * Convert Hamming distance to a similarity percentage (0-100).
 * Distance 0 = 100% similar, distance 64 = 0% similar.
 */
export function similarityFromDistance(distance: number): number {
  return Math.round((1 - distance / 64) * 100);
}

/**
 * Find near-duplicate pages from a list of pages with their body text.
 * Returns groups of pages with >threshold similarity.
 */
export function findNearDuplicates(
  pagesWithContent: Array<{ url: string; bodyText: string }>,
  similarityThreshold: number = 85,
): NearDuplicateGroup[] {
  logger.info(`Finding near-duplicates among ${pagesWithContent.length} pages (threshold: ${similarityThreshold}%)`);

  // Compute simhash for each page
  const hashes: Array<{ url: string; simhash: bigint }> = [];
  for (const page of pagesWithContent) {
    if (countWords(page.bodyText) < 50) continue; // Skip very short pages
    const simhash = computeSimhash(page.bodyText);
    if (simhash !== 0n) {
      hashes.push({ url: page.url, simhash });
    }
  }

  // Compare all pairs (O(n^2) but fine for typical crawl sizes)
  const groups: NearDuplicateGroup[] = [];
  const grouped = new Set<string>();

  for (let i = 0; i < hashes.length; i++) {
    if (grouped.has(hashes[i].url)) continue;

    const similar: string[] = [hashes[i].url];
    let minSimilarity = 100;

    for (let j = i + 1; j < hashes.length; j++) {
      if (grouped.has(hashes[j].url)) continue;

      const distance = hammingDistance(hashes[i].simhash, hashes[j].simhash);
      const similarity = similarityFromDistance(distance);

      if (similarity >= similarityThreshold) {
        similar.push(hashes[j].url);
        minSimilarity = Math.min(minSimilarity, similarity);
      }
    }

    if (similar.length > 1) {
      for (const url of similar) grouped.add(url);
      groups.push({
        urls: similar,
        similarity: minSimilarity,
        type: 'near-duplicate',
      });
    }
  }

  logger.info(`Found ${groups.length} near-duplicate groups`);
  return groups;
}
