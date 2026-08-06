import { ConfigService } from '@nestjs/config';

export function parseAppUrls(
  config: ConfigService,
  key: string,
  fallback: string,
): string[] {
  const multi = config.get<string>(`${key}S`);
  const single = config.get<string>(key, fallback);
  const raw = multi ?? single;
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

function toUrl(value: string): URL | null {
  try {
    return new URL(value.startsWith('http') ? value : `https://${value}`);
  } catch {
    return null;
  }
}

/** CORS: exact/prefix match or same browser origin (host) as configured app URL. */
export function originMatchesAppUrls(origin: string, urls: string[]): boolean {
  const normalized = origin.replace(/\/$/, '');
  return urls.some((entry) => {
    const entryNorm = entry.replace(/\/$/, '');
    if (normalized === entryNorm || normalized.startsWith(`${entryNorm}/`)) {
      return true;
    }
    const originUrl = toUrl(normalized);
    const entryUrl = toUrl(entryNorm);
    return Boolean(originUrl && entryUrl && originUrl.origin === entryUrl.origin);
  });
}

/** Admin detection from Origin header (dev port 5174 or explicit admin URL match). */
export function isAdminOrigin(origin: string, adminUrls: string[]): boolean {
  const normalized = origin.replace(/\/$/, '');
  for (const entry of adminUrls) {
    const entryNorm = entry.replace(/\/$/, '');
    if (normalized === entryNorm || normalized.startsWith(`${entryNorm}/`)) {
      return true;
    }
  }
  try {
    const parsed = toUrl(normalized);
    if (parsed?.port === '5174') return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** Admin detection from Referer when admin is served under a path on a shared host. */
export function refererMatchesAdmin(referer: string, adminUrls: string[]): boolean {
  const ref = toUrl(referer);
  if (!ref) return false;

  for (const entry of adminUrls) {
    const adminBase = toUrl(entry.replace(/\/$/, ''));
    if (!adminBase) continue;

    const basePath = adminBase.pathname.replace(/\/$/, '') || '/';
    if (basePath !== '/' && ref.pathname.startsWith(basePath)) {
      return true;
    }
    if (ref.origin === adminBase.origin && adminBase.port === '5174') {
      return true;
    }
  }

  return ref.port === '5174';
}
