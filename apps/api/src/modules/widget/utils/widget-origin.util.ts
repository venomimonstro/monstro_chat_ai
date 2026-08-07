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

function normalizeOrigin(value: string): string {
  return value.trim().replace(/\/$/, '');
}

function originsMatch(candidate: string, allowedEntry: string): boolean {
  const origin = normalizeOrigin(candidate);
  const entry = normalizeOrigin(allowedEntry);
  return origin === entry || origin.startsWith(`${entry}/`);
}

function getWidgetHostOrigins(): string[] {
  const raw = process.env.WIDGET_URL ?? 'http://localhost:5175';
  const origins = new Set<string>();
  for (const part of raw.split(',')) {
    try {
      origins.add(new URL(normalizeOrigin(part)).origin);
    } catch {
      /* ignore invalid */
    }
  }
  return [...origins];
}

/**
 * Chat runs inside an iframe hosted on WIDGET_URL, so browser Origin is the
 * widget host — not the customer site. Always allow the widget host itself.
 * Customer allowlist is checked against optional parentOrigin (from embed).
 */
export function isWidgetOriginAllowed(
  sourcesService: SourcesService,
  source: Source,
  originHeader?: string,
  refererHeader?: string,
  parentOrigin?: string | null,
): boolean {
  const requestOrigin = getRequestOrigin(originHeader, refererHeader);
  const widgetHosts = getWidgetHostOrigins();

  if (requestOrigin && widgetHosts.some((host) => originsMatch(requestOrigin, host))) {
    if (!parentOrigin) return true;
    const allowed = sourcesService.getAllowedOrigins(source);
    if (!allowed.length) {
      return process.env.NODE_ENV !== 'production';
    }
    return allowed.some((entry) => originsMatch(parentOrigin, entry));
  }

  const allowed = sourcesService.getAllowedOrigins(source);
  if (!allowed.length) {
    return process.env.NODE_ENV !== 'production';
  }

  if (parentOrigin && allowed.some((entry) => originsMatch(parentOrigin, entry))) {
    return true;
  }

  if (!requestOrigin) return false;

  return allowed.some((entry) => originsMatch(requestOrigin, entry));
}
