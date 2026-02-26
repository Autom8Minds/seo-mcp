import { DEFAULTS } from '../config/defaults.js';
import { logger } from './logger.js';

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  redirectChain: string[];
  responseTime: number;
}

export interface HttpOptions {
  timeout?: number;
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  method?: 'GET' | 'HEAD';
  headers?: Record<string, string>;
}

export async function httpGet(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
  const {
    timeout = DEFAULTS.httpTimeout,
    userAgent = DEFAULTS.userAgent,
    followRedirects = true,
    maxRedirects = DEFAULTS.maxRedirects,
    method = 'GET',
    headers = {},
  } = options;

  const redirectChain: string[] = [];
  let currentUrl = url;
  let redirectCount = 0;
  const startTime = Date.now();

  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(currentUrl, {
        method,
        headers: {
          'User-Agent': userAgent,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          ...headers,
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timer);

      // Handle redirects manually to track chain
      if (followRedirects && [301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location && redirectCount < maxRedirects) {
          redirectChain.push(currentUrl);
          currentUrl = new URL(location, currentUrl).href;
          redirectCount++;
          continue;
        }
      }

      const body = method === 'HEAD' ? '' : await response.text();
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      return {
        status: response.status,
        headers: responseHeaders,
        body,
        redirectChain,
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      clearTimeout(timer);
      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${currentUrl}`);
      }
      throw new Error(`HTTP request failed: ${err.message}`);
    }
  }
}

export async function httpHead(url: string, options: HttpOptions = {}): Promise<HttpResponse> {
  return httpGet(url, { ...options, method: 'HEAD' });
}

export async function fetchJson<T>(url: string, options: HttpOptions & { body?: string; contentType?: string } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || DEFAULTS.httpTimeout);

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'User-Agent': options.userAgent || DEFAULTS.userAgent,
        Accept: 'application/json',
        ...(options.contentType ? { 'Content-Type': options.contentType } : {}),
        ...(options.headers || {}),
      },
      body: options.body,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json() as T;
  } catch (error) {
    clearTimeout(timer);
    const err = error as Error;
    if (err.name === 'AbortError') {
      throw new Error(`Request timeout: ${url}`);
    }
    throw error;
  }
}
