import type { Request } from 'express';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
} from '../constants/cookies';

export type AppKind = 'client' | 'admin';

export function resolveAppKind(
  req: Request,
  adminUrl = 'http://localhost:5174',
): AppKind {
  const origin = req.headers.origin ?? req.headers.referer ?? '';
  if (origin && origin.startsWith(adminUrl)) {
    return 'admin';
  }
  return 'client';
}

export function accessCookieName(app: AppKind): string {
  return app === 'admin' ? ACCESS_COOKIE_ADMIN : ACCESS_COOKIE_CLIENT;
}
