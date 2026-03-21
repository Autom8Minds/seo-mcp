/**
 * Accessibility analyzer (WCAG-inspired, Cheerio-based).
 *
 * Performs lightweight accessibility checks without requiring a browser:
 * language attribute, form labels, empty interactive elements, ARIA usage,
 * heading hierarchy, skip navigation, and image alt text.
 */

import { httpGet } from '../utils/http-client.js';
import { parseHtml } from '../utils/html-parser.js';
import { logger } from '../utils/logger.js';
import type { SeoIssue } from '../types/seo-types.js';

export interface AccessibilityCheck {
  rule: string;
  status: 'pass' | 'warning' | 'fail';
  count: number;
  detail: string;
  elements?: string[];
}

export interface AccessibilityAnalysis {
  url: string;
  checks: AccessibilityCheck[];
  score: number;
  issues: SeoIssue[];
  summary: {
    passed: number;
    warnings: number;
    failures: number;
    totalChecks: number;
  };
}

export async function analyzeAccessibility(url: string): Promise<AccessibilityAnalysis> {
  logger.info(`Analyzing accessibility: ${url}`);

  const response = await httpGet(url);
  const $ = parseHtml(response.body);
  const checks: AccessibilityCheck[] = [];

  // 1. Language attribute on <html>
  const lang = $('html').attr('lang');
  if (!lang) {
    checks.push({ rule: 'html-has-lang', status: 'fail', count: 1, detail: 'Missing lang attribute on <html> element. Screen readers need this to determine the correct language.' });
  } else {
    checks.push({ rule: 'html-has-lang', status: 'pass', count: 0, detail: `Page language set to "${lang}".` });
  }

  // 2. Form inputs without labels
  const unlabeledInputs: string[] = [];
  $('input, select, textarea').each((_, el) => {
    const type = $(el).attr('type')?.toLowerCase();
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'image') return;

    const id = $(el).attr('id');
    const ariaLabel = $(el).attr('aria-label');
    const ariaLabelledBy = $(el).attr('aria-labelledby');
    const title = $(el).attr('title');
    const placeholder = $(el).attr('placeholder');

    // Check for associated <label>
    const hasLabel = id ? $(`label[for="${id}"]`).length > 0 : false;
    // Check if wrapped in <label>
    const wrappedInLabel = $(el).parents('label').length > 0;

    if (!hasLabel && !wrappedInLabel && !ariaLabel && !ariaLabelledBy && !title) {
      const tag = $(el).prop('tagName')?.toLowerCase() || 'input';
      const name = $(el).attr('name') || $(el).attr('id') || '';
      unlabeledInputs.push(`<${tag}${type ? ` type="${type}"` : ''}${name ? ` name="${name}"` : ''}>`);
    }
  });

  if (unlabeledInputs.length > 0) {
    checks.push({
      rule: 'form-label',
      status: 'fail',
      count: unlabeledInputs.length,
      detail: `${unlabeledInputs.length} form input(s) without an associated label, aria-label, or title.`,
      elements: unlabeledInputs.slice(0, 10),
    });
  } else {
    checks.push({ rule: 'form-label', status: 'pass', count: 0, detail: 'All form inputs have associated labels.' });
  }

  // 3. Empty buttons
  const emptyButtons: string[] = [];
  $('button, [role="button"], input[type="button"], input[type="submit"]').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    const title = $(el).attr('title');
    const value = $(el).attr('value');

    if (!text && !ariaLabel && !title && !value) {
      const tag = $(el).prop('tagName')?.toLowerCase() || 'button';
      const classes = $(el).attr('class')?.split(' ').slice(0, 2).join('.') || '';
      emptyButtons.push(`<${tag}${classes ? ` class="${classes}"` : ''}>`);
    }
  });

  if (emptyButtons.length > 0) {
    checks.push({
      rule: 'button-name',
      status: 'fail',
      count: emptyButtons.length,
      detail: `${emptyButtons.length} button(s) with no accessible name (no text, aria-label, or title).`,
      elements: emptyButtons.slice(0, 10),
    });
  } else {
    checks.push({ rule: 'button-name', status: 'pass', count: 0, detail: 'All buttons have accessible names.' });
  }

  // 4. Empty links
  const emptyLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const text = $(el).text().trim();
    const ariaLabel = $(el).attr('aria-label');
    const title = $(el).attr('title');
    const hasImage = $(el).find('img[alt]').length > 0;

    if (!text && !ariaLabel && !title && !hasImage) {
      const href = $(el).attr('href') || '';
      emptyLinks.push(`<a href="${href.substring(0, 50)}">`);
    }
  });

  if (emptyLinks.length > 0) {
    checks.push({
      rule: 'link-name',
      status: 'fail',
      count: emptyLinks.length,
      detail: `${emptyLinks.length} link(s) with no accessible name (no text, aria-label, title, or image with alt).`,
      elements: emptyLinks.slice(0, 10),
    });
  } else {
    checks.push({ rule: 'link-name', status: 'pass', count: 0, detail: 'All links have accessible names.' });
  }

  // 5. Images without alt text
  let missingAlt = 0;
  let emptyAlt = 0;
  let decorativeImages = 0;
  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt === null) {
      missingAlt++;
    } else if (alt === '') {
      decorativeImages++; // Empty alt is valid for decorative images
    }
  });

  if (missingAlt > 0) {
    checks.push({
      rule: 'image-alt',
      status: 'fail',
      count: missingAlt,
      detail: `${missingAlt} image(s) missing alt attribute entirely. All images must have an alt attribute.`,
    });
  } else {
    checks.push({ rule: 'image-alt', status: 'pass', count: 0, detail: 'All images have alt attributes.' });
  }

  // 6. Heading hierarchy
  const headingLevels: number[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = $(el).prop('tagName')?.toLowerCase() || '';
    headingLevels.push(parseInt(tag.charAt(1), 10));
  });

  let skippedLevels = 0;
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] - headingLevels[i - 1] > 1) {
      skippedLevels++;
    }
  }

  if (skippedLevels > 0) {
    checks.push({
      rule: 'heading-order',
      status: 'warning',
      count: skippedLevels,
      detail: `Heading hierarchy skips ${skippedLevels} level(s) (e.g., H2 followed by H4). Use sequential heading levels.`,
    });
  } else if (headingLevels.length > 0) {
    checks.push({ rule: 'heading-order', status: 'pass', count: 0, detail: 'Heading hierarchy is sequential.' });
  }

  // 7. Skip navigation link
  const firstLinks = $('a[href]').slice(0, 5);
  let hasSkipNav = false;
  firstLinks.each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().toLowerCase();
    if (href.startsWith('#') && (text.includes('skip') || text.includes('main content') || text.includes('navigation'))) {
      hasSkipNav = true;
    }
  });

  // Also check for skip link by class/id
  if (!hasSkipNav) {
    hasSkipNav = $('[class*="skip"], [id*="skip"]').filter('a').length > 0;
  }

  if (!hasSkipNav) {
    checks.push({
      rule: 'skip-navigation',
      status: 'warning',
      count: 1,
      detail: 'No skip navigation link found. Add a "Skip to main content" link for keyboard users.',
    });
  } else {
    checks.push({ rule: 'skip-navigation', status: 'pass', count: 0, detail: 'Skip navigation link found.' });
  }

  // 8. ARIA landmark roles
  const hasMain = $('main, [role="main"]').length > 0;
  const hasNav = $('nav, [role="navigation"]').length > 0;
  const hasBanner = $('header, [role="banner"]').length > 0;

  if (!hasMain) {
    checks.push({
      rule: 'landmark-main',
      status: 'warning',
      count: 1,
      detail: 'No <main> element or role="main" found. Landmark roles help screen reader users navigate.',
    });
  } else {
    checks.push({ rule: 'landmark-main', status: 'pass', count: 0, detail: 'Main landmark found.' });
  }

  // 9. Document title
  const title = $('title').text().trim();
  if (!title) {
    checks.push({
      rule: 'document-title',
      status: 'fail',
      count: 1,
      detail: 'Page has no <title> element. The title is announced by screen readers when the page loads.',
    });
  } else {
    checks.push({ rule: 'document-title', status: 'pass', count: 0, detail: `Page title: "${title.substring(0, 60)}".` });
  }

  // 10. Tabindex > 0 (anti-pattern)
  const badTabindex: string[] = [];
  $('[tabindex]').each((_, el) => {
    const tabindex = parseInt($(el).attr('tabindex') || '0', 10);
    if (tabindex > 0) {
      const tag = $(el).prop('tagName')?.toLowerCase() || '';
      badTabindex.push(`<${tag} tabindex="${tabindex}">`);
    }
  });

  if (badTabindex.length > 0) {
    checks.push({
      rule: 'tabindex',
      status: 'warning',
      count: badTabindex.length,
      detail: `${badTabindex.length} element(s) with tabindex > 0. Positive tabindex disrupts natural tab order.`,
      elements: badTabindex.slice(0, 10),
    });
  } else {
    checks.push({ rule: 'tabindex', status: 'pass', count: 0, detail: 'No elements with positive tabindex.' });
  }

  // Build issues list
  const issues: SeoIssue[] = [];
  for (const check of checks) {
    if (check.status === 'fail') {
      issues.push({ type: 'accessibility', severity: 'high', detail: check.detail });
    } else if (check.status === 'warning') {
      issues.push({ type: 'accessibility', severity: 'medium', detail: check.detail });
    }
  }

  // Score
  const passed = checks.filter(c => c.status === 'pass').length;
  const warnings = checks.filter(c => c.status === 'warning').length;
  const failures = checks.filter(c => c.status === 'fail').length;
  const totalChecks = checks.length;

  let score = Math.round((passed / totalChecks) * 100);
  // Deduct for warnings/failures
  score = Math.max(0, score - failures * 5 - warnings * 2);

  logger.info(`Accessibility analysis complete: ${url} (score: ${score}, ${failures} failures, ${warnings} warnings)`);

  return {
    url,
    checks,
    score,
    issues,
    summary: { passed, warnings, failures, totalChecks },
  };
}
