export const DEFAULTS = {
  /** HTTP request timeout in ms */
  httpTimeout: 15000,

  /** User agent string for requests */
  userAgent: 'SEO-MCP-Bot/1.0 (+https://github.com/anurag-kalita/seo-mcp)',

  /** Maximum redirects to follow */
  maxRedirects: 10,

  /** Maximum images to analyze per page */
  maxImages: 100,

  /** Maximum links to analyze per page */
  maxLinks: 500,

  /** Maximum URLs to process from sitemap */
  maxSitemapUrls: 1000,

  /** Maximum keywords per research request */
  maxKeywords: 100,

  /** Maximum domains for authority check */
  maxDomains: 50,

  /** LRU cache max entries */
  cacheMaxEntries: 100,

  /** LRU cache TTL in ms (15 minutes) */
  cacheTtl: 15 * 60 * 1000,

  /** Rate limit: PageSpeed requests per 100 seconds (without key) */
  pagespeedRateLimit: 25,

  /** Rate limit: PageSpeed requests per 100 seconds (with key) */
  pagespeedRateLimitWithKey: 400,

  /** MCP server name */
  serverName: 'seo-mcp',

  /** MCP server version */
  serverVersion: '1.0.0',

  /** Database path */
  dbPath: './data/seo.db',

  /** MCP mode */
  mcpMode: 'stdio' as 'stdio' | 'http',

  /** HTTP server port */
  httpPort: 3000,

  /** HTTP server host */
  httpHost: '0.0.0.0',

  /** Log level */
  logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
} as const;

export function getConfig() {
  return {
    ...DEFAULTS,
    dbPath: process.env.SEO_DB_PATH || DEFAULTS.dbPath,
    mcpMode: (process.env.MCP_MODE || DEFAULTS.mcpMode) as 'stdio' | 'http',
    httpPort: parseInt(process.env.PORT || String(DEFAULTS.httpPort), 10),
    httpHost: process.env.HOST || DEFAULTS.httpHost,
    logLevel: (process.env.MCP_LOG_LEVEL || DEFAULTS.logLevel) as 'debug' | 'info' | 'warn' | 'error',
    authToken: process.env.AUTH_TOKEN || undefined,
  };
}
