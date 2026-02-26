# seo-mcp

An open-source MCP (Model Context Protocol) server that turns Claude into a full SEO consultant. Provides 19 tools for page analysis, Core Web Vitals, structured data validation, keyword research, backlink analysis, and more.

**12 of 19 tools work with zero API keys** - just install and start analyzing.

## Quick Start

### With Claude Code

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "seo-mcp": {
      "command": "npx",
      "args": ["-y", "seo-mcp"]
    }
  }
}
```

### With Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "seo-mcp": {
      "command": "npx",
      "args": ["-y", "seo-mcp"]
    }
  }
}
```

### Docker

```bash
docker run -i ghcr.io/Autom8Minds/seo-mcp
```

### From Source

```bash
git clone https://github.com/Autom8Minds/seo-mcp.git
cd seo-mcp
npm install
npm run build
npm start
```

## Tools

### Category A: Page Analysis (7 tools, no API key needed)

| Tool | Description |
|------|-------------|
| `analyze_page` | Full on-page SEO audit with 0-100 score |
| `analyze_headings` | H1-H6 structure and hierarchy validation |
| `analyze_images` | Alt text, file size, format, lazy loading audit |
| `analyze_internal_links` | Link mapping, anchor text analysis, broken link detection |
| `extract_schema` | JSON-LD/Microdata extraction and Google validation |
| `analyze_robots_txt` | Parse and test robots.txt rules |
| `analyze_sitemap` | XML sitemap validation and URL analysis |

### Category B: Performance (2 tools, free API)

| Tool | Description |
|------|-------------|
| `check_core_web_vitals` | LCP, INP, CLS + Lighthouse scores |
| `check_mobile_friendly` | Mobile viewport, fonts, tap targets |

### Category C: Research (4 tools, paid API keys)

| Tool | Description |
|------|-------------|
| `research_keywords` | Search volume, difficulty, CPC, trends |
| `analyze_serp` | SERP features, featured snippets, PAA |
| `analyze_backlinks` | Backlink profile and anchor text analysis |
| `analyze_domain_authority` | DA metrics for domains |

### Category D: Google Search Console (3 tools, OAuth2)

| Tool | Description |
|------|-------------|
| `gsc_performance` | Clicks, impressions, CTR by query/page |
| `gsc_index_coverage` | Index status and URL inspection |
| `gsc_sitemaps` | Submitted sitemaps status |

### Category E: Generation (3 tools, local)

| Tool | Description |
|------|-------------|
| `generate_schema` | Generate valid Schema.org JSON-LD |
| `generate_robots_txt` | Generate robots.txt from config |
| `generate_meta_suggestions` | Optimized title/meta/OG suggestions |

## API Keys

Most tools work out of the box. Optional API keys unlock additional features:

| Key | Tools Unlocked | How to Get |
|-----|---------------|------------|
| `PAGESPEED_API_KEY` | Higher rate limits for performance tools | [Google Cloud Console](https://console.cloud.google.com/) |
| `DATAFORSEO_LOGIN` + `PASSWORD` | Keyword research, SERP, backlinks, DA | [DataForSEO](https://dataforseo.com/) |
| `MOZ_ACCESS_ID` + `SECRET_KEY` | Backlinks, DA (alternative to DataForSEO) | [Moz API](https://moz.com/products/api) |
| `GSC_CLIENT_ID` + `SECRET` + `REFRESH_TOKEN` | Google Search Console tools | [GSC API Setup](https://developers.google.com/webmaster-tools/) |

Create a `.env` file from the template:

```bash
cp .env.example .env
```

## Usage Examples

Once connected, ask Claude:

- "Analyze the SEO of https://example.com"
- "Check the Core Web Vitals for my homepage"
- "Extract and validate the structured data on this product page"
- "Generate FAQ schema for these questions"
- "Analyze my heading structure and check for keyword presence"
- "Is my robots.txt blocking important pages?"

## Companion: seo-skills

For maximum effectiveness, pair this MCP server with [seo-skills](https://github.com/Autom8Minds/seo-skills) - 7 Claude Code skills that teach SEO best practices, content strategy, schema markup, and more.

## Development

```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm test             # Run tests
npm run dev          # Development mode with tsx
npm run lint         # Type check
```

## License

MIT
