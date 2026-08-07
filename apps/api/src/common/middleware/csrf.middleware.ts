import {
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import {
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from '../constants/cookies';
import { CsrfTokenService } from '../../modules/auth/csrf-token.service';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Paths that use machine tokens or are pre-auth — not browser CSRF. */
const CSRF_SKIP_PREFIXES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/refresh',
  '/api/auth/logout',
  '/api/auth/2fa/verify',
  '/api/auth/me',
  '/api/auth/ws-token',
  '/api/auth/csrf',
  '/api/admin/impersonation/exchange',
  '/api/admin/release/sync',
  '/api/admin/release/report',
  '/api/admin/release/complete',
  '/api/admin/release/host-job/',
  '/api/billing/webhook/',
  '/api/widget/',
  '/api/public/',
  '/api/channels/',
  '/api/health',
];

const CSRF_HEADER_RE = /^[a-f0-9]{64}$/i;

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  constructor(
    private readonly csrfTokens: CsrfTokenService,
    private readonly config: ConfigService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const path = req.originalUrl.split('?')[0];
    if (CSRF_SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      next();
      return;
    }

    const headerToken = req.headers['x-csrf-token'] as string | undefined;
    const cookieToken = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;

    if (!headerToken || !CSRF_HEADER_RE.test(headerToken)) {
      throw new ForbiddenException('Недействительный CSRF-токен');
    }

    if (cookieToken && this.constantTimeEquals(cookieToken, headerToken)) {
      if (refreshToken) {
        await this.csrfTokens.bind(refreshToken, headerToken);
      }
      next();
      return;
    }

    if (refreshToken && (await this.csrfTokens.validate(refreshToken, headerToken))) {
      if (!cookieToken) {
        this.setCsrfCookie(res, headerToken);
      }
      next();
      return;
    }

    throw new ForbiddenException('Недействительный CSRF-токен');
  }

  private constantTimeEquals(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    try {
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
      return false;
    }
  }

  private setCsrfCookie(res: Response, token: string) {
    res.cookie(CSRF_COOKIE, token, {
      httpOnly: false,
      secure: this.cookiesSecure(),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }

  private cookiesSecure(): boolean {
    const explicit = this.config.get<string>('COOKIE_SECURE');
    if (explicit === 'true' || explicit === '1') return true;
    if (explicit === 'false' || explicit === '0') return false;
    const publicUrl = this.config.get<string>('API_PUBLIC_URL', '');
    return publicUrl.startsWith('https://');
  }
}
