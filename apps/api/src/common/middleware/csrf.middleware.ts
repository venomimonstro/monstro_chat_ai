import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE } from '../constants/cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const CSRF_SKIP_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/2fa/verify',
  '/api/auth/me',
  '/api/auth/ws-token',
  '/api/auth/csrf',
  '/api/admin/impersonation/exchange',
  '/api/billing/webhook/',
  '/api/widget/',
  '/api/public/',
  '/api/health',
];

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const path = req.originalUrl.split('?')[0];
    if (CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      next();
      return;
    }

    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const headerToken = req.headers['x-csrf-token'] as string | undefined;

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
      throw new ForbiddenException('Недействительный CSRF-токен');
    }

    next();
  }
}
