# seo-mcp

MCP server providing 19 SEO tools for analysis, performance, research, Google Search Console, and generation.

## Architecture

- `src/mcp/` - MCP server, tool definitions, and handler dispatch
- `src/services/` - Business logic for each tool category
- `src/utils/` - HTTP client, HTML/XML parsers, caching, rate limiting
- `src/config/` - API keys and defaults
- `src/types/` - TypeScript type definitions
- `src/database/` - SQLite adapter and SEO reference data repository

## Key Patterns

- Tool definitions in `tools-*.ts` files, handlers in `handlers-*.ts` files
- `server.ts` aggregates all tools and dispatches to handlers by name
- Services take positional params or options objects, handlers bridge MCP args to service calls
- All errors go through `formatToolError()` for consistent MCP error responses
- Research/GSC handlers check API key availability before calling services
- Rate limiting via token bucket (`RateLimiter`)
- Response caching via LRU cache

## Tool Categories

| Category | Tools | API Keys |
|----------|-------|----------|
| Analysis (7) | analyze_page, analyze_headings, analyze_images, analyze_internal_links, extract_schema, analyze_robots_txt, analyze_sitemap | None |
| Performance (2) | check_core_web_vitals, check_mobile_friendly | Optional PAGESPEED_API_KEY |
| Research (4) | research_keywords, analyze_serp, analyze_backlinks, analyze_domain_authority | DATAFORSEO_LOGIN/PASSWORD |
| GSC (3) | gsc_performance, gsc_index_coverage, gsc_sitemaps | GSC_CLIENT_ID/SECRET/TOKEN |
| Generation (3) | generate_schema, generate_robots_txt, generate_meta_suggestions | None |

## Build & Test

```bash
npm install
npm run build   # TypeScript compilation
npm test        # Vitest unit tests
npm start       # Start MCP server (stdio)
```
