import { httpGet } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';
import { SEO_RULES } from '../constants/seo-rules.js';
import type { HeadingAnalysis, HeadingNode, SeoIssue } from '../types/seo-types.js';

interface FlatHeading {
  tag: string;
  text: string;
  order: number;
}

function getHeadingLevel(tag: string): number {
  return parseInt(tag.charAt(1), 10);
}

function buildHeadingTree(flatList: FlatHeading[]): HeadingNode[] {
  const tree: HeadingNode[] = [];
  const stack: { node: HeadingNode; level: number }[] = [];

  for (const item of flatList) {
    const level = getHeadingLevel(item.tag);
    const node: HeadingNode = {
      tag: item.tag,
      text: item.text,
      order: item.order,
      children: [],
    };

    while (stack.length > 0 && getHeadingLevel(stack[stack.length - 1].node.tag) >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(node);
    } else {
      const parent = stack[stack.length - 1].node;
      if (!parent.children) parent.children = [];
      parent.children.push(node);
    }

    stack.push({ node, level });
  }

  return tree;
}

function countByLevel(flatList: FlatHeading[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of flatList) {
    counts[item.tag] = (counts[item.tag] || 0) + 1;
  }
  return counts;
}

function checkKeywordPresence(
  flatList: FlatHeading[],
  keyword: string,
): { inH1: boolean; inH2: string[]; count: number } {
  const lower = keyword.toLowerCase();
  let count = 0;
  let inH1 = false;
  const inH2: string[] = [];

  for (const item of flatList) {
    const textLower = item.text.toLowerCase();
    if (textLower.includes(lower)) {
      count++;
      if (item.tag === 'h1') inH1 = true;
      if (item.tag === 'h2') inH2.push(item.text);
    }
  }

  return { inH1, inH2, count };
}

function identifyIssues(flatList: FlatHeading[], counts: Record<string, number>): SeoIssue[] {
  const issues: SeoIssue[] = [];

  const h1Count = counts['h1'] || 0;
  if (h1Count === 0) {
    issues.push({
      type: 'missing_h1',
      severity: 'critical',
      detail: 'Page is missing an H1 heading',
    });
  } else if (h1Count > SEO_RULES.headings.maxH1Count) {
    issues.push({
      type: 'multiple_h1',
      severity: 'high',
      detail: `Page has ${h1Count} H1 headings (recommended: ${SEO_RULES.headings.maxH1Count})`,
    });
  }

  for (const item of flatList) {
    if (!item.text.trim()) {
      issues.push({
        type: 'empty_heading',
        severity: 'medium',
        detail: `Empty ${item.tag.toUpperCase()} heading at position ${item.order}`,
      });
    }
  }

  const usedLevels = new Set(flatList.map(h => getHeadingLevel(h.tag)));
  if (usedLevels.size > 1) {
    const sorted = Array.from(usedLevels).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] - sorted[i - 1] > 1) {
        const skippedStart = sorted[i - 1] + 1;
        const skippedEnd = sorted[i] - 1;
        const skipped = skippedStart === skippedEnd
          ? `H${skippedStart}`
          : `H${skippedStart}-H${skippedEnd}`;
        issues.push({
          type: 'skipped_level',
          severity: 'medium',
          detail: `Heading level skipped: ${skipped} (found H${sorted[i - 1]} followed by H${sorted[i]})`,
        });
      }
    }
  }

  if (flatList.length > 0 && getHeadingLevel(flatList[0].tag) !== 1) {
    issues.push({
      type: 'no_h1_first',
      severity: 'medium',
      detail: `First heading is ${flatList[0].tag.toUpperCase()}, expected H1`,
    });
  }

  return issues;
}

export async function analyzeHeadings(
  url: string,
  targetKeyword?: string,
): Promise<HeadingAnalysis> {
  logger.info(`Analyzing headings: ${url}`);

  const response = await httpGet(url);
  const $ = parseHtml(response.body);

  const flatList: FlatHeading[] = [];
  let order = 0;

  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || '';
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    order++;
    flatList.push({ tag, text, order });
  });

  const counts = countByLevel(flatList);
  const headingTree = buildHeadingTree(flatList);
  const issues = identifyIssues(flatList, counts);

  const keywordPresence = targetKeyword
    ? checkKeywordPresence(flatList, targetKeyword)
    : undefined;

  if (targetKeyword && keywordPresence && !keywordPresence.inH1) {
    issues.push({
      type: 'keyword_missing_h1',
      severity: 'high',
      detail: `Target keyword "${targetKeyword}" not found in H1`,
    });
  }

  logger.info(`Heading analysis complete: ${flatList.length} headings found`);

  return {
    headingTree,
    flatList,
    counts,
    keywordPresence,
    issues,
  };
}
