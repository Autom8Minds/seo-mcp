import { logger } from './logger.js';

export class SeoMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'SeoMcpError';
  }
}

export class ApiKeyMissingError extends SeoMcpError {
  constructor(apiName: string, setupInstructions: string) {
    super(
      `${apiName} API key not configured. ${setupInstructions}`,
      'API_KEY_MISSING',
    );
    this.name = 'ApiKeyMissingError';
  }
}

export class UrlFetchError extends SeoMcpError {
  constructor(url: string, reason: string) {
    super(`Failed to fetch ${url}: ${reason}`, 'URL_FETCH_ERROR');
    this.name = 'UrlFetchError';
  }
}

export function formatToolError(error: unknown): { content: { type: 'text'; text: string }[]; isError: true } {
  let message: string;

  if (error instanceof ApiKeyMissingError) {
    message = error.message;
  } else if (error instanceof UrlFetchError) {
    message = error.message;
  } else if (error instanceof SeoMcpError) {
    message = error.message;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
    logger.error('Unexpected error:', error);
  } else {
    message = `Unknown error: ${String(error)}`;
    logger.error('Unknown error:', error);
  }

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
