/**
 * URL validation and normalization utilities
 */

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Ensure HTTPS
    if (parsed.protocol === 'http:') {
      parsed.protocol = 'https:';
    }
    // Remove trailing slash for consistency (except root)
    if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    // Remove default ports
    if (parsed.port === '443' || parsed.port === '80') {
      parsed.port = '';
    }
    // Lowercase hostname
    parsed.hostname = parsed.hostname.toLowerCase();
    return parsed.href;
  } catch {
    return url;
  }
}

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Try adding protocol
    try {
      const parsed = new URL(`https://${url}`);
      return parsed.hostname;
    } catch {
      return url;
    }
  }
}

export function ensureProtocol(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

export function isInternalLink(linkUrl: string, pageUrl: string): boolean {
  try {
    const link = new URL(linkUrl, pageUrl);
    const page = new URL(pageUrl);
    return link.hostname === page.hostname;
  } catch {
    return false;
  }
}

export function resolveUrl(relative: string, base: string): string {
  try {
    return new URL(relative, base).href;
  } catch {
    return relative;
  }
}

export function getUrlDepth(url: string): number {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    if (!path || path === '') return 0;
    return path.split('/').filter((s) => s.length > 0).length;
  } catch {
    return 0;
  }
}

export function getFileExtension(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname;
    const dot = path.lastIndexOf('.');
    if (dot === -1) return '';
    return path.slice(dot + 1).toLowerCase();
  } catch {
    return '';
  }
}
