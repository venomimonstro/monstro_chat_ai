import type { CrawlSiteProfile } from '@ai-consultant/shared-types';
import {
  DEFAULT_EXCLUDE_PATH_PATTERNS,
  DEFAULT_PRIORITY_PATH_HINTS,
} from '@ai-consultant/shared-types';

export interface CrawlStrategyOptions {
  siteProfile: CrawlSiteProfile;
  excludeBlog: boolean;
  priorityUrls: string[];
  excludePatterns: string[];
}

const ECOMMERCE_NOISE = [
  '/cart',
  '/checkout',
  '/basket',
  '/wishlist',
  '/compare',
  '/account',
  '/login',
  '?sort=',
  '?page=',
  '?filter=',
  '?utm_',
];

export function normalizeCrawlUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = '';
  if (parsed.pathname.endsWith('/') && parsed.pathname.length > 1) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed.href;
}

export function pathMatchesPattern(pathname: string, pattern: string): boolean {
  const p = pattern.trim().toLowerCase();
  if (!p) return false;
  const path = pathname.toLowerCase();
  if (p.includes('*')) {
    const re = new RegExp(
      '^' +
        p
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$',
    );
    return re.test(path);
  }
  return path === p || path.startsWith(p.endsWith('/') ? p : `${p}/`);
}

export function shouldSkipUrl(url: string, options: CrawlStrategyOptions): boolean {
  let pathname = '/';
  try {
    pathname = new URL(url).pathname || '/';
  } catch {
    return true;
  }

  const lower = url.toLowerCase();
  if (lower.includes('?page=') && options.siteProfile === 'ecommerce') return true;
  if (lower.includes('?sort=') || lower.includes('?filter=')) {
    if (options.siteProfile === 'ecommerce' || options.siteProfile === 'large') return true;
  }

  for (const pattern of options.excludePatterns) {
    if (pathMatchesPattern(pathname, pattern)) return true;
  }

  if (options.excludeBlog) {
    for (const pattern of DEFAULT_EXCLUDE_PATH_PATTERNS) {
      if (pathMatchesPattern(pathname, pattern)) return true;
    }
  }

  if (options.siteProfile === 'ecommerce') {
    for (const noise of ECOMMERCE_NOISE) {
      if (lower.includes(noise)) return true;
    }
  }

  return false;
}

export function scoreUrl(url: string, options: CrawlStrategyOptions): number {
  if (shouldSkipUrl(url, options)) return -1000;

  let pathname = '/';
  try {
    pathname = new URL(url).pathname || '/';
  } catch {
    return -1000;
  }

  let score = 10;

  for (const priority of options.priorityUrls) {
    try {
      const norm = normalizeCrawlUrl(priority);
      if (url === norm || url.startsWith(norm.replace(/\/$/, ''))) {
        score += 500;
        break;
      }
    } catch {
      /* skip invalid priority url */
    }
  }

  for (const hint of DEFAULT_PRIORITY_PATH_HINTS) {
    if (hint === '/' && pathname === '/') {
      score += 80;
      break;
    }
    if (hint !== '/' && pathMatchesPattern(pathname, hint)) {
      score += 60;
      break;
    }
  }

  const depth = pathname.split('/').filter(Boolean).length;
  if (depth <= 1) score += 30;
  else if (depth === 2) score += 15;
  else if (depth >= 5) score -= 20;

  if (options.siteProfile === 'small') score += Math.max(0, 10 - depth * 2);

  if (/\/\d{4}\/\d{2}\//.test(pathname)) score -= 40;

  return score;
}

export function resolveEffectivePageLimit(
  tariffLimit: number,
  siteProfile: CrawlSiteProfile,
  discoveredEstimate?: number,
): number {
  if (siteProfile === 'small') {
    return Math.min(tariffLimit, 20);
  }
  if (siteProfile === 'large' || siteProfile === 'ecommerce') {
    return tariffLimit;
  }
  if (discoveredEstimate != null && discoveredEstimate <= 15) {
    return Math.min(tariffLimit, Math.max(discoveredEstimate, 5));
  }
  return tariffLimit;
}

export function resolveMaxDepth(siteProfile: CrawlSiteProfile): number {
  switch (siteProfile) {
    case 'small':
      return 5;
    case 'large':
      return 4;
    case 'ecommerce':
      return 3;
    default:
      return 4;
  }
}
