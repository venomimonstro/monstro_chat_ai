import { createHash } from 'crypto';

/** Stable hash for incremental crawl — skip re-embed when page text unchanged. */
export function hashPageContent(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  return createHash('sha256').update(normalized).digest('hex');
}
