import { LRUCache } from 'lru-cache';
import { DEFAULTS } from '../config/defaults.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cache = new LRUCache<string, any>({
  max: DEFAULTS.cacheMaxEntries,
  ttl: DEFAULTS.cacheTtl,
});

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearCache(): void {
  cache.clear();
}

export function getCacheKey(tool: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce(
      (acc, key) => {
        acc[key] = params[key];
        return acc;
      },
      {} as Record<string, unknown>
    );
  return `${tool}:${JSON.stringify(sorted)}`;
}
