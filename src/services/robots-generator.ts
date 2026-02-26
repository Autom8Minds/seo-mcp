export interface RobotsGeneratorOptions {
  sitemapUrls?: string[];
  disallowPaths?: string[];
  allowPaths?: string[];
  crawlDelay?: number;
  customRules?: { userAgent: string; allow?: string[]; disallow?: string[] }[];
  preset?: 'permissive' | 'standard' | 'restrictive';
}

export interface RobotsGeneratorResult {
  content: string;
  explanation: string[];
  warnings: string[];
  suggestions: string[];
}

const STANDARD_DISALLOW = ['/admin/', '/api/', '/staging/', '/tmp/', '/cgi-bin/', '/*?sort=', '/*?filter=', '/*?page='];
const RESTRICTIVE_DISALLOW = ['/', '/wp-admin/', '/admin/', '/api/'];

export function generateRobotsTxt(options: RobotsGeneratorOptions = {}): RobotsGeneratorResult {
  const { sitemapUrls = [], disallowPaths = [], allowPaths = [], crawlDelay, customRules = [], preset = 'standard' } = options;

  const lines: string[] = [];
  const explanation: string[] = [];
  const warnings: string[] = [];
  const suggestions: string[] = [];

  // Default rules based on preset
  let defaultDisallow: string[] = [];
  let defaultAllow: string[] = ['/'];

  switch (preset) {
    case 'permissive':
      defaultDisallow = ['/admin/'];
      explanation.push('Permissive preset: allows all crawling except admin paths');
      break;
    case 'standard':
      defaultDisallow = [...STANDARD_DISALLOW];
      explanation.push('Standard preset: blocks admin, API, staging, and sort/filter parameters');
      break;
    case 'restrictive':
      defaultDisallow = [...RESTRICTIVE_DISALLOW];
      defaultAllow = [];
      explanation.push('Restrictive preset: blocks everything except explicitly allowed paths');
      break;
  }

  // Merge user-specified paths
  const allDisallow = [...new Set([...defaultDisallow, ...disallowPaths])];
  const allAllow = [...new Set([...defaultAllow, ...allowPaths])];

  // Generate main User-agent block
  lines.push('User-agent: *');

  for (const path of allAllow) {
    lines.push(`Allow: ${path}`);
    explanation.push(`Allows crawling of ${path}`);
  }

  for (const path of allDisallow) {
    lines.push(`Disallow: ${path}`);
    explanation.push(`Blocks crawling of ${path}`);
  }

  if (crawlDelay !== undefined) {
    lines.push(`Crawl-delay: ${crawlDelay}`);
    explanation.push(`Crawl delay of ${crawlDelay} seconds (note: Google ignores Crawl-delay)`);
    warnings.push('Google ignores Crawl-delay. Consider removing it if targeting Google.');
  }

  // Custom user-agent rules
  for (const rule of customRules) {
    lines.push('');
    lines.push(`User-agent: ${rule.userAgent}`);
    for (const path of rule.allow || []) {
      lines.push(`Allow: ${path}`);
    }
    for (const path of rule.disallow || []) {
      lines.push(`Disallow: ${path}`);
    }
    explanation.push(`Custom rules for ${rule.userAgent}`);
  }

  // Sitemap references
  if (sitemapUrls.length > 0) {
    lines.push('');
    for (const sitemapUrl of sitemapUrls) {
      lines.push(`Sitemap: ${sitemapUrl}`);
    }
    explanation.push(`References ${sitemapUrls.length} sitemap(s) for discovery`);
  } else {
    suggestions.push('Consider adding a Sitemap directive pointing to your XML sitemap');
  }

  // Check for potential issues
  if (allDisallow.includes('/')) {
    warnings.push('Disallow: / blocks ALL crawling. Ensure this is intentional.');
  }

  const content = lines.join('\n') + '\n';

  return { content, explanation, warnings, suggestions };
}
