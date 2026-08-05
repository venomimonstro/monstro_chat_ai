import type { Source } from '@prisma/client';
import type { SourcesService } from '../../sources/sources.service';

export function getRequestOrigin(
  originHeader?: string,
  refererHeader?: string,
): string | null {
  if (originHeader) return originHeader.replace(/\/$/, '');
  if (!refererHeader) return null;
  try {
    return new URL(refererHeader).origin;
  } catch {
    return null;
  }
}

export function isWidgetOriginAllowed(
  sourcesService: SourcesService,
  source: Source,
  originHeader?: string,
  refererHeader?: string,
): boolean {
  const allowed = sourcesService.getAllowedOrigins(source);
  if (!allowed.length) {
    return process.env.NODE_ENV !== 'production';
  }

  const origin = getRequestOrigin(originHeader, refererHeader);
  if (!origin) return false;

  return allowed.some(
    (entry) => origin === entry || origin.startsWith(`${entry}/`),
  );
}
