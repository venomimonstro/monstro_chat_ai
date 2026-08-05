import { ConfigService } from '@nestjs/config';

export function parseAppUrls(config: ConfigService, key: string, fallback: string): string[] {
  const multi = config.get<string>(`${key}S`);
  const single = config.get<string>(key, fallback);
  const raw = multi ?? single;
  return raw
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

export function originMatchesAppUrls(origin: string, urls: string[]): boolean {
  const normalized = origin.replace(/\/$/, '');
  return urls.some(
    (entry) => normalized === entry || normalized.startsWith(`${entry}/`),
  );
}

export function isAdminOrigin(origin: string, adminUrls: string[]): boolean {
  if (originMatchesAppUrls(origin, adminUrls)) return true;
  try {
    const parsed = new URL(origin);
    if (parsed.port === '5174') return true;
  } catch {
    /* ignore */
  }
  return false;
}
