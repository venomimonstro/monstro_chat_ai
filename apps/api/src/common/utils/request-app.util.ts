import type { Request } from 'express';
import type { ConfigService } from '@nestjs/config';
import {
  ACCESS_COOKIE_ADMIN,
  ACCESS_COOKIE_CLIENT,
} from '../constants/cookies';
import { isAdminOrigin, parseAppUrls } from './app-urls.util';

export type AppKind = 'client' | 'admin';

export function resolveAppKind(req: Request, config?: ConfigService): AppKind {
  const origin = req.headers.origin ?? req.headers.referer ?? '';
  if (!origin) return 'client';

  const adminUrls = config
    ? parseAppUrls(config, 'WEB_ADMIN_URL', 'http://localhost:5174')
    : ['http://localhost:5174'];

  if (isAdminOrigin(origin.replace(/\/$/, ''), adminUrls)) {
    return 'admin';
  }
  return 'client';
}

export function accessCookieName(app: AppKind): string {
  return app === 'admin' ? ACCESS_COOKIE_ADMIN : ACCESS_COOKIE_CLIENT;
}
