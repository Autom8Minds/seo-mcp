#!/usr/bin/env node
/**
 * CLI entry point for the seo-mcp MCP server.
 *
 * Loads environment variables, creates the MCP server, connects it to
 * a stdio transport, and handles graceful shutdown on process signals.
 */

import { config } from 'dotenv';

// Load .env before any other imports that might read process.env
config();

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { logger } from '../utils/logger.js';

async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();

  // Graceful shutdown handler
  const shutdown = async () => {
    logger.info('Shutting down seo-mcp server...');
    try {
      await server.close();
    } catch {
      // Ignore close errors during shutdown
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  logger.info('Starting seo-mcp server via stdio transport...');
  await server.connect(transport);
  logger.info('seo-mcp server connected and ready.');
}

main().catch((error) => {
  logger.error('Fatal error starting seo-mcp:', error);
  process.exit(1);
});
