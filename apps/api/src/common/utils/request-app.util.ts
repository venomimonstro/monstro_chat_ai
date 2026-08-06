import type { Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
} from '../constants/cookies';
import {
  isAdminOrigin,
  parseAppUrls,
  refererMatchesAdmin,
} from './app-urls.util';

export type AppKind = 'client' | 'admin';

export function resolveAppKind(req: Request, config?: ConfigService): AppKind {
  const origin = (req.headers.origin ?? '').replace(/\/$/, '');
  const referer = req.headers.referer ?? '';

  const adminUrls = config
    ? parseAppUrls(config, 'WEB_ADMIN_URL', 'http://localhost:5174')
    : ['http://localhost:5174'];

  if (origin && isAdminOrigin(origin, adminUrls)) {
    return 'admin';
  }

  if (referer && refererMatchesAdmin(referer, adminUrls)) {
    return 'admin';
  }

  return 'client';
}

export function accessCookieName(app: AppKind): string {
  return app === 'admin' ? ACCESS_COOKIE_ADMIN : ACCESS_COOKIE_CLIENT;
}
